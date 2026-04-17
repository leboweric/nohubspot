"""
Debug: Extract all unique Toggl user_ids from the Reports API
and map them to workspace_users by username/email.
"""
import requests
import json
import time

auth = ('kharding@strategic-cc.com', 'KHactive1!')
headers = {'Content-Type': 'application/json'}
WS = 3639704

# Step 1: Get workspace users (has email)
r = requests.get(f"https://api.track.toggl.com/api/v9/workspaces/{WS}/workspace_users", auth=auth, headers=headers)
ws_users = r.json()
print("=== WORKSPACE USERS ===")
ws_by_name = {}
ws_by_email = {}
for u in ws_users:
    name = u.get("name", "").lower()
    email = u.get("email", "").lower()
    ws_id = u.get("id")
    print(f"  ws_id={ws_id}  name={name}  email={email}")
    ws_by_name[name] = {"ws_id": ws_id, "email": email, "name": name}
    ws_by_email[email] = {"ws_id": ws_id, "email": email, "name": name}

time.sleep(2)

# Step 2: Get report entries and collect user_id → username
print("\n=== COLLECTING USER IDs FROM REPORTS ===")
report_user_map = {}  # toggl_user_id → username

body = {
    "start_date": "2025-06-01",
    "end_date": "2026-04-17",
    "page_size": 50,
    "enrich_response": True,
}

first_row_number = None
first_id = None
first_timestamp = None
page = 0

while page < 80:  # Max 80 pages = 4000 entries
    page += 1
    req_body = dict(body)
    if first_row_number is not None:
        req_body["first_row_number"] = first_row_number
        if first_id: req_body["first_id"] = first_id
        if first_timestamp: req_body["first_timestamp"] = first_timestamp
    
    time.sleep(1.2)
    r = requests.post(
        f"https://api.track.toggl.com/reports/api/v3/workspace/{WS}/search/time_entries",
        auth=auth, headers=headers, json=req_body
    )
    
    if r.status_code != 200:
        print(f"  Error on page {page}: {r.status_code} {r.text[:200]}")
        break
    
    data = r.json()
    if not data:
        print(f"  No more data at page {page}")
        break
    
    for entry in data:
        if isinstance(entry, dict):
            uid = entry.get("user_id")
            uname = entry.get("username", "")
            if uid and uname and uid not in report_user_map:
                report_user_map[uid] = uname
                print(f"  Found new user: toggl_id={uid} username={uname}")
    
    # Pagination
    next_row = r.headers.get("X-Next-Row-Number")
    if not next_row:
        print(f"  End of data at page {page}")
        break
    
    first_row_number = int(next_row)
    first_id = int(r.headers.get("X-Next-ID", 0)) or None
    first_timestamp = int(r.headers.get("X-Next-Timestamp", 0)) or None
    
    if page % 10 == 0:
        print(f"  ... page {page}, found {len(report_user_map)} unique users so far")

# Step 3: Map report user_ids to workspace users by username
print(f"\n=== MAPPING REPORT USER IDs → WORKSPACE USERS ({len(report_user_map)} found) ===")
for toggl_uid, username in sorted(report_user_map.items(), key=lambda x: x[1]):
    username_lower = username.lower()
    
    # Try matching by username
    matched_email = None
    if username_lower in ws_by_name:
        matched_email = ws_by_name[username_lower]["email"]
    else:
        # Try matching by email prefix
        for email, info in ws_by_email.items():
            if email.split("@")[0] == username_lower:
                matched_email = email
                break
            if info["name"].lower() == username_lower:
                matched_email = email
                break
    
    print(f"  toggl_uid={toggl_uid}  username={username}  → email={matched_email or 'NO MATCH'}")
