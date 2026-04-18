"""
Chunked Re-Sync: Fetch Toggl data in weekly chunks to work around
the Reports API's apparent 200-entry limit per search.

Then compare day-by-day with NHS.
"""
import psycopg2
import psycopg2.extras
import requests
import json
import time
from datetime import datetime, timedelta, timezone, date
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
                print(f"  Connection error ({attempt+1}/{retries}), retrying...")
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
    ct_dt = utc_dt + timedelta(hours=-5)
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
                time.sleep(10)
            else:
                raise

def fetch_toggl_chunk(start_date, end_date, user_map, project_map, tag_map):
    """Fetch all Toggl entries for a date range, with pagination."""
    all_rows = []
    first_row_number = None
    first_id = None
    first_timestamp = None
    page = 0
    
    while True:
        page += 1
        body = {
            "start_date": start_date,
            "end_date": end_date,
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
            break
        
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
                continue
            
            for te in entry.get("time_entries", []):
                te_start = te.get("start")
                te_stop = te.get("stop")
                te_seconds = te.get("seconds", 0)
                
                if not te_start:
                    continue
                
                all_rows.append({
                    "nhs_user_id": nhs_user_id,
                    "nhs_project_id": nhs_project_id,
                    "description": description,
                    "start_utc": to_utc_iso(te_start),
                    "stop_utc": to_utc_iso(te_stop) if te_stop else None,
                    "seconds": te_seconds,
                    "is_billable": is_billable,
                    "tags": json.dumps(entry_tags) if entry_tags else None,
                    "ct_date": to_ct_date(te_start),
                })
        
        next_row = resp_headers.get("X-Next-Row-Number")
        if not next_row:
            break
        first_row_number = int(next_row)
        first_id = int(resp_headers.get("X-Next-ID", 0)) if resp_headers.get("X-Next-ID") else None
        first_timestamp = int(resp_headers.get("X-Next-Timestamp", 0)) if resp_headers.get("X-Next-Timestamp") else None
    
    return all_rows

def main():
    conn = db_connect()
    cur = conn.cursor()
    
    # Delete all
    print("Deleting ALL NHS entries since 2026-03-01...")
    cur.execute("DELETE FROM time_entries WHERE organization_id = %s AND start_time >= '2026-03-01'", (NHS_ORG_ID,))
    print(f"  Deleted {cur.rowcount} entries")
    conn.commit()
    
    # Build maps
    print("Building maps...")
    cur.execute("SELECT id, email FROM users")
    nhs_users_by_email = {row[1]: row[0] for row in cur.fetchall()}
    
    toggl_users = api_get(f"/workspaces/{TOGGL_WORKSPACE_ID}/users")
    user_map = {}
    for u in toggl_users:
        uid = u.get("user_id") or u.get("id")
        email = u.get("email", "")
        if email in nhs_users_by_email:
            user_map[uid] = nhs_users_by_email[email]
    
    cur.execute("SELECT id, title FROM projects WHERE organization_id = %s", (NHS_ORG_ID,))
    nhs_projects = {row[1]: row[0] for row in cur.fetchall()}
    toggl_projects = api_get(f"/workspaces/{TOGGL_WORKSPACE_ID}/projects", {"active": "both", "per_page": 200})
    project_map = {tp["id"]: nhs_projects[tp["name"]] for tp in toggl_projects if tp["name"] in nhs_projects}
    
    toggl_tags = api_get(f"/workspaces/{TOGGL_WORKSPACE_ID}/tags")
    tag_map = {t["id"]: t["name"] for t in toggl_tags}
    
    # Fetch in weekly chunks
    print("\nFetching Toggl entries in weekly chunks...")
    all_toggl_rows = []
    
    chunk_start = date(2026, 3, 1)
    chunk_end_limit = date(2026, 4, 19)
    
    while chunk_start < chunk_end_limit:
        chunk_end = min(chunk_start + timedelta(days=7), chunk_end_limit)
        print(f"  Chunk: {chunk_start} to {chunk_end}...")
        
        rows = fetch_toggl_chunk(
            chunk_start.strftime("%Y-%m-%d"),
            chunk_end.strftime("%Y-%m-%d"),
            user_map, project_map, tag_map
        )
        all_toggl_rows.extend(rows)
        print(f"    Got {len(rows)} entries (running total: {len(all_toggl_rows)})")
        
        chunk_start = chunk_end
    
    print(f"\nTotal Toggl entries: {len(all_toggl_rows)}")
    
    # Insert into NHS
    print("Inserting into NHS...")
    batch_values = [
        (NHS_ORG_ID, r["nhs_user_id"], r["nhs_project_id"],
         r["description"], r["start_utc"], r["stop_utc"], r["seconds"],
         r["is_billable"], r["tags"], False)
        for r in all_toggl_rows
    ]
    
    if batch_values:
        # Insert in batches of 100 to avoid memory issues
        for i in range(0, len(batch_values), 100):
            batch = batch_values[i:i+100]
            psycopg2.extras.execute_values(
                cur,
                """INSERT INTO time_entries 
                   (organization_id, user_id, project_id, description, start_time, end_time, 
                    duration_seconds, is_billable, tags, is_running)
                   VALUES %s""",
                batch,
                template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
            )
            conn.commit()
    
    print(f"  Imported {len(batch_values)} entries")
    
    # Toggl daily totals
    toggl_by_day = defaultdict(lambda: {"count": 0, "seconds": 0})
    for r in all_toggl_rows:
        toggl_by_day[r["ct_date"]]["count"] += 1
        toggl_by_day[r["ct_date"]]["seconds"] += r["seconds"]
    
    # NHS daily totals
    cur.execute("""
        SELECT DATE(start_time AT TIME ZONE 'America/Chicago') as day,
               COUNT(*) as cnt, SUM(duration_seconds) as total_secs
        FROM time_entries WHERE organization_id = %s AND start_time >= '2026-03-01'
        GROUP BY DATE(start_time AT TIME ZONE 'America/Chicago')
        ORDER BY day
    """, (NHS_ORG_ID,))
    
    nhs_by_day = {}
    for row in cur.fetchall():
        nhs_by_day[str(row[0])] = {"count": row[1], "seconds": row[2] or 0}
    
    # Compare
    print(f"\n{'='*70}")
    print("DAY-BY-DAY COMPARISON:")
    print(f"{'='*70}")
    all_days = sorted(set(list(toggl_by_day.keys()) + list(nhs_by_day.keys())))
    mismatches = 0
    for day in all_days:
        t = toggl_by_day.get(day, {"count": 0, "seconds": 0})
        n = nhs_by_day.get(day, {"count": 0, "seconds": 0})
        if t["count"] == n["count"] and t["seconds"] == n["seconds"]:
            print(f"  {day}: ✓ {t['count']:>3} entries  {format_dur(t['seconds'])}")
        else:
            mismatches += 1
            print(f"  {day}: ✗ Toggl={t['count']} ({format_dur(t['seconds'])}) vs NHS={n['count']} ({format_dur(n['seconds'])})")
    
    toggl_total = sum(d["count"] for d in toggl_by_day.values())
    nhs_total = sum(d["count"] for d in nhs_by_day.values())
    
    if mismatches == 0:
        print(f"\n  ✓ ALL {len(all_days)} DAYS MATCH PERFECTLY!")
    else:
        print(f"\n  ✗ {mismatches} DAYS DO NOT MATCH")
    
    print(f"  Toggl total: {toggl_total} | NHS total: {nhs_total}")
    
    conn.close()

if __name__ == "__main__":
    main()
