"""
Toggl Track → NotHubSpot Migration Script v2
=============================================
Fixed: Maps Toggl user IDs via username→email matching (Reports API uses
different user IDs than workspace_users endpoint).

Phase 1: Build user mapping (Toggl report user_id → NHS user_id via email)
Phase 2: Match/create companies (Toggl clients → NHS companies)
Phase 3: Match/create projects (with client billing rates)
Phase 4: Import project-member rates (consultant pay rates)
Phase 5: Import all time entries (paginated, rate-limited, 365-day windows)
"""

import psycopg2
import psycopg2.extras
import requests
import json
import time
import logging
from datetime import datetime, timedelta

# ─── Configuration ───────────────────────────────────────────────────────────

NHS_DB_URL = "postgresql://postgres:KXGPGFkLkkicZQoOVyixcuNNVtOlJvSo@switchback.proxy.rlwy.net:27597/railway"
NHS_ORG_ID = 7
NHS_CREATED_BY = 8  # Krista Harding
NHS_ACTIVE_STAGE = 30
NHS_CLOSED_STAGE = 32

TOGGL_EMAIL = "kharding@strategic-cc.com"
TOGGL_PASSWORD = "KHactive1!"
TOGGL_WS = 3639704
TOGGL_API = "https://api.track.toggl.com/api/v9"
TOGGL_REPORTS = "https://api.track.toggl.com/reports/api/v3"

EARLIEST_DATE = "2020-01-01"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/home/ubuntu/nohubspot/scripts/toggl_migration_v2.log')
    ]
)
log = logging.getLogger(__name__)

# ─── API Helpers ─────────────────────────────────────────────────────────────

auth = (TOGGL_EMAIL, TOGGL_PASSWORD)
hdrs = {"Content-Type": "application/json"}
req_count = 0

def toggl_get(path, params=None):
    global req_count
    req_count += 1
    time.sleep(1.1)
    r = requests.get(f"{TOGGL_API}{path}", auth=auth, headers=hdrs, params=params)
    if r.status_code == 429:
        wait = int(r.headers.get("Retry-After", 60))
        log.warning(f"Rate limited, sleeping {wait}s")
        time.sleep(wait + 5)
        return toggl_get(path, params)
    r.raise_for_status()
    return r.json()

def toggl_report(path, body):
    global req_count
    req_count += 1
    time.sleep(1.1)
    r = requests.post(f"{TOGGL_REPORTS}{path}", auth=auth, headers=hdrs, json=body)
    if r.status_code == 429:
        wait = int(r.headers.get("Retry-After", 60))
        log.warning(f"Rate limited, sleeping {wait}s")
        time.sleep(wait + 5)
        return toggl_report(path, body)
    r.raise_for_status()
    return r.json(), r.headers

# ─── Phase 1: Build User Map ────────────────────────────────────────────────

