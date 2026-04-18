"""
Full Re-Sync: Delete all NHS entries since March 1 and re-import from Toggl
with PROPER PAGINATION to get ALL entries (not just first 200).

The Toggl Reports API returns max 50 entries per page with pagination headers.
We must follow X-Next-Row-Number to get ALL pages.
"""
import psycopg2
import psycopg2.extras
import requests
import json
import time
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from dateutil import parser as dateparser

NHS_DB_URL = "postgresql://postgres:KXGPGFkLkkicZQoOVyixcuNNVtOlJvSo@switchback.proxy.rlwy.net:27597/railway"
NHS_ORG_ID = 7
TOGGL_EMAIL = "kharding@strategic-cc.com"
TOGGL_PASSWORD = "KHactive1!"
TOGGL_WORKSPACE_ID = 3639704
TOGGL_API_BASE = "https://api.track.toggl.com/api/v9"
TOGGL_REPORTS_BASE = "https://api.track.toggl.com/reports/api/v3"

auth = (TOGGL_EMAIL, TOGGL_PASSWORD)
headers = {"Content-Type": "application/json"}

def api_post(path, body, retries=3):
    time.sleep(1.1)
    url = f"{TOGGL_REPORTS_BASE}{path}"
    for attempt in range(retries):
        try:
            r = requests.post(url, auth=auth, headers=headers, json=body, timeout=60)
            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After", 60))
                print(f"  Rate limited, sleeping {wait}s...")
                time.sleep(wait + 5)
                return api_post(path, body)
            r.raise_for_status()
            return r.json(), dict(r.headers)
        except (requests.exceptions.ConnectionError, requests.exceptions.SSLError, requests.exceptions.ReadTimeout) as e:
            if attempt < retries - 1:
                print(f"  Connection error (attempt {attempt+1}/{retries}), retrying in 10s...")
                time.sleep(10)
            else:
                raise

def api_get(path, params=None, retries=3):
    time.sleep(1.1)
    url = f"{TOGGL_API_BASE}{path}"
    for attempt in range(retries):
        try:
            r = requests.get(url, auth=auth, headers=headers, params=params, timeout=60)
            if r.status_code == 429:
                time.sleep(60)
                return api_get(path, params)
            r.raise_for_status()
            return r.json()
        except (requests.exceptions.ConnectionError, requests.exceptions.SSLError, requests.exceptions.ReadTimeout) as e:
            if attempt < retries - 1:
                time.sleep(10)
            else:
                raise

def to_utc_iso(ts_str):
    dt = dateparser.parse(str(ts_str))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S+00:00")

def to_ct_date(ts_str):
    dt = dateparser.parse(str(ts_str))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    utc_dt = dt.astimezone(timezone.utc)
    ct_dt = utc_dt + timedelta(hours=-5)  # CDT
    return ct_dt.strftime("%Y-%m-%d")

