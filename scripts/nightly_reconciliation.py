"""
Nightly Toggl → NHS Full Reconciliation
=========================================
Deletes all NHS time entries from the last 60 days and re-imports
from Toggl using daily chunks with dedup.

This catches any edits, deletions, or corrections made in Toggl
that the incremental sync would miss.

Designed to run nightly at 2 AM CDT via scheduled task.
"""
import psycopg2, psycopg2.extras, requests, json, time, logging
from datetime import datetime, timedelta, timezone
from dateutil import parser as dateparser

# ─── Configuration ───────────────────────────────────────────────────────────
TOGGL_EMAIL = "kharding@strategic-cc.com"
TOGGL_PASSWORD = "KHactive1!"
WS = 3639704
DB_URL = "postgresql://postgres:KXGPGFkLkkicZQoOVyixcuNNVtOlJvSo@switchback.proxy.rlwy.net:27597/railway"
ORG_ID = 7
LOOKBACK_DAYS = 60

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
log = logging.getLogger(__name__)

auth = (TOGGL_EMAIL, TOGGL_PASSWORD)
headers = {"Content-Type": "application/json"}

def api_post(url, body, retries=3):
    for attempt in range(retries):
        try:
            time.sleep(1.2)
            r = requests.post(url, auth=auth, headers=headers, json=body, timeout=60)
            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After", 60))
                log.warning(f"Rate limited, sleeping {wait+5}s...")
                time.sleep(wait + 5)
                return api_post(url, body, retries)
            r.raise_for_status()
            return r.json(), dict(r.headers)
        except (requests.exceptions.ConnectionError, requests.exceptions.SSLError, requests.exceptions.ReadTimeout) as e:
            if attempt < retries - 1:
                log.warning(f"Retry {attempt+1}: {e}")
                time.sleep(10)
            else:
                raise

def api_get(url, retries=3):
    for attempt in range(retries):
        try:
            time.sleep(1.2)
            r = requests.get(url, auth=auth, headers=headers, timeout=30)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(10)
            else:
                raise

def to_utc_iso(ts_str):
    dt = dateparser.parse(str(ts_str))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S+00:00")

def to_utc_epoch(ts_str):
    dt = dateparser.parse(str(ts_str))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())

def db_connect():
    for attempt in range(5):
        try:
            return psycopg2.connect(DB_URL, connect_timeout=15)
        except psycopg2.OperationalError:
            if attempt < 4:
                log.warning(f"DB connection failed (attempt {attempt+1}/5), retrying in 10s...")
                time.sleep(10)
            else:
                raise

