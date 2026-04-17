#!/usr/bin/env python3
"""
Fix project mapping for imported Toggl time entries.
Pulls entries from Toggl API with their project_ids,
then maps them to NHS projects and updates the database.
"""

import requests
import psycopg2
import json
import time
from datetime import datetime, timedelta

# Toggl config - use actual API token
TOGGL_API_TOKEN = "34145427901ac5b6c2c8590f654169b3"
TOGGL_WORKSPACE_ID = 3639704

# NHS DB
DB_URL = "postgresql://postgres:KXGPGFkLkkicZQoOVyixcuNNVtOlJvSo@switchback.proxy.rlwy.net:27597/railway"

def toggl_get(url, params=None):
    """Make authenticated GET request to Toggl API."""
    resp = requests.get(
        url,
        auth=(TOGGL_API_TOKEN, "api_token"),
        params=params,
        headers={"Content-Type": "application/json"}
    )
    if resp.status_code == 429:
        print("  Rate limited, waiting 60s...")
        time.sleep(60)
        return toggl_get(url, params)
    resp.raise_for_status()
    return resp.json()

# Step 1: Get all Toggl projects
print("=== Step 1: Fetching Toggl projects ===")
toggl_projects = toggl_get(
    f"https://api.track.toggl.com/api/v9/workspaces/{TOGGL_WORKSPACE_ID}/projects",
    params={"active": "both", "per_page": 500}
)
print(f"Found {len(toggl_projects)} Toggl projects")

# Build toggl project name -> toggl project id mapping
toggl_proj_by_id = {p['id']: p['name'] for p in toggl_projects}
toggl_proj_by_name = {p['name'].strip().lower(): p['id'] for p in toggl_projects}

# Step 2: Get NHS projects and build mapping
print("\n=== Step 2: Building NHS project mapping ===")
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

cur.execute("SELECT id, title FROM projects WHERE organization_id = 7")
nhs_projects_raw = cur.fetchall()
nhs_projects = {}
for row in nhs_projects_raw:
    nhs_projects[row[1].strip().lower()] = row[0]
print(f"Found {len(nhs_projects)} NHS projects")

# Build toggl_project_id -> nhs_project_id mapping
toggl_to_nhs_project = {}
unmatched = []

for tp in toggl_projects:
    tp_name = tp['name'].strip().lower()
    tp_id = tp['id']
    
    if tp_name in nhs_projects:
        toggl_to_nhs_project[tp_id] = nhs_projects[tp_name]
    else:
        # Try substring match
        matched = False
        for nhs_name, nhs_id in nhs_projects.items():
            if tp_name in nhs_name or nhs_name in tp_name:
                toggl_to_nhs_project[tp_id] = nhs_id
                matched = True
                break
        if not matched:
            unmatched.append((tp_id, tp['name']))

print(f"Mapped {len(toggl_to_nhs_project)} Toggl projects -> NHS projects")
if unmatched:
    print(f"Unmatched Toggl projects ({len(unmatched)}):")
    for tp_id, tp_name in unmatched[:30]:
        print(f"  #{tp_id}: {tp_name}")

# Step 3: Fetch Toggl time entries using the reports API v3
print("\n=== Step 3: Fetching Toggl time entries ===")

all_toggl_entries = []
first_row = 1

while True:
    body = {
        "start_date": "2020-01-01",
        "end_date": "2026-04-30",
        "page_size": 50,
        "first_row_number": first_row,
    }
    
    print(f"  Fetching from row {first_row}...")
    
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
        print(f"  Error {resp.status_code}: {resp.text[:200]}")
        break
    
    data = resp.json()
    
    if not data:
        print("  No more data")
        break
    
    all_toggl_entries.extend(data)
    print(f"  Got {len(data)} entries (total: {len(all_toggl_entries)})")
    
    if len(data) < 50:
        break
    
    first_row += len(data)
    time.sleep(1.5)  # Rate limit: 240 req/hr

print(f"\nTotal Toggl entries fetched: {len(all_toggl_entries)}")

