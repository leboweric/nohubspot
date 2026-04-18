"""
Toggl Track → NHS Incremental Sync
====================================
Pulls time entries from Toggl after the most recent entry in NHS
and appends them to the database.

Dedup uses (epoch, user_id, duration_seconds, description) to avoid
duplicates regardless of timestamp format differences.
All timestamps are stored in UTC.
"""
import psycopg2
import psycopg2.extras
import requests
import json
import time
import logging
from datetime import datetime, timedelta, timezone
from dateutil import parser as dateparser

# ─── Configuration ───────────────────────────────────────────────────────────
NHS_DB_URL = "postgresql://postgres:KXGPGFkLkkicZQoOVyixcuNNVtOlJvSo@switchback.proxy.rlwy.net:27597/railway"
NHS_ORG_ID = 7
TOGGL_EMAIL = "kharding@strategic-cc.com"
TOGGL_PASSWORD = "KHactive1!"
TOGGL_WORKSPACE_ID = 3639704
TOGGL_API_BASE = "https://api.track.toggl.com/api/v9"
TOGGL_REPORTS_BASE = "https://api.track.toggl.com/reports/api/v3"

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
log = logging.getLogger(__name__)

auth = (TOGGL_EMAIL, TOGGL_PASSWORD)
headers = {"Content-Type": "application/json"}
request_count = 0

def toggl_get(path, params=None, retries=3):
    global request_count
    request_count += 1
    time.sleep(1.1)
    url = f"{TOGGL_API_BASE}{path}"
    for attempt in range(retries):
        try:
            r = requests.get(url, auth=auth, headers=headers, params=params, timeout=60)
            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After", 60))
                log.warning(f"Rate limited, sleeping {wait}s...")
                time.sleep(wait + 5)
                return toggl_get(path, params)
            r.raise_for_status()
            return r.json()
        except (requests.exceptions.ConnectionError, requests.exceptions.SSLError, requests.exceptions.ReadTimeout) as e:
            if attempt < retries - 1:
                log.warning(f"Connection error (attempt {attempt+1}/{retries}), retrying in 10s...")
                time.sleep(10)
            else:
                raise

def toggl_reports_post(path, body, retries=3):
    global request_count
    request_count += 1
    time.sleep(1.1)
    url = f"{TOGGL_REPORTS_BASE}{path}"
    for attempt in range(retries):
        try:
            r = requests.post(url, auth=auth, headers=headers, json=body, timeout=60)
            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After", 60))
                log.warning(f"Rate limited, sleeping {wait}s...")
                time.sleep(wait + 5)
                return toggl_reports_post(path, body)
            r.raise_for_status()
            return r.json(), dict(r.headers)
        except (requests.exceptions.ConnectionError, requests.exceptions.SSLError, requests.exceptions.ReadTimeout) as e:
            if attempt < retries - 1:
                log.warning(f"Connection error (attempt {attempt+1}/{retries}), retrying in 10s...")
                time.sleep(10)
            else:
                raise

def to_utc_epoch(ts_str):
    """Parse any timestamp string to UTC epoch seconds (integer)."""
    dt = dateparser.parse(str(ts_str))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())

def to_utc_iso(ts_str):
    """Parse any timestamp string and return UTC ISO format for DB storage."""
    dt = dateparser.parse(str(ts_str))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    utc_dt = dt.astimezone(timezone.utc)
    return utc_dt.strftime("%Y-%m-%d %H:%M:%S+00:00")

def db_connect():
    for attempt in range(5):
        try:
            return psycopg2.connect(NHS_DB_URL, connect_timeout=15)
        except psycopg2.OperationalError:
            if attempt < 4:
                log.warning(f"DB connection failed (attempt {attempt+1}/5), retrying in 10s...")
                time.sleep(10)
            else:
                raise

