"""
Backfill hourly_rate_cents and billable_amount_cents from Toggl API
into all existing NHS time_entries.

Toggl Reports API returns hourly_rate_in_cents and billable_amount_in_cents
per entry. We match by user_id + start_time to update NHS records.
"""
import requests, psycopg2, time
from datetime import datetime, timedelta

TOGGL_API_TOKEN = "34145427901ac5b6c2c8590f654169b3"
WS = 3639704
DB_URL = "postgresql://postgres:KXGPGFkLkkicZQoOVyixcuNNVtOlJvSo@switchback.proxy.rlwy.net:27597/railway"
ORG_ID = 7

auth = (TOGGL_API_TOKEN, "api_token")
headers = {"Content-Type": "application/json"}

# Build Toggl user_id -> NHS user_id mapping
conn = psycopg2.connect(DB_URL, connect_timeout=15)
cur = conn.cursor()

# Get the toggl_user_id mapping from the users table or toggl_user_map
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE '%toggl%'")
toggl_cols = [r[0] for r in cur.fetchall()]
print(f"Toggl columns in users table: {toggl_cols}")

# Get the mapping from the sync script's approach - check toggl_user_map table
cur.execute("""
    SELECT table_name FROM information_schema.tables 
    WHERE table_name LIKE '%toggl%' OR table_name LIKE '%user_map%'
""")
tables = [r[0] for r in cur.fetchall()]
print(f"Toggl-related tables: {tables}")

# Build mapping by fetching Toggl users and matching by name
r = requests.get(f"https://api.track.toggl.com/api/v9/workspaces/{WS}/users",
                 auth=auth, headers=headers, timeout=30)
toggl_users = r.json()

cur.execute("SELECT id, first_name, last_name, email FROM users WHERE organization_id = %s", (ORG_ID,))
nhs_users = cur.fetchall()

# Match by name (case-insensitive)
toggl_to_nhs = {}
for tu in toggl_users:
    tname = (tu.get('fullname') or tu.get('name') or '').lower().strip()
    for nu in nhs_users:
        nname = f"{nu[1]} {nu[2]}".lower().strip()
        # Also check email prefix
        email_prefix = nu[3].split('@')[0].lower() if nu[3] else ''
        if tname and (tname == nname or tname in nname or nname in tname or tname == email_prefix):
            toggl_to_nhs[tu['id']] = nu[0]
            break

print(f"\nToggl->NHS user mapping ({len(toggl_to_nhs)} mapped):")
for tid, nid in toggl_to_nhs.items():
    tname = next((u.get('fullname') or u.get('name') for u in toggl_users if u['id'] == tid), '?')
    nname = next((f"{u[1]} {u[2]}" for u in nhs_users if u[0] == nid), '?')
    print(f"  Toggl {tid} ({tname}) -> NHS {nid} ({nname})")

# Fetch all Toggl entries in weekly chunks and collect rate data
print("\n=== Fetching Toggl entries with rate data ===")
toggl_rates = {}  # key: (nhs_user_id, start_epoch) -> (hourly_rate_cents, billable_amount_cents)

start = datetime(2026, 3, 1)
end = datetime(2026, 4, 19)
chunk_start = start

while chunk_start < end:
    chunk_end = min(chunk_start + timedelta(days=7), end)
    sd = chunk_start.strftime('%Y-%m-%d')
    ed = chunk_end.strftime('%Y-%m-%d')
    
    payload = {
        'start_date': sd,
        'end_date': ed,
        'page_size': 50
    }
    
    page_count = 0
    while True:
        for attempt in range(3):
            try:
                r = requests.post(
                    f'https://api.track.toggl.com/reports/api/v3/workspace/{WS}/search/time_entries',
                    auth=auth, headers=headers, json=payload, timeout=60
                )
                break
            except Exception as e:
                print(f"  Retry {attempt+1}: {e}")
                time.sleep(5)
        
        if r.status_code != 200:
            print(f"  Error {r.status_code}: {r.text[:200]}")
            break
        
        entries = r.json()
        if not entries:
            break
        
        page_count += 1
        
        for entry in entries:
            toggl_uid = entry.get('user_id')
            nhs_uid = toggl_to_nhs.get(toggl_uid)
            if not nhs_uid:
                continue
            
            rate_cents = entry.get('hourly_rate_in_cents', 0) or 0
            
            for te in entry.get('time_entries', []):
                start_str = te.get('start', '')
                seconds = te.get('seconds', 0)
                # Calculate billable amount: rate * hours
                amount_cents = entry.get('billable_amount_in_cents', 0) or 0
                # For grouped entries, we need per-entry amount
                # If there are multiple time_entries, divide proportionally
                total_seconds = sum(t.get('seconds', 0) for t in entry.get('time_entries', []))
                if total_seconds > 0 and len(entry.get('time_entries', [])) > 1:
                    entry_amount = int(amount_cents * seconds / total_seconds)
                else:
                    entry_amount = amount_cents
                
                # Parse start time to epoch for matching
                from dateutil.parser import parse as dtparse
                try:
                    dt = dtparse(start_str)
                    epoch = int(dt.timestamp())
                    toggl_rates[(nhs_uid, epoch)] = (rate_cents, entry_amount)
                except:
                    pass
        
        # Check for next page
        next_token = r.headers.get('x-next-row-number')
        if not next_token or len(entries) < 50:
            break
        payload['first_row_number'] = int(next_token)
        time.sleep(0.5)
    
    print(f"  {sd} to {ed}: {page_count} pages")
    chunk_start = chunk_end
    time.sleep(1)

print(f"\nCollected rates for {len(toggl_rates)} entries")

# Now match and update NHS entries
print("\n=== Updating NHS entries ===")
cur.execute("""
    SELECT id, user_id, start_time, duration_seconds 
    FROM time_entries 
    WHERE organization_id = %s
    ORDER BY start_time
""", (ORG_ID,))
nhs_entries = cur.fetchall()
print(f"NHS entries to update: {len(nhs_entries)}")

updated = 0
not_found = 0
for eid, uid, st, dur in nhs_entries:
    epoch = int(st.timestamp())
    key = (uid, epoch)
    if key in toggl_rates:
        rate_cents, amount_cents = toggl_rates[key]
        cur.execute("""
            UPDATE time_entries 
            SET hourly_rate_cents = %s, billable_amount_cents = %s
            WHERE id = %s
        """, (rate_cents, amount_cents, eid))
        updated += 1
    else:
        not_found += 1

conn.commit()
print(f"Updated: {updated}, Not found in Toggl: {not_found}")

# Verify with a sample
cur.execute("""
    SELECT te.id, u.first_name || ' ' || u.last_name, te.description, 
           te.hourly_rate_cents, te.billable_amount_cents, te.duration_seconds
    FROM time_entries te
    JOIN users u ON te.user_id = u.id
    WHERE te.organization_id = %s AND te.hourly_rate_cents > 0
    ORDER BY te.start_time DESC
    LIMIT 10
""", (ORG_ID,))
print("\nSample updated entries:")
for r in cur.fetchall():
    rate = r[3] / 100
    amount = r[4] / 100
    hours = (r[5] or 0) / 3600
    print(f"  {r[1]:25s} | ${rate:>7.2f}/hr | ${amount:>8.2f} | {hours:.2f}h | {r[2][:50] if r[2] else ''}")

conn.close()
print("\nDone!")