def build_user_map(conn):
    """
    The Reports API returns a different user_id than workspace_users.
    Strategy: workspace_users gives us email↔username, and Reports API gives us
    user_id↔username. We join on username to get user_id→email→nhs_user_id.
    """
    log.info("=" * 60)
    log.info("PHASE 1: USER MAPPING")
    log.info("=" * 60)
    
    cur = conn.cursor()
    
    # 1. Get workspace users: username → email
    ws_users = toggl_get(f"/workspaces/{TOGGL_WS}/workspace_users")
    ws_name_to_email = {}
    for u in ws_users:
        name = (u.get("name") or "").lower().strip()
        email = (u.get("email") or "").lower().strip()
        if name and email:
            ws_name_to_email[name] = email
    log.info(f"Workspace users: {len(ws_name_to_email)} with name→email")
    
    # 2. Get NHS users in org 7: email → nhs_user_id
    cur.execute("SELECT id, LOWER(email) FROM users WHERE organization_id = %s", (NHS_ORG_ID,))
    nhs_email_to_id = {row[1]: row[0] for row in cur.fetchall()}
    log.info(f"NHS users in org {NHS_ORG_ID}: {len(nhs_email_to_id)}")
    
    # 3. Scan reports to get report_user_id → username
    # Use a recent window to find all active users
    report_uid_to_username = {}
    
    # Scan multiple windows to catch all users
    windows = [
        ("2025-06-01", "2026-04-17"),
        ("2024-06-01", "2025-06-01"),
        ("2023-06-01", "2024-06-01"),
        ("2022-06-01", "2023-06-01"),
        ("2021-06-01", "2022-06-01"),
        ("2020-06-01", "2021-06-01"),
        ("2020-01-01", "2020-06-01"),
    ]
    
    for start, end in windows:
        body = {
            "start_date": start,
            "end_date": end,
            "page_size": 50,
            "enrich_response": True,
        }
        try:
            entries, _ = toggl_report(f"/workspace/{TOGGL_WS}/search/time_entries", body)
            for entry in entries:
                if isinstance(entry, dict):
                    uid = entry.get("user_id")
                    uname = entry.get("username", "")
                    if uid and uname and uid not in report_uid_to_username:
                        report_uid_to_username[uid] = uname
        except Exception as e:
            log.warning(f"Error scanning {start}-{end}: {e}")
    
    log.info(f"Report user IDs found: {len(report_uid_to_username)}")
    
    # 4. Join: report_user_id → username → email → nhs_user_id
    user_map = {}  # toggl_report_user_id → nhs_user_id
    
    for toggl_uid, username in report_uid_to_username.items():
        username_lower = username.lower().strip()
        
        # Match by username
        email = ws_name_to_email.get(username_lower)
        if not email:
            # Try matching by email prefix
            for ws_name, ws_email in ws_name_to_email.items():
                if ws_email.split("@")[0] == username_lower:
                    email = ws_email
                    break
        
        if not email:
            log.warning(f"  No email for Toggl user {toggl_uid} ({username})")
            continue
        
        nhs_id = nhs_email_to_id.get(email)
        if not nhs_id:
            # Create the user
            parts = username.split(" ", 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ""
            import secrets, hashlib
            pw_hash = hashlib.sha256(secrets.token_urlsafe(16).encode()).hexdigest()
            
            cur.execute("""
                INSERT INTO users (email, password_hash, first_name, last_name, organization_id, role, is_active, email_verified, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, 'user', true, false, NOW(), NOW())
                RETURNING id
            """, (email, pw_hash, first_name, last_name, NHS_ORG_ID))
            nhs_id = cur.fetchone()[0]
            nhs_email_to_id[email] = nhs_id
            log.info(f"  CREATED NHS user: [{nhs_id}] {email} ({username})")
        
        user_map[toggl_uid] = nhs_id
        log.info(f"  MAPPED: Toggl report_uid={toggl_uid} ({username}) → email={email} → NHS [{nhs_id}]")
    
    conn.commit()
    log.info(f"User mapping complete: {len(user_map)} users")
    return user_map

# ─── Phase 2: Companies ─────────────────────────────────────────────────────

def migrate_companies(conn):
    log.info("=" * 60)
    log.info("PHASE 2: COMPANIES")
    log.info("=" * 60)
    
    cur = conn.cursor()
    toggl_clients = toggl_get(f"/workspaces/{TOGGL_WS}/clients", {"status": "both"})
    log.info(f"Toggl clients: {len(toggl_clients)}")
    
    cur.execute("SELECT id, LOWER(name) FROM companies WHERE organization_id = %s", (NHS_ORG_ID,))
    nhs_companies = {row[1]: row[0] for row in cur.fetchall()}
    
    company_map = {}
    created = 0
    
    for client in toggl_clients:
        cid = client["id"]
        name = client["name"]
        name_lower = name.lower().strip()
        archived = client.get("archived", False)
        
        if name_lower in nhs_companies:
            company_map[cid] = nhs_companies[name_lower]
        else:
            # Fuzzy match
            matched = False
            for nhs_name, nhs_id in nhs_companies.items():
                if name_lower in nhs_name or nhs_name in name_lower:
                    company_map[cid] = nhs_id
                    matched = True
                    break
            
            if not matched:
                status = "Inactive" if archived else "Active"
                cur.execute("""
                    INSERT INTO companies (organization_id, name, status, contact_count, attachment_count, created_at, updated_at)
                    VALUES (%s, %s, %s, 0, 0, NOW(), NOW()) RETURNING id
                """, (NHS_ORG_ID, name, status))
                new_id = cur.fetchone()[0]
                company_map[cid] = new_id
                nhs_companies[name_lower] = new_id
                created += 1
    
    conn.commit()
    log.info(f"Companies: {len(company_map)} mapped, {created} created")
    return company_map

# ─── Phase 3: Projects ──────────────────────────────────────────────────────

def migrate_projects(conn, company_map):
    log.info("=" * 60)
    log.info("PHASE 3: PROJECTS")
    log.info("=" * 60)
    
    cur = conn.cursor()
    toggl_projects = toggl_get(f"/workspaces/{TOGGL_WS}/projects", {"active": "both", "per_page": 200})
    log.info(f"Toggl projects: {len(toggl_projects)}")
    
    cur.execute("SELECT id, LOWER(title) FROM projects WHERE organization_id = %s", (NHS_ORG_ID,))
    nhs_projects = {row[1]: row[0] for row in cur.fetchall()}
    
    project_map = {}
    created = 0
    
    for proj in toggl_projects:
        pid = proj["id"]
        name = proj["name"]
        name_lower = name.lower().strip()
        rate = proj.get("rate")
        client_id = proj.get("client_id")
        active = proj.get("active", True)
        estimated = proj.get("estimated_hours")
        start = proj.get("start_date")
        end = proj.get("end_date")
        
        if name.strip() in ["", ",/'."] :
            continue
        
        nhs_company_id = company_map.get(client_id) if client_id else None
        
        if name_lower in nhs_projects:
            project_map[pid] = nhs_projects[name_lower]
            if rate and rate > 0:
                cur.execute("UPDATE projects SET hourly_rate = %s WHERE id = %s AND (hourly_rate IS NULL OR hourly_rate = 0)",
                           (rate, nhs_projects[name_lower]))
        else:
            stage_id = NHS_ACTIVE_STAGE if active else NHS_CLOSED_STAGE
            cur.execute("""
                INSERT INTO projects (organization_id, created_by, title, hourly_rate, company_id,
                                     stage_id, is_active, start_date, projected_end_date,
                                     projected_hours, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()) RETURNING id
            """, (NHS_ORG_ID, NHS_CREATED_BY, name, rate, nhs_company_id,
                  stage_id, active, start, end, estimated))
            new_id = cur.fetchone()[0]
            project_map[pid] = new_id
            nhs_projects[name_lower] = new_id
            created += 1
    
    conn.commit()
    log.info(f"Projects: {len(project_map)} mapped, {created} created")
    return project_map

# ─── Phase 4: Rates ─────────────────────────────────────────────────────────

def migrate_rates(conn, project_map, user_map):
    log.info("=" * 60)
    log.info("PHASE 4: CONSULTANT RATES")
    log.info("=" * 60)
    
    cur = conn.cursor()
    pids = list(project_map.keys())
    all_pus = []
    
    for i in range(0, len(pids), 50):
        batch = pids[i:i+50]
        try:
            result = toggl_get(f"/workspaces/{TOGGL_WS}/project_users", {"project_ids": ",".join(str(p) for p in batch)})
            if result:
                all_pus.extend(result)
        except Exception as e:
            log.warning(f"Error fetching project users batch: {e}")
    
    log.info(f"Project-user records: {len(all_pus)}")
    
    # The project_users API also uses the same user_id as the Reports API
    cur.execute("DELETE FROM project_member_rates WHERE organization_id = %s", (NHS_ORG_ID,))
    
    imported = 0
    for pu in all_pus:
        toggl_pid = pu.get("project_id")
        toggl_uid = pu.get("user_id")
        rate = pu.get("rate")
        
        nhs_project_id = project_map.get(toggl_pid)
        nhs_user_id = user_map.get(toggl_uid)
        
        if nhs_project_id and nhs_user_id and rate and rate > 0:
            cur.execute("""
                INSERT INTO project_member_rates (organization_id, project_id, user_id, consultant_rate, created_at, updated_at)
                VALUES (%s, %s, %s, %s, NOW(), NOW()) ON CONFLICT DO NOTHING
            """, (NHS_ORG_ID, nhs_project_id, nhs_user_id, rate))
            imported += 1
    
    conn.commit()
    log.info(f"Rates imported: {imported}")
    return imported

# ─── Phase 5: Time Entries ───────────────────────────────────────────────────

def migrate_time_entries(conn, project_map, user_map):
    log.info("=" * 60)
    log.info("PHASE 5: TIME ENTRIES")
    log.info("=" * 60)
    
    cur = conn.cursor()
    cur.execute("DELETE FROM time_entries WHERE organization_id = %s", (NHS_ORG_ID,))
    conn.commit()
    
    # Get tags
    toggl_tags = toggl_get(f"/workspaces/{TOGGL_WS}/tags")
    tag_map = {t["id"]: t["name"] for t in toggl_tags}
    
    today = datetime.now()
    window_start = datetime.strptime(EARLIEST_DATE, "%Y-%m-%d")
    
    total_imported = 0
    total_skipped = 0
    
    while window_start < today:
        window_end = min(window_start + timedelta(days=365), today)
        start_str = window_start.strftime("%Y-%m-%d")
        end_str = window_end.strftime("%Y-%m-%d")
        
        log.info(f"\n--- Window: {start_str} to {end_str} ---")
        
        first_row = None
        first_id = None
        first_ts = None
        page = 0
        window_count = 0
        
        while True:
            page += 1
            body = {
                "start_date": start_str,
                "end_date": end_str,
                "page_size": 50,
                "enrich_response": True,
                "order_by": "date",
                "order_dir": "ASC",
            }
            if first_row is not None:
                body["first_row_number"] = first_row
                if first_id: body["first_id"] = first_id
                if first_ts: body["first_timestamp"] = first_ts
            
            try:
                entries, resp_headers = toggl_report(f"/workspace/{TOGGL_WS}/search/time_entries", body)
            except Exception as e:
                log.warning(f"Error on page {page}: {e}")
                time.sleep(30)
                continue
            
            if not entries:
                break
            
            window_count += len(entries)
            batch_values = []
            
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                    
                toggl_uid = entry.get("user_id")
                toggl_pid = entry.get("project_id")
                description = entry.get("description", "") or ""
                is_billable = entry.get("billable", True)
                tag_ids = entry.get("tag_ids", [])
                tags = [tag_map.get(tid, str(tid)) for tid in tag_ids] if tag_ids else None
                
                nhs_user_id = user_map.get(toggl_uid)
                nhs_project_id = project_map.get(toggl_pid) if toggl_pid else None
                
                if not nhs_user_id:
                    total_skipped += 1
                    continue
                
                time_entries_list = entry.get("time_entries", [])
                for te in time_entries_list:
                    te_start = te.get("start")
                    te_stop = te.get("stop")
                    te_seconds = te.get("seconds", 0)
                    
                    if not te_start:
                        continue
                    
                    batch_values.append((
                        NHS_ORG_ID, nhs_user_id, nhs_project_id,
                        description, te_start, te_stop, te_seconds,
                        is_billable, json.dumps(tags) if tags else None, False
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
            
            if page % 10 == 0:
                conn.commit()
                log.info(f"  Page {page}: {window_count} entries, {total_imported} total imported")
            
            next_row = resp_headers.get("X-Next-Row-Number")
            if not next_row:
                break
            first_row = int(next_row)
            first_id = int(resp_headers.get("X-Next-ID", 0)) or None
            first_ts = int(resp_headers.get("X-Next-Timestamp", 0)) or None
        
        conn.commit()
        log.info(f"  Window done: {window_count} entries fetched")
        window_start = window_end
    
    conn.commit()
    log.info(f"\nTime entries: {total_imported} imported, {total_skipped} skipped")
    return total_imported

# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    t0 = time.time()
    log.info("=" * 60)
    log.info("TOGGL → NHS MIGRATION v2")
    log.info(f"Started: {datetime.now().isoformat()}")
    log.info("=" * 60)
    
    conn = psycopg2.connect(NHS_DB_URL)
    conn.autocommit = False
    
    try:
        user_map = build_user_map(conn)
        company_map = migrate_companies(conn)
        project_map = migrate_projects(conn, company_map)
        rates = migrate_rates(conn, project_map, user_map)
        entries = migrate_time_entries(conn, project_map, user_map)
        
        elapsed = time.time() - t0
        log.info("\n" + "=" * 60)
        log.info("MIGRATION COMPLETE!")
        log.info(f"  Users: {len(user_map)}")
        log.info(f"  Companies: {len(company_map)}")
        log.info(f"  Projects: {len(project_map)}")
        log.info(f"  Rates: {rates}")
        log.info(f"  Time entries: {entries}")
        log.info(f"  API requests: {req_count}")
        log.info(f"  Elapsed: {elapsed/60:.1f} min")
        log.info("=" * 60)
    except Exception as e:
        conn.rollback()
        log.error(f"FAILED: {e}", exc_info=True)
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()
