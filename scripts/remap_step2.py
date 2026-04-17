#!/usr/bin/env python3
"""
Step 2 of remapping: Use the Toggl data already fetched (11,700 entries from 2020-2022 + partial 2023)
to remap NHS entries from SCC Internal Work to their correct projects.
Also fetch remaining 2023-2026 data (API quota should have reset by now).
"""

import requests
import psycopg2
import json
import time

TOGGL_API_TOKEN = "34145427901ac5b6c2c8590f654169b3"
TOGGL_WORKSPACE_ID = 3639704
DB_URL = "postgresql://postgres:KXGPGFkLkkicZQoOVyixcuNNVtOlJvSo@switchback.proxy.rlwy.net:27597/railway"
SCC_INTERNAL_ID = 91

# Step 1: Build project mapping
print("=== Building project mapping ===")
toggl_projects_p1 = requests.get(
    f"https://api.track.toggl.com/api/v9/workspaces/{TOGGL_WORKSPACE_ID}/projects",
    auth=(TOGGL_API_TOKEN, "api_token"),
    params={"active": "both", "per_page": 500}
).json()
time.sleep(1)
toggl_projects_p2 = requests.get(
    f"https://api.track.toggl.com/api/v9/workspaces/{TOGGL_WORKSPACE_ID}/projects",
    auth=(TOGGL_API_TOKEN, "api_token"),
    params={"active": "both", "per_page": 500, "page": 2}
).json()
toggl_projects = toggl_projects_p1 + toggl_projects_p2
print(f"Total Toggl projects: {len(toggl_projects)}")

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

cur.execute("SELECT id, title FROM projects WHERE organization_id = 7")
nhs_proj_map = {row[1].strip().lower(): row[0] for row in cur.fetchall()}

toggl_to_nhs = {}
for tp in toggl_projects:
    tp_name = tp['name'].strip().lower()
    tp_id = tp['id']
    if tp_name in nhs_proj_map:
        toggl_to_nhs[tp_id] = nhs_proj_map[tp_name]
    else:
        for nhs_name, nhs_id in nhs_proj_map.items():
            if tp_name in nhs_name or nhs_name in tp_name:
                toggl_to_nhs[tp_id] = nhs_id
                break

print(f"Mapped {len(toggl_to_nhs)} Toggl->NHS projects")

# Step 2: Fetch ALL Toggl entries (all years)
print("\n=== Fetching Toggl entries ===")
date_ranges = [
    ("2020-01-01", "2020-12-31"),
    ("2021-01-01", "2021-12-31"),
    ("2022-01-01", "2022-12-31"),
    ("2023-01-01", "2023-12-31"),
    ("2024-01-01", "2024-12-31"),
    ("2025-01-01", "2025-12-31"),
    ("2026-01-01", "2026-04-30"),
]

all_entries = []
for start_date, end_date in date_ranges:
    first_row = 1
    chunk = []
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
        if resp.status_code == 429 or resp.status_code == 402:
            print(f"  Rate limited ({resp.status_code}), waiting 60s...")
            time.sleep(60)
            continue
        if resp.status_code != 200:
            print(f"  Error {resp.status_code} for {start_date}: {resp.text[:100]}")
            break
        data = resp.json()
        if not data:
            break
        chunk.extend(data)
        if len(data) < 50:
            break
        first_row += len(data)
        time.sleep(1.5)
    
    all_entries.extend(chunk)
    print(f"  {start_date} to {end_date}: {len(chunk)} entries")

print(f"Total Toggl entries: {len(all_entries)}")

# Step 3: Build lookup
print("\n=== Building lookup ===")
toggl_lookup = {}
for item in all_entries:
    pid = item.get('project_id')
    desc = (item.get('description') or '').strip().lower()
    for te in item.get('time_entries', []):
        start = te.get('start', '')
        if pid and start:
            start_str = str(start)[:16]
            toggl_lookup[(desc, start_str)] = pid

print(f"Lookup size: {len(toggl_lookup)}")

# Step 4: Remap NHS entries
print("\n=== Remapping NHS entries ===")
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
        cur.execute("UPDATE time_entries SET project_id = %s WHERE id = %s", (nhs_project_id, nhs_id))
        remapped += 1

conn.commit()
print(f"Remapped {remapped} entries to correct projects")

# Final stats
cur.execute("""
    SELECT p.title, COUNT(*) as cnt 
    FROM time_entries te JOIN projects p ON te.project_id = p.id
    WHERE te.organization_id = 7
    GROUP BY p.title ORDER BY cnt DESC LIMIT 25
""")
print("\n=== Final distribution (top 25) ===")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

cur.execute("SELECT COUNT(*) FROM time_entries WHERE organization_id = 7 AND project_id IS NULL")
print(f"\nEntries with no project: {cur.fetchone()[0]}")

cur.close()
conn.close()
print("\nDone!")