def main():
    log.info("=== Nightly Toggl → NHS Reconciliation Starting ===")
    
    conn = db_connect()
    cur = conn.cursor()

    # Dynamic date range: last 60 days through tomorrow
    start_date = (datetime.now() - timedelta(days=LOOKBACK_DAYS)).strftime("%Y-%m-%d")
    end_date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
    log.info(f"Reconciliation window: {start_date} to {end_date}")

    # Build project map
    cur.execute("SELECT id, title FROM projects WHERE organization_id = %s", (ORG_ID,))
    nhs_projects = {row[1]: row[0] for row in cur.fetchall()}
    toggl_projects = api_get(f"https://api.track.toggl.com/api/v9/workspaces/{WS}/projects?active=both&per_page=200")
    project_map = {}
    for tp in toggl_projects:
        if tp["name"] in nhs_projects:
            project_map[tp["id"]] = nhs_projects[tp["name"]]
    log.info(f"Project map: {len(project_map)} projects")

    # Build user map
    cur.execute("SELECT id, email FROM users")
    nhs_users_by_email = {row[1]: row[0] for row in cur.fetchall()}
    toggl_members = api_get(f"https://api.track.toggl.com/api/v9/workspaces/{WS}/users")
    user_map = {}
    for m in toggl_members:
        toggl_uid = m.get("user_id") or m.get("id")
        toggl_email = m.get("email", "")
        if toggl_email in nhs_users_by_email:
            user_map[toggl_uid] = nhs_users_by_email[toggl_email]
    log.info(f"User map: {len(user_map)} users")

    # Tag map
    toggl_tags = api_get(f"https://api.track.toggl.com/api/v9/workspaces/{WS}/tags")
    tag_map = {t["id"]: t["name"] for t in toggl_tags}

    # DELETE entries in the reconciliation window
    cur.execute(
        "DELETE FROM time_entries WHERE organization_id = %s AND start_time >= %s",
        (ORG_ID, start_date)
    )
    deleted = cur.rowcount
    conn.commit()
    log.info(f"Deleted {deleted} entries from {start_date}+")

    # Dedup set
    seen_keys = set()

    # Fetch ALL entries using DAILY chunks
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    total_imported = 0
    total_skipped = 0
    total_dupes = 0

    day = start
    while day < end:
        next_day = day + timedelta(days=1)
        sd = day.strftime('%Y-%m-%d')
        ed = next_day.strftime('%Y-%m-%d')

        day_entries = []
        first_row_number = None
        page = 0

        while True:
            page += 1
            body = {'start_date': sd, 'end_date': ed, 'page_size': 50}
            if first_row_number is not None:
                body['first_row_number'] = first_row_number

            entries, resp_headers = api_post(
                f'https://api.track.toggl.com/reports/api/v3/workspace/{WS}/search/time_entries',
                body
            )

            if not entries:
                break

            for entry in entries:
                toggl_uid = entry.get("user_id")
                toggl_pid = entry.get("project_id")
                description = entry.get("description", "")
                is_billable = entry.get("billable", True)
                entry_tag_ids = entry.get("tag_ids", [])
                entry_tags = [tag_map.get(tid, str(tid)) for tid in entry_tag_ids] if entry_tag_ids else None

                nhs_user_id = user_map.get(toggl_uid)
                nhs_project_id = project_map.get(toggl_pid) if toggl_pid else None

                if not nhs_user_id:
                    total_skipped += 1
                    continue

                hourly_rate_cents = entry.get("hourly_rate_in_cents", 0) or 0
                total_billable_cents = entry.get("billable_amount_in_cents", 0) or 0
                time_entries_list = entry.get("time_entries", [])
                total_te_seconds = sum(t.get("seconds", 0) for t in time_entries_list)

                for te in time_entries_list:
                    te_start = te.get("start")
                    te_stop = te.get("stop")
                    te_seconds = te.get("seconds", 0)

                    if not te_start:
                        continue

                    if total_te_seconds > 0 and len(time_entries_list) > 1:
                        entry_billable_cents = int(total_billable_cents * te_seconds / total_te_seconds)
                    else:
                        entry_billable_cents = total_billable_cents

                    epoch = to_utc_epoch(te_start)
                    dedup_key = (epoch, nhs_user_id, te_seconds, (description or "")[:100])
                    if dedup_key in seen_keys:
                        total_dupes += 1
                        continue
                    seen_keys.add(dedup_key)

                    start_utc = to_utc_iso(te_start)
                    stop_utc = to_utc_iso(te_stop) if te_stop else None

                    day_entries.append((
                        ORG_ID, nhs_user_id, nhs_project_id,
                        description, start_utc, stop_utc, te_seconds,
                        is_billable, json.dumps(entry_tags) if entry_tags else None,
                        False, hourly_rate_cents, entry_billable_cents
                    ))

            next_row = resp_headers.get("X-Next-Row-Number")
            if not next_row or len(entries) < 50:
                break
            first_row_number = int(next_row)

        if day_entries:
            psycopg2.extras.execute_values(
                cur,
                """INSERT INTO time_entries 
                   (organization_id, user_id, project_id, description, start_time, end_time, 
                    duration_seconds, is_billable, tags, is_running,
                    hourly_rate_cents, billable_amount_cents)
                   VALUES %s""",
                day_entries,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
            )
            conn.commit()
            total_imported += len(day_entries)

        day = next_day

    log.info(f"\n=== Reconciliation Complete ===")
    log.info(f"  Entries imported: {total_imported}")
    log.info(f"  Dupes skipped: {total_dupes}")
    log.info(f"  Skipped (no user): {total_skipped}")

    # Verify
    cur.execute(
        "SELECT COUNT(*), SUM(duration_seconds)/3600.0, MAX(start_time) FROM time_entries WHERE organization_id = %s AND start_time >= %s",
        (ORG_ID, start_date)
    )
    cnt, hrs, mx = cur.fetchone()
    log.info(f"  NHS has {cnt} entries since {start_date}, {float(hrs or 0):.2f}h, latest: {mx}")

    conn.close()
    log.info("=== Done ===")

if __name__ == "__main__":
    main()