# Analyze structure
if all_toggl_entries:
    sample = all_toggl_entries[0]
    print(f"Sample entry keys: {list(sample.keys())}")
    print(f"Sample: {json.dumps(sample, indent=2, default=str)[:500]}")
    
    # The reports API returns grouped entries - each item may have time_entries array
    # Let's flatten
    flat_entries = []
    for item in all_toggl_entries:
        if 'time_entries' in item:
            for te in item['time_entries']:
                te['_project_id'] = item.get('project_id')
                te['_description'] = item.get('description', '')
                flat_entries.append(te)
        else:
            flat_entries.append(item)
    
    print(f"Flattened to {len(flat_entries)} individual entries")
    
    if flat_entries:
        sample = flat_entries[0]
        print(f"Flat entry keys: {list(sample.keys())}")
        print(f"Flat sample: {json.dumps(sample, indent=2, default=str)[:500]}")
    
    # Build lookup: (description_lower, start_date_hour) -> toggl_project_id
    toggl_lookup = {}
    entries_with_project = 0
    
    for te in flat_entries:
        desc = (te.get('_description') or te.get('description') or '').strip().lower()
        start = te.get('start') or te.get('at') or ''
        pid = te.get('_project_id') or te.get('project_id')
        
        if pid:
            entries_with_project += 1
        
        if pid and start:
            # Normalize to YYYY-MM-DDTHH:MM
            start_str = str(start)[:16]
            key = (desc, start_str)
            toggl_lookup[key] = pid
    
    print(f"\nToggl entries with project: {entries_with_project}")
    print(f"Toggl lookup size: {len(toggl_lookup)}")
    
    # Step 4: Match NHS orphans to Toggl entries
    print("\n=== Step 4: Matching NHS entries ===")
    
    cur.execute("""
        SELECT id, description, user_id, start_time, duration_seconds 
        FROM time_entries 
        WHERE organization_id = 7 AND project_id IS NULL
    """)
    nhs_orphans = cur.fetchall()
    print(f"NHS entries without project: {len(nhs_orphans)}")
    
    matched_updates = []
    for nhs_id, desc, user_id, start_time, duration in nhs_orphans:
        nhs_desc = (desc or '').strip().lower()
        nhs_start = start_time.strftime("%Y-%m-%dT%H:%M") if start_time else ''
        
        key = (nhs_desc, nhs_start)
        toggl_pid = toggl_lookup.get(key)
        
        if toggl_pid and toggl_pid in toggl_to_nhs_project:
            nhs_project_id = toggl_to_nhs_project[toggl_pid]
            matched_updates.append((nhs_project_id, nhs_id))
    
    print(f"Matched {len(matched_updates)} entries via description+start_time")
    
    # Apply updates
    if matched_updates:
        for nhs_project_id, nhs_id in matched_updates:
            cur.execute(
                "UPDATE time_entries SET project_id = %s WHERE id = %s",
                (nhs_project_id, nhs_id)
            )
        conn.commit()
        print(f"Updated {len(matched_updates)} entries")

# Step 5: Check remaining orphans and assign SCC Internal Work as catch-all
print("\n=== Step 5: Assigning remaining orphans to SCC Internal Work ===")

# Get SCC Internal Work project id
SCC_INTERNAL_ID = 91  # From diagnostic

cur.execute("""
    SELECT COUNT(*) FROM time_entries 
    WHERE organization_id = 7 AND project_id IS NULL
""")
remaining = cur.fetchone()[0]
print(f"Remaining entries without project: {remaining}")

if remaining > 0:
    # Assign all remaining to SCC Internal Work
    cur.execute("""
        UPDATE time_entries 
        SET project_id = %s 
        WHERE organization_id = 7 AND project_id IS NULL
    """, (SCC_INTERNAL_ID,))
    conn.commit()
    print(f"Assigned {remaining} entries to SCC Internal Work (id={SCC_INTERNAL_ID})")

# Final stats
cur.execute("SELECT COUNT(*) FROM time_entries WHERE organization_id = 7 AND project_id IS NOT NULL")
final_with = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM time_entries WHERE organization_id = 7")
final_total = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM time_entries WHERE organization_id = 7 AND project_id IS NULL")
final_null = cur.fetchone()[0]

print(f"\n=== Final Stats ===")
print(f"Total entries: {final_total}")
print(f"With project: {final_with} ({final_with*100//final_total}%)")
print(f"Without project: {final_null}")

# Show distribution
cur.execute("""
    SELECT p.title, COUNT(*) as cnt 
    FROM time_entries te
    JOIN projects p ON te.project_id = p.id
    WHERE te.organization_id = 7
    GROUP BY p.title
    ORDER BY cnt DESC
    LIMIT 20
""")
print("\n--- Top 20 projects by entry count ---")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

cur.close()
conn.close()
print("\nDone!")