def format_dur(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    return f"{h}:{m:02d}:{s:02d}"

def db_connect():
    for attempt in range(5):
        try:
            return psycopg2.connect(NHS_DB_URL, connect_timeout=15)
        except psycopg2.OperationalError:
            if attempt < 4:
                print(f"  DB connection failed ({attempt+1}/5), retrying...")
                time.sleep(10)
            else:
                raise

def main():
    conn = db_connect()
    cur = conn.cursor()
    
    # ═══════════════════════════════════════════════════════════════════════
    # STEP 1: Delete all NHS entries since March 1
    # ═══════════════════════════════════════════════════════════════════════
    print("STEP 1: Deleting ALL NHS entries since 2026-03-01...")
    cur.execute("DELETE FROM time_entries WHERE organization_id = %s AND start_time >= '2026-03-01'", (NHS_ORG_ID,))
    deleted = cur.rowcount
    conn.commit()
    print(f"  Deleted {deleted} entries")
    
    # ═══════════════════════════════════════════════════════════════════════
    # STEP 2: Build maps
    # ═══════════════════════════════════════════════════════════════════════
    print("\nSTEP 2: Building maps...")
    cur.execute("SELECT id, email FROM users")
    nhs_users_by_email = {row[1]: row[0] for row in cur.fetchall()}
    
    toggl_users = api_get(f"/workspaces/{TOGGL_WORKSPACE_ID}/users")
    user_map = {}
    for u in toggl_users:
        uid = u.get("user_id") or u.get("id")
        email = u.get("email", "")
        if email in nhs_users_by_email:
            user_map[uid] = nhs_users_by_email[email]
    print(f"  User map: {len(user_map)} users")
    
    cur.execute("SELECT id, title FROM projects WHERE organization_id = %s", (NHS_ORG_ID,))
    nhs_projects = {row[1]: row[0] for row in cur.fetchall()}
    toggl_projects = api_get(f"/workspaces/{TOGGL_WORKSPACE_ID}/projects", {"active": "both", "per_page": 200})
    project_map = {tp["id"]: nhs_projects[tp["name"]] for tp in toggl_projects if tp["name"] in nhs_projects}
    print(f"  Project map: {len(project_map)} projects")
    
    toggl_tags = api_get(f"/workspaces/{TOGGL_WORKSPACE_ID}/tags")
    tag_map = {t["id"]: t["name"] for t in toggl_tags}
    
    # ═══════════════════════════════════════════════════════════════════════
    # STEP 3: Fetch ALL Toggl entries with proper pagination
    # ═══════════════════════════════════════════════════════════════════════
    print("\nSTEP 3: Fetching ALL Toggl entries (Mar 1 - tomorrow)...")
    
    sync_end = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    first_row_number = None
    first_id = None
    first_timestamp = None
    page = 0
    total_imported = 0
    total_skipped = 0
    toggl_by_day = defaultdict(lambda: {"count": 0, "seconds": 0})
    
    while True:
        page += 1
        body = {
            "start_date": "2026-03-01",
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
        
        entries, resp_headers = api_post(
            f"/workspace/{TOGGL_WORKSPACE_ID}/search/time_entries", body
        )
        
        if not entries:
            print(f"  No more entries (page {page})")
            break
        
        batch_values = []
        for entry in entries:
            toggl_uid = entry.get("user_id")
            description = entry.get("description", "")
            toggl_pid = entry.get("project_id")
            is_billable = entry.get("billable", True)
            entry_tag_ids = entry.get("tag_ids", [])
            entry_tags = [tag_map.get(tid, str(tid)) for tid in entry_tag_ids] if entry_tag_ids else None
            
            nhs_user_id = user_map.get(toggl_uid)
            nhs_project_id = project_map.get(toggl_pid) if toggl_pid else None
            
            if not nhs_user_id:
                total_skipped += 1
                continue
            
            for te in entry.get("time_entries", []):
                te_start = te.get("start")
                te_stop = te.get("stop")
                te_seconds = te.get("seconds", 0)
                
                if not te_start:
                    continue
                
                start_utc = to_utc_iso(te_start)
                stop_utc = to_utc_iso(te_stop) if te_stop else None
                ct_day = to_ct_date(te_start)
                
                toggl_by_day[ct_day]["count"] += 1
                toggl_by_day[ct_day]["seconds"] += te_seconds
                
                batch_values.append((
                    NHS_ORG_ID, nhs_user_id, nhs_project_id,
                    description, start_utc, stop_utc, te_seconds,
                    is_billable, json.dumps(entry_tags) if entry_tags else None,
                    False
                ))
        
        if batch_values:
            psycopg2.extras.execute_values(
                cur,
                """INSERT INTO time_entries 
                   (organization_id, user_id, project_id, description, start_time, end_time, 
                    duration_seconds, is_billable, tags, is_running)
                   VALUES %s""",
                batch_values,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
            )
            total_imported += len(batch_values)
            conn.commit()
        
        print(f"  Page {page}: {len(batch_values)} entries (total: {total_imported})")
        
        # PAGINATION: Check for next page
        next_row = resp_headers.get("X-Next-Row-Number")
        if not next_row:
            print(f"  End of results (page {page})")
            break
        
        first_row_number = int(next_row)
        first_id = int(resp_headers.get("X-Next-ID", 0)) if resp_headers.get("X-Next-ID") else None
        first_timestamp = int(resp_headers.get("X-Next-Timestamp", 0)) if resp_headers.get("X-Next-Timestamp") else None
    
    conn.commit()
    
    # ═══════════════════════════════════════════════════════════════════════
    # STEP 4: Verify
    # ═══════════════════════════════════════════════════════════════════════
    print(f"\n{'='*70}")
    print("TOGGL DAILY TOTALS (Central Time):")
    print(f"{'='*70}")
    toggl_total = 0
    for day in sorted(toggl_by_day.keys()):
        d = toggl_by_day[day]
        toggl_total += d["count"]
        print(f"  {day}: {d['count']:>3} entries  {format_dur(d['seconds'])}")
    print(f"  TOTAL: {toggl_total} entries")
    
    print(f"\n{'='*70}")
    print("NHS DAILY TOTALS (Central Time):")
    print(f"{'='*70}")
    cur.execute("""
        SELECT DATE(start_time AT TIME ZONE 'America/Chicago') as day,
               COUNT(*) as cnt, SUM(duration_seconds) as total_secs
        FROM time_entries WHERE organization_id = %s AND start_time >= '2026-03-01'
        GROUP BY DATE(start_time AT TIME ZONE 'America/Chicago')
        ORDER BY day
    """, (NHS_ORG_ID,))
    
    nhs_total = 0
    nhs_by_day = {}
    for row in cur.fetchall():
        secs = row[2] or 0
        nhs_total += row[1]
        nhs_by_day[str(row[0])] = {"count": row[1], "seconds": secs}
        print(f"  {row[0]}: {row[1]:>3} entries  {format_dur(secs)}")
    print(f"  TOTAL: {nhs_total} entries")
    
    # Compare
    print(f"\n{'='*70}")
    print("COMPARISON:")
    print(f"{'='*70}")
    all_days = sorted(set(list(toggl_by_day.keys()) + list(nhs_by_day.keys())))
    mismatches = 0
    for day in all_days:
        t = toggl_by_day.get(day, {"count": 0, "seconds": 0})
        n = nhs_by_day.get(day, {"count": 0, "seconds": 0})
        if t["count"] == n["count"] and t["seconds"] == n["seconds"]:
            print(f"  {day}: ✓ {t['count']} entries, {format_dur(t['seconds'])}")
        else:
            mismatches += 1
            print(f"  {day}: ✗ Toggl={t['count']} ({format_dur(t['seconds'])}) vs NHS={n['count']} ({format_dur(n['seconds'])})")
    
    if mismatches == 0:
        print(f"\n  ✓ ALL {len(all_days)} DAYS MATCH PERFECTLY!")
    else:
        print(f"\n  ✗ {mismatches} DAYS DO NOT MATCH")
    
    print(f"\n  Toggl total: {toggl_total} | NHS total: {nhs_total} | Skipped (no user): {total_skipped}")
    
    conn.close()

if __name__ == "__main__":
    main()
