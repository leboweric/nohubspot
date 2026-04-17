"""Debug script to understand Toggl user ID mapping issue."""
import requests
import json
import time

TOGGL_EMAIL = "kharding@strategic-cc.com"
TOGGL_PASSWORD = "KHactive1!"
TOGGL_WORKSPACE_ID = 3639704
auth = (TOGGL_EMAIL, TOGGL_PASSWORD)
headers = {"Content-Type": "application/json"}

# 1. Get workspace_users - these return user_id
print("=== WORKSPACE USERS ===")
r = requests.get(f"https://api.track.toggl.com/api/v9/workspaces/{TOGGL_WORKSPACE_ID}/workspace_users", auth=auth, headers=headers)
ws_users = r.json()
for u in ws_users:
    print(f"  workspace_user_id={u.get('id')}  user_id={u.get('user_id')}  name={u.get('name')}  email={u.get('email')}")

# Build map: user_id → info
user_id_map = {u.get("user_id"): u for u in ws_users}
ws_user_id_map = {u.get("id"): u for u in ws_users}

time.sleep(2)

# 2. Get a sample from reports API to see what user_id format it uses
print("\n=== SAMPLE REPORT ENTRIES ===")
body = {
    "start_date": "2026-03-01",
    "end_date": "2026-04-01",
    "page_size": 10,
    "enrich_response": True,
}
r = requests.post(
    f"https://api.track.toggl.com/reports/api/v3/workspace/{TOGGL_WORKSPACE_ID}/search/time_entries",
    auth=auth, headers=headers, json=body
)
entries = r.json()

seen_uids = set()
for entry in entries[:10]:
    uid = entry.get("user_id")
    seen_uids.add(uid)
    pid = entry.get("project_id")
    desc = entry.get("description", "")[:50]
    username = entry.get("username", "N/A")
    
    # Check if this uid matches user_id or workspace_user_id
    in_user_id = uid in user_id_map
    in_ws_user_id = uid in ws_user_id_map
    
    print(f"  report_user_id={uid}  in_user_id_map={in_user_id}  in_ws_user_id_map={in_ws_user_id}  username={username}  desc={desc}")

print(f"\nUnique user_ids in report sample: {seen_uids}")

time.sleep(2)

# 3. Also check project_users to see what user_id format it uses
print("\n=== SAMPLE PROJECT USERS ===")
r = requests.get(
    f"https://api.track.toggl.com/api/v9/workspaces/{TOGGL_WORKSPACE_ID}/project_users",
    auth=auth, headers=headers, params={"project_ids": "219078246"}
)
pus = r.json()
for pu in pus[:10]:
    uid = pu.get("user_id")
    pid = pu.get("project_id")
    rate = pu.get("rate")
    in_user_id = uid in user_id_map
    in_ws_user_id = uid in ws_user_id_map
    print(f"  project_user user_id={uid}  in_user_id_map={in_user_id}  in_ws_user_id_map={in_ws_user_id}  rate={rate}")
