"""
Toggl API Data Inventory Script
Checks what data is available and how much exists in the SCC workspace.
"""
import requests
import json
from datetime import datetime, timedelta

auth = ('kharding@strategic-cc.com', 'KHactive1!')
base = 'https://api.track.toggl.com/api/v9'
WID = 3639704
headers = {'Content-Type': 'application/json'}

def get(path, params=None):
    r = requests.get(f'{base}{path}', auth=auth, headers=headers, params=params)
    return r

print("=" * 60)
print("TOGGL API DATA INVENTORY - SCC Workspace")
print("=" * 60)

# 1. Clients
print("\n--- CLIENTS ---")
r = get(f'/workspaces/{WID}/clients', {'status': 'both'})
if r.status_code == 200:
    clients = r.json()
    print(f"Total clients: {len(clients)}")
    for c in clients[:5]:
        print(f"  [{c['id']}] {c['name']} (archived: {c.get('archived', False)})")
    if len(clients) > 5:
        print(f"  ... and {len(clients) - 5} more")
else:
    print(f"Error {r.status_code}: {r.text[:200]}")

# 2. Projects
print("\n--- PROJECTS ---")
r = get(f'/workspaces/{WID}/projects', {'active': 'both', 'per_page': 200})
if r.status_code == 200:
    projects = r.json()
    print(f"Total projects: {len(projects)}")
    billable_count = sum(1 for p in projects if p.get('billable'))
    active_count = sum(1 for p in projects if p.get('active'))
    with_rate = sum(1 for p in projects if p.get('rate'))
    with_client = sum(1 for p in projects if p.get('client_id'))
    print(f"  Active: {active_count}, Archived: {len(projects) - active_count}")
    print(f"  Billable: {billable_count}, With rate: {with_rate}, With client: {with_client}")
    for p in projects[:5]:
        print(f"  [{p['id']}] {p['name']} (client_id: {p.get('client_id')}, rate: {p.get('rate')}, billable: {p.get('billable')})")
    if len(projects) > 5:
        print(f"  ... and {len(projects) - 5} more")
else:
    print(f"Error {r.status_code}: {r.text[:200]}")

# 3. Tags
print("\n--- TAGS ---")
r = get(f'/workspaces/{WID}/tags')
if r.status_code == 200:
    tags = r.json()
    print(f"Total tags: {len(tags)}")
    for t in tags:
        print(f"  [{t['id']}] {t['name']}")
else:
    print(f"Error {r.status_code}: {r.text[:200]}")

# 4. Workspace members
print("\n--- WORKSPACE MEMBERS ---")
r = get(f'/workspaces/{WID}/workspace_users')
if r.status_code == 200:
    members = r.json()
    print(f"Total members: {len(members)}")
    for m in members:
        print(f"  [{m.get('user_id', m.get('id'))}] {m.get('name', 'N/A')} - role: {m.get('role', 'N/A')} (active: {m.get('active', 'N/A')})")
else:
    print(f"Error {r.status_code}: {r.text[:200]}")
    # Try organization members instead
    r2 = get(f'/organizations/{WID}/users')
    if r2.status_code == 200:
        print("  (via org endpoint)")
        for m in r2.json()[:5]:
            print(f"  {json.dumps(m, indent=2)[:200]}")

# 5. Time entries - check volume via user's own entries
print("\n--- TIME ENTRIES (user's own) ---")
# Get entries from the last year
start = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
end = datetime.now().strftime('%Y-%m-%d')
r = get(f'/me/time_entries', {'start_date': start, 'end_date': end})
if r.status_code == 200:
    entries = r.json()
    print(f"User's entries (last 365 days): {len(entries)}")
    if entries:
        print(f"  Earliest: {entries[-1].get('start', '')[:10]}")
        print(f"  Latest: {entries[0].get('start', '')[:10]}")
        # Sample entry
        e = entries[0]
        print(f"  Sample entry keys: {list(e.keys())}")
else:
    print(f"Error {r.status_code}: {r.text[:200]}")

# 6. Reports API - Detailed (gets ALL users' entries)
print("\n--- REPORTS API (Detailed - all users) ---")
reports_base = 'https://api.track.toggl.com/reports/api/v3'
r = requests.post(
    f'{reports_base}/workspace/{WID}/search/time_entries',
    auth=auth,
    headers=headers,
    json={
        'start_date': start,
        'end_date': end,
        'page_size': 50,
        'enrich_response': True
    }
)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    entries = r.json()
    print(f"First page entries: {len(entries)}")
    print(f"X-Next-ID: {r.headers.get('X-Next-ID', 'N/A')}")
    print(f"X-Next-Row-Number: {r.headers.get('X-Next-Row-Number', 'N/A')}")
    if entries:
        e = entries[0]
        print(f"  Sample entry keys: {list(e.keys())}")
        print(f"  user_id: {e.get('user_id')}, project_id: {e.get('project_id')}")
        print(f"  description: {e.get('description', '')[:60]}")
        print(f"  billable: {e.get('billable')}")
else:
    print(f"Error: {r.text[:300]}")

# 7. Check if we can get project users/rates
print("\n--- PROJECT USERS (rates) ---")
if projects:
    sample_pid = projects[0]['id']
    r = get(f'/workspaces/{WID}/project_users', {'project_ids': str(sample_pid)})
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        pusers = r.json()
        print(f"Project users for project {sample_pid}: {len(pusers)}")
        for pu in pusers[:3]:
            print(f"  {json.dumps(pu, indent=2)[:200]}")
    else:
        print(f"Error: {r.text[:200]}")

# 8. Check total entries via totals endpoint
print("\n--- REPORT TOTALS ---")
r = requests.post(
    f'{reports_base}/workspace/{WID}/search/time_entries/totals',
    auth=auth,
    headers=headers,
    json={
        'start_date': '2020-01-01',
        'end_date': end,
    }
)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    totals = r.json()
    print(f"Totals: {json.dumps(totals, indent=2)[:500]}")
else:
    print(f"Error: {r.text[:300]}")

print("\n--- QUOTA CHECK ---")
print(f"Quota remaining: {r.headers.get('X-Toggl-Quota-Remaining', 'N/A')}")
print(f"Quota resets in: {r.headers.get('X-Toggl-Quota-Resets-In', 'N/A')}s")
