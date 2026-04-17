#!/usr/bin/env python3
"""
Fetch Toggl time entries in yearly chunks (max 366 days) and 
properly remap project assignments in NHS database.
"""

import requests
import psycopg2
import json
import time
from datetime import datetime, timedelta

TOGGL_API_TOKEN = "34145427901ac5b6c2c8590f654169b3"
TOGGL_WORKSPACE_ID = 3639704
DB_URL = "postgresql://postgres:KXGPGFkLkkicZQoOVyixcuNNVtOlJvSo@switchback.proxy.rlwy.net:27597/railway"
SCC_INTERNAL_ID = 91

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Step 1: Build toggl_project_id -> nhs_project_id mapping
print("=== Building project mapping ===")
toggl_projects = requests.get(
    f"https://api.track.toggl.com/api/v9/workspaces/{TOGGL_WORKSPACE_ID}/projects",
    auth=(TOGGL_API_TOKEN, "api_token"),
    params={"active": "both", "per_page": 500}
).json()

# Also get page 2 if there are more
if len(toggl_projects) == 500:
    page2 = requests.get(
        f"https://api.track.toggl.com/api/v9/workspaces/{TOGGL_WORKSPACE_ID}/projects",
        auth=(TOGGL_API_TOKEN, "api_token"),
        params={"active": "both", "per_page": 500, "page": 2}
    ).json()
    toggl_projects.extend(page2)
    print(f"Fetched page 2: {len(page2)} more projects")

print(f"Total Toggl projects: {len(toggl_projects)}")

cur.execute("SELECT id, title FROM projects WHERE organization_id = 7")
nhs_proj_map = {}
for nhs_id, title in cur.fetchall():
    nhs_proj_map[title.strip().lower()] = nhs_id

toggl_to_nhs = {}
for tp in toggl_projects:
    tp_name = tp['name'].strip().lower()
    tp_id = tp['id']
    if tp_name in nhs_proj_map:
        toggl_to_nhs[tp_id] = nhs_proj_map[tp_name]

print(f"Mapped {len(toggl_to_nhs)} Toggl->NHS projects")

# Step 2: Fetch Toggl entries in yearly chunks
print("\n=== Fetching Toggl entries in yearly chunks ===")

date_ranges = [
    ("2020-01-01", "2020-12-31"),
    ("2021-01-01", "2021-12-31"),
    ("2022-01-01", "2022-12-31"),
    ("2023-01-01", "2023-12-31"),
    ("2024-01-01", "2024-12-31"),
    ("2025-01-01", "2025-12-31"),
    ("2026-01-01", "2026-04-30"),
]

all_toggl_entries = []

for start_date, end_date in date_ranges:
    first_row = 1
    chunk_entries = []
    
    while True:
        body = {
            "start_date": start_date,
            "end_date": end_date,
            "page_size": 50,
            "first_row_number": first_row,
        }
        
        resp = requests.post(
            f"https://api.track.toggl.com/reports/api/v3/workspace/{TOGGL_WORKSPACE_ID}/search/time_entries",
            auth=(TOGGL_API_TOKEN, "api_token"),
            json=body,
            headers={"Content-Type": "application/json"}
        )
        
        if resp.status_code == 429:
            print("  Rate limited, waiting 60s...")
            time.sleep(60)
            continue
        
        if resp.status_code != 200:
            print(f"  Error {resp.status_code} for {start_date}-{end_date}: {resp.text[:200]}")
            break
        
        data = resp.json()
        if not data:
            break
        
        chunk_entries.extend(data)
        
        if len(data) < 50:
            break
        
        first_row += len(data)
        time.sleep(1.5)
    
    all_toggl_entries.extend(chunk_entries)
    print(f"  {start_date} to {end_date}: {len(chunk_entries)} entries")

print(f"\nTotal Toggl entries: {len(all_toggl_entries)}")

# Step 3: Flatten and build lookup
print("\n=== Building lookup ===")

# Examine structure
if all_toggl_entries:
    sample = all_toggl_entries[0]
    print(f"Entry keys: {list(sample.keys())}")
    print(f"Sample: {json.dumps(sample, indent=2, default=str)[:600]}")

toggl_lookup = {}  # (desc_lower, start_YYYY-MM-DDTHH:MM) -> toggl_project_id
entries_with_proj = 0

for item in all_toggl_entries:
    pid = item.get('project_id')
    desc = (item.get('description') or '').strip().lower()
    
    # Each item may have multiple time_entries
    time_entries = item.get('time_entries', [])
    
    if not time_entries:
        # Item itself is a time entry
        start = item.get('start') or item.get('at') or ''
        if pid:
            entries_with_proj += 1
            start_str = str(start)[:16]
            toggl_lookup[(desc, start_str)] = pid
    else:
        for te in time_entries:
            start = te.get('start') or te.get('at') or ''
            if pid:
                entries_with_proj += 1
                start_str = str(start)[:16]
                toggl_lookup[(desc, start_str)] = pid

print(f"Entries with project: {entries_with_proj}")
print(f"Lookup size: {len(toggl_lookup)}")

# Step 4: Get NHS entries currently assigned to SCC Internal Work
# (these were the orphans we just bulk-assigned)
print("\n=== Matching NHS entries ===")

cur.execute("""
    SELECT id, description, start_time 
    FROM time_entries 
    WHERE organization_id = 7 AND project_id = %s
""", (SCC_INTERNAL_ID,))
scc_entries = cur.fetchall()
print(f"NHS entries on SCC Internal Work: {len(scc_entries)}")

remapped = 0
for nhs_id, desc, start_time in scc_entries:
    nhs_desc = (desc or '').strip().lower()
    nhs_start = start_time.strftime("%Y-%m-%dT%H:%M") if start_time else ''
    
    key = (nhs_desc, nhs_start)
    toggl_pid = toggl_lookup.get(key)
    
    if toggl_pid and toggl_pid in toggl_to_nhs and toggl_to_nhs[toggl_pid] != SCC_INTERNAL_ID:
        nhs_project_id = toggl_to_nhs[toggl_pid]
        cur.execute(
            "UPDATE time_entries SET project_id = %s WHERE id = %s",
            (nhs_project_id, nhs_id)
        )
        remapped += 1

conn.commit()
print(f"Remapped {remapped} entries from SCC Internal Work to their correct projects")

# Final stats
cur.execute("""
    SELECT p.title, COUNT(*) as cnt 
    FROM time_entries te
    JOIN projects p ON te.project_id = p.id
    WHERE te.organization_id = 7
    GROUP BY p.title
    ORDER BY cnt DESC
    LIMIT 25
""")
print("\n=== Final project distribution (top 25) ===")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

cur.execute("SELECT COUNT(*) FROM time_entries WHERE organization_id = 7 AND project_id IS NULL")
null_count = cur.fetchone()[0]
print(f"\nEntries with no project: {null_count}")

cur.close()
conn.close()
print("\nDone!")