def main():
    conn = db_connect()
    cur = conn.cursor()

    # 1. Find the most recent entry date in NHS
    cur.execute("SELECT MAX(start_time) FROM time_entries WHERE organization_id = %s", (NHS_ORG_ID,))
    max_date = cur.fetchone()[0]
    log.info(f"Most recent NHS entry: {max_date}")

    # Start syncing from the same day to catch any missed entries
    sync_start = max_date.date().strftime("%Y-%m-%d")
    # Use tomorrow's date to ensure today's entries are included (Toggl excludes end_date)
    sync_end = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    log.info(f"Syncing from {sync_start} to {sync_end}")

    # 2. Build project map (toggl_id -> nhs_id)
    cur.execute("SELECT id, title FROM projects WHERE organization_id = %s", (NHS_ORG_ID,))
    nhs_projects = {row[1]: row[0] for row in cur.fetchall()}
    
    toggl_projects = toggl_get(f"/workspaces/{TOGGL_WORKSPACE_ID}/projects", {"active": "both", "per_page": 200})
    project_map = {}
    for tp in toggl_projects:
        toggl_name = tp["name"]
        toggl_id = tp["id"]
        if toggl_name in nhs_projects:
            project_map[toggl_id] = nhs_projects[toggl_name]
    log.info(f"Project map: {len(project_map)} Toggl projects mapped to NHS")

    # 3. Build user map (toggl_uid -> nhs_user_id)
    cur.execute("SELECT id, email FROM users")
    nhs_users_by_email = {row[1]: row[0] for row in cur.fetchall()}
    
    toggl_members = toggl_get(f"/workspaces/{TOGGL_WORKSPACE_ID}/users")
    user_map = {}
    for m in toggl_members:
        toggl_uid = m.get("user_id") or m.get("id")
        toggl_email = m.get("email", "")
        if toggl_email in nhs_users_by_email:
            user_map[toggl_uid] = nhs_users_by_email[toggl_email]
    log.info(f"User map: {len(user_map)} Toggl users mapped to NHS (from {len(toggl_members)} Toggl users)")

    # 4. Get tag mapping
    toggl_tags = toggl_get(f"/workspaces/{TOGGL_WORKSPACE_ID}/tags")
    tag_map = {t["id"]: t["name"] for t in toggl_tags}

    # 5. Build epoch-based dedup set from existing entries
    #    Uses (epoch, user_id, duration_seconds, description[:100]) as the key
    cur.execute(
        """SELECT start_time, user_id, duration_seconds, description 
           FROM time_entries 
           WHERE organization_id = %s AND start_time >= %s""",
        (NHS_ORG_ID, sync_start)
    )
    existing_keys = set()
    for row in cur.fetchall():
        epoch = to_utc_epoch(row[0])
        uid = row[1]
        dur = row[2] or 0
        desc = (row[3] or "")[:100]
        existing_keys.add((epoch, uid, dur, desc))
    log.info(f"Found {len(existing_keys)} existing entry keys in sync range for dedup")

    # 6. Fetch and import entries
    total_imported = 0
    total_skipped = 0
    total_dupes = 0
    _skipped_users = set()

    first_row_number = None
    first_id = None
    first_timestamp = None
    page_num = 0

    while True:
        page_num += 1
        body = {
            "start_date": sync_start,
            "end_date": sync_end,
            "page_size": 50,
            "enrich_response": False,
            "order_by": "date",
            "order_dir": "ASC",
        }
        if first_row_number is not None:
            body["first_row_number"] = first_row_number
            body["first_id"] = first_id
            body["first_timestamp"] = first_timestamp

        try:
            entries, resp_headers = toggl_reports_post(
                f"/workspace/{TOGGL_WORKSPACE_ID}/search/time_entries", body
            )
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                log.warning("Rate limited, sleeping 120s...")
                time.sleep(120)
                continue
            raise

        if not entries:
            log.info(f"No more entries (page {page_num})")
            break

        batch_values = []
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
                if toggl_uid not in _skipped_users:
                    _skipped_users.add(toggl_uid)
                    log.warning(f"  No NHS user for Toggl uid={toggl_uid}, desc='{description[:50]}'")
                continue

            # Get Toggl billable rate info
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

                # Calculate per-entry billable amount (proportional if grouped)
                if total_te_seconds > 0 and len(time_entries_list) > 1:
                    entry_billable_cents = int(total_billable_cents * te_seconds / total_te_seconds)
                else:
                    entry_billable_cents = total_billable_cents

                # Epoch-based dedup: (epoch, user_id, duration, description)
                epoch = to_utc_epoch(te_start)
                key = (epoch, nhs_user_id, te_seconds, (description or "")[:100])
                if key in existing_keys:
                    total_dupes += 1
                    continue

                # Convert to UTC for consistent storage
                start_utc = to_utc_iso(te_start)
                stop_utc = to_utc_iso(te_stop) if te_stop else None

                batch_values.append((
                    NHS_ORG_ID, nhs_user_id, nhs_project_id,
                    description, start_utc, stop_utc, te_seconds,
                    is_billable, json.dumps(entry_tags) if entry_tags else None,
                    False,  # is_running
                    hourly_rate_cents, entry_billable_cents
                ))
                existing_keys.add(key)

        if batch_values:
            psycopg2.extras.execute_values(
                cur,
                """INSERT INTO time_entries 
                   (organization_id, user_id, project_id, description, start_time, end_time, 
                    duration_seconds, is_billable, tags, is_running,
                    hourly_rate_cents, billable_amount_cents)
                   VALUES %s""",
                batch_values,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
            )
            total_imported += len(batch_values)
            conn.commit()
            log.info(f"  Page {page_num}: imported {len(batch_values)} entries (total: {total_imported}, dupes skipped: {total_dupes})")
        else:
            log.info(f"  Page {page_num}: 0 new entries (dupes: {total_dupes})")

        # Check for next page
        next_row = resp_headers.get("X-Next-Row-Number")
        next_id = resp_headers.get("X-Next-ID")
        next_ts = resp_headers.get("X-Next-Timestamp")

        if not next_row:
            log.info(f"End of results (page {page_num})")
            break

        first_row_number = int(next_row)
        first_id = int(next_id) if next_id else None
        first_timestamp = int(next_ts) if next_ts else None

    conn.commit()
    log.info(f"\n=== Sync Complete ===")
    log.info(f"  New entries imported: {total_imported}")
    log.info(f"  Duplicates skipped: {total_dupes}")
    log.info(f"  Skipped (no user match): {total_skipped}")
    log.info(f"  API requests: {request_count}")

    # Verify
    cur.execute("SELECT MAX(start_time), COUNT(*) FROM time_entries WHERE organization_id = %s", (NHS_ORG_ID,))
    mx, cnt = cur.fetchone()
    log.info(f"  NHS now has {cnt} entries, latest: {mx}")

    conn.close()

if __name__ == "__main__":
    main()
