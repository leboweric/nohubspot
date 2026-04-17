"""
Toggl Track → NotHubSpot Migration Script
==========================================
Pulls all historical data from Toggl and imports into NHS PostgreSQL database.

Phase 1: Match/create users
Phase 2: Match/create companies (Toggl clients → NHS companies)
Phase 3: Match/create projects (with client billing rates)
Phase 4: Import project-member rates (consultant pay rates)
Phase 5: Import all time entries (paginated, rate-limited)
"""

import psycopg2
import psycopg2.extras
import requests
import json
import time
import logging
import hashlib
from datetime import datetime, timedelta

# ─── Configuration ───────────────────────────────────────────────────────────

NHS_DB_URL = "postgresql://postgres:KXGPGFkLkkicZQoOVyixcuNNVtOlJvSo@switchback.proxy.rlwy.net:27597/railway"
NHS_ORG_ID = 7  # Strategic Consulting & Coaching, LLC
NHS_CREATED_BY = 8  # Krista Harding's NHS user ID (owner)
NHS_DEFAULT_STAGE_ID = 30  # "Active" stage for org 7

TOGGL_EMAIL = "kharding@strategic-cc.com"
TOGGL_PASSWORD = "KHactive1!"
TOGGL_WORKSPACE_ID = 3639704
TOGGL_API_BASE = "https://api.track.toggl.com/api/v9"
TOGGL_REPORTS_BASE = "https://api.track.toggl.com/reports/api/v3"

# How far back to pull time entries (Toggl was founded 2006, SCC likely started ~2020)
EARLIEST_DATE = "2020-01-01"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/home/ubuntu/nohubspot/scripts/toggl_migration.log')
    ]
)
log = logging.getLogger(__name__)

# ─── Toggl API Helpers ───────────────────────────────────────────────────────

toggl_auth = (TOGGL_EMAIL, TOGGL_PASSWORD)
toggl_headers = {"Content-Type": "application/json"}
request_count = 0
quota_remaining = 240

def toggl_get(path, params=None):
    """GET from Toggl Track API v9 with rate limiting."""
    global request_count, quota_remaining
    request_count += 1
    
    # Rate limit: 1 req/sec sustained
    time.sleep(1.1)
    
    url = f"{TOGGL_API_BASE}{path}"
    r = requests.get(url, auth=toggl_auth, headers=toggl_headers, params=params)
    
    quota_remaining = int(r.headers.get("X-Toggl-Quota-Remaining", 240))
    if quota_remaining < 10:
        wait_time = int(r.headers.get("X-Toggl-Quota-Resets-In", 60))
        log.warning(f"Quota low ({quota_remaining}), sleeping {wait_time}s...")
        time.sleep(wait_time + 5)
    
    if r.status_code == 429:
        wait_time = int(r.headers.get("Retry-After", 60))
        log.warning(f"Rate limited! Sleeping {wait_time}s...")
        time.sleep(wait_time + 5)
        return toggl_get(path, params)  # Retry
    
    r.raise_for_status()
    return r.json()

def toggl_reports_post(path, body):
    """POST to Toggl Reports API v3 with rate limiting."""
    global request_count, quota_remaining
    request_count += 1
    
    time.sleep(1.1)
    
    url = f"{TOGGL_REPORTS_BASE}{path}"
    r = requests.post(url, auth=toggl_auth, headers=toggl_headers, json=body)
    
    quota_remaining = int(r.headers.get("X-Toggl-Quota-Remaining", 240))
    if quota_remaining < 10:
        wait_time = int(r.headers.get("X-Toggl-Quota-Resets-In", 60))
        log.warning(f"Quota low ({quota_remaining}), sleeping {wait_time}s...")
        time.sleep(wait_time + 5)
    
    if r.status_code == 429:
        wait_time = int(r.headers.get("Retry-After", 60))
        log.warning(f"Rate limited! Sleeping {wait_time}s...")
        time.sleep(wait_time + 5)
        return toggl_reports_post(path, body)
    
    r.raise_for_status()
    return r.json(), r.headers

# ─── Database Connection ─────────────────────────────────────────────────────

def get_db():
    conn = psycopg2.connect(NHS_DB_URL)
    conn.autocommit = False
    return conn

# ─── Phase 1: Users ─────────────────────────────────────────────────────────

def migrate_users(conn):
    """Match Toggl members to NHS users, create missing ones."""
    log.info("=" * 60)
    log.info("PHASE 1: USER MATCHING/CREATION")
    log.info("=" * 60)
    
    cur = conn.cursor()
    
    # Get Toggl workspace members
    toggl_members = toggl_get(f"/workspaces/{TOGGL_WORKSPACE_ID}/workspace_users")
    log.info(f"Found {len(toggl_members)} Toggl members")
    
    # Get existing NHS users in org 7
    cur.execute("SELECT id, email, first_name, last_name FROM users WHERE organization_id = %s", (NHS_ORG_ID,))
    nhs_users = {row[1].lower(): {"id": row[0], "email": row[1], "first_name": row[2], "last_name": row[3]} for row in cur.fetchall()}
    log.info(f"Found {len(nhs_users)} existing NHS users in org {NHS_ORG_ID}")
    
    # Map toggl_user_id → nhs_user_id
    user_map = {}  # toggl_user_id → nhs_user_id
    
    for member in toggl_members:
        toggl_uid = member.get("user_id", member.get("id"))
        toggl_email = member.get("email", "").lower()
        toggl_name = member.get("name", "")
        
        if toggl_email in nhs_users:
            nhs_user = nhs_users[toggl_email]
            user_map[toggl_uid] = nhs_user["id"]
            log.info(f"  MATCHED: Toggl [{toggl_uid}] {toggl_name} → NHS [{nhs_user['id']}] {nhs_user['first_name']} {nhs_user['last_name']}")
        else:
            # Create new NHS user
            # Parse name
            parts = toggl_name.split(" ", 1) if toggl_name else [toggl_email.split("@")[0], ""]
            first_name = parts[0] if parts else toggl_email.split("@")[0]
            last_name = parts[1] if len(parts) > 1 else ""
            
            # Generate a random password hash (they'll need to reset)
            import secrets
            temp_password = secrets.token_urlsafe(16)
            # Use bcrypt-compatible hash
            password_hash = hashlib.sha256(temp_password.encode()).hexdigest()
            
            cur.execute("""
                INSERT INTO users (email, password_hash, first_name, last_name, organization_id, role, is_active, email_verified, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, 'user', true, false, NOW(), NOW())
                RETURNING id
            """, (toggl_email, password_hash, first_name, last_name, NHS_ORG_ID))
            
            new_id = cur.fetchone()[0]
            user_map[toggl_uid] = new_id
            log.info(f"  CREATED: Toggl [{toggl_uid}] {toggl_name} ({toggl_email}) → NHS [{new_id}] (needs password reset)")
    
    conn.commit()
    log.info(f"User mapping complete: {len(user_map)} users mapped")
    return user_map, toggl_members

# ─── Phase 2: Companies (Toggl Clients) ─────────────────────────────────────

def migrate_companies(conn):
    """Match Toggl clients to NHS companies, create missing ones."""
    log.info("=" * 60)
    log.info("PHASE 2: COMPANY/CLIENT MATCHING")
    log.info("=" * 60)
    
    cur = conn.cursor()
    
    # Get Toggl clients
    toggl_clients = toggl_get(f"/workspaces/{TOGGL_WORKSPACE_ID}/clients", {"status": "both"})
    log.info(f"Found {len(toggl_clients)} Toggl clients")
    
    # Get existing NHS companies in org 7
    cur.execute("SELECT id, LOWER(name) FROM companies WHERE organization_id = %s", (NHS_ORG_ID,))
    nhs_companies = {row[1]: row[0] for row in cur.fetchall()}
    log.info(f"Found {len(nhs_companies)} existing NHS companies in org {NHS_ORG_ID}")
    
    # Map toggl_client_id → nhs_company_id
    company_map = {}
    
    for client in toggl_clients:
        toggl_cid = client["id"]
        toggl_name = client["name"]
        toggl_name_lower = toggl_name.lower().strip()
        archived = client.get("archived", False)
        
        # Try exact match first
        if toggl_name_lower in nhs_companies:
            company_map[toggl_cid] = nhs_companies[toggl_name_lower]
            log.info(f"  MATCHED: Toggl [{toggl_cid}] {toggl_name} → NHS [{nhs_companies[toggl_name_lower]}]")
        else:
            # Try fuzzy match - strip common suffixes/prefixes
            matched = False
            for nhs_name, nhs_id in nhs_companies.items():
                # Check if one contains the other
                if toggl_name_lower in nhs_name or nhs_name in toggl_name_lower:
                    company_map[toggl_cid] = nhs_id
                    log.info(f"  FUZZY MATCHED: Toggl [{toggl_cid}] '{toggl_name}' → NHS [{nhs_id}] '{nhs_name}'")
                    matched = True
                    break
            
            if not matched:
                # Create new company
                status = "Inactive" if archived else "Active"
                cur.execute("""
                    INSERT INTO companies (organization_id, name, status, contact_count, attachment_count, created_at, updated_at)
                    VALUES (%s, %s, %s, 0, 0, NOW(), NOW())
                    RETURNING id
                """, (NHS_ORG_ID, toggl_name, status))
                
                new_id = cur.fetchone()[0]
                company_map[toggl_cid] = new_id
                nhs_companies[toggl_name_lower] = new_id  # Add to lookup for subsequent matches
                log.info(f"  CREATED: Toggl [{toggl_cid}] {toggl_name} → NHS [{new_id}] (status: {status})")
    
    conn.commit()
    log.info(f"Company mapping complete: {len(company_map)} companies mapped")
    return company_map

# ─── Phase 3: Projects ──────────────────────────────────────────────────────

def migrate_projects(conn, company_map):
    """Match Toggl projects to NHS projects, create missing ones."""
    log.info("=" * 60)
    log.info("PHASE 3: PROJECT MATCHING/CREATION")
    log.info("=" * 60)
    
    cur = conn.cursor()
    
    # Get ALL Toggl projects (active + archived)
    toggl_projects = toggl_get(f"/workspaces/{TOGGL_WORKSPACE_ID}/projects", {"active": "both", "per_page": 200})
    log.info(f"Found {len(toggl_projects)} Toggl projects")
    
    # Get existing NHS projects in org 7
    cur.execute("SELECT id, LOWER(title), company_id FROM projects WHERE organization_id = %s", (NHS_ORG_ID,))
    nhs_projects = {}
    for row in cur.fetchall():
        nhs_projects[row[1]] = {"id": row[0], "company_id": row[2]}
    log.info(f"Found {len(nhs_projects)} existing NHS projects in org {NHS_ORG_ID}")
    
    # Map toggl_project_id → nhs_project_id
    project_map = {}
    
    for proj in toggl_projects:
        toggl_pid = proj["id"]
        toggl_name = proj["name"]
        toggl_name_lower = toggl_name.lower().strip()
        toggl_rate = proj.get("rate")  # Client billing rate
        toggl_client_id = proj.get("client_id")
        toggl_active = proj.get("active", True)
        toggl_billable = proj.get("billable", True)
        toggl_estimated = proj.get("estimated_hours")
        toggl_start = proj.get("start_date")
        toggl_end = proj.get("end_date")
        
        # Skip junk projects
        if toggl_name.strip() in ["", ",/'."] :
            log.info(f"  SKIPPED: Toggl [{toggl_pid}] '{toggl_name}' (junk)")
            continue
        
        # Map company
        nhs_company_id = company_map.get(toggl_client_id) if toggl_client_id else None
        
        # Try to match existing NHS project by title
        if toggl_name_lower in nhs_projects:
            existing = nhs_projects[toggl_name_lower]
            project_map[toggl_pid] = existing["id"]
            
            # Update the hourly_rate if Toggl has one and NHS doesn't
            if toggl_rate and toggl_rate > 0:
                cur.execute("UPDATE projects SET hourly_rate = %s WHERE id = %s AND (hourly_rate IS NULL OR hourly_rate = 0)",
                           (toggl_rate, existing["id"]))
            
            log.info(f"  MATCHED: Toggl [{toggl_pid}] {toggl_name} → NHS [{existing['id']}]")
        else:
            # Create new project
            # Determine stage: active → Active stage, archived → Closed stage
            stage_id = 30 if toggl_active else 32  # 30=Active, 32=Closed for org 7
            
            cur.execute("""
                INSERT INTO projects (organization_id, created_by, title, hourly_rate, company_id, 
                                     stage_id, is_active, start_date, projected_end_date, 
                                     projected_hours, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                RETURNING id
            """, (
                NHS_ORG_ID, NHS_CREATED_BY, toggl_name, toggl_rate, nhs_company_id,
                stage_id, toggl_active, toggl_start, toggl_end,
                toggl_estimated
            ))
            
            new_id = cur.fetchone()[0]
            project_map[toggl_pid] = new_id
            nhs_projects[toggl_name_lower] = {"id": new_id, "company_id": nhs_company_id}
            log.info(f"  CREATED: Toggl [{toggl_pid}] {toggl_name} → NHS [{new_id}] (rate: {toggl_rate}, active: {toggl_active})")
    
    conn.commit()
    log.info(f"Project mapping complete: {len(project_map)} projects mapped")
    return project_map

# ─── Phase 4: Project Member Rates ──────────────────────────────────────────

def migrate_rates(conn, project_map, user_map):
    """Import consultant pay rates from Toggl project_users endpoint."""
    log.info("=" * 60)
    log.info("PHASE 4: CONSULTANT RATES IMPORT")
    log.info("=" * 60)
    
    cur = conn.cursor()
    
    # Get all project users in batches (API accepts comma-separated project_ids)
    toggl_project_ids = list(project_map.keys())
    all_project_users = []
    
    # Batch in groups of 50 project IDs
    batch_size = 50
    for i in range(0, len(toggl_project_ids), batch_size):
        batch = toggl_project_ids[i:i+batch_size]
        pid_str = ",".join(str(p) for p in batch)
        try:
            result = toggl_get(f"/workspaces/{TOGGL_WORKSPACE_ID}/project_users", {"project_ids": pid_str})
            if result:
                all_project_users.extend(result)
            log.info(f"  Fetched project users batch {i//batch_size + 1}: {len(result) if result else 0} records")
        except Exception as e:
            log.warning(f"  Error fetching batch {i//batch_size + 1}: {e}")
    
    log.info(f"Total project-user rate records from Toggl: {len(all_project_users)}")
    
    # Clear existing rates for org 7 (fresh import)
    cur.execute("DELETE FROM project_member_rates WHERE organization_id = %s", (NHS_ORG_ID,))
    log.info(f"Cleared existing rates for org {NHS_ORG_ID}")
    
    imported = 0
    skipped = 0
    
    for pu in all_project_users:
        toggl_pid = pu.get("project_id")
        toggl_uid = pu.get("user_id")
        rate = pu.get("rate")
        
        nhs_project_id = project_map.get(toggl_pid)
        nhs_user_id = user_map.get(toggl_uid)
        
        if not nhs_project_id or not nhs_user_id:
            skipped += 1
            continue
        
        if rate is not None and rate > 0:
            cur.execute("""
                INSERT INTO project_member_rates (organization_id, project_id, user_id, consultant_rate, created_at, updated_at)
                VALUES (%s, %s, %s, %s, NOW(), NOW())
                ON CONFLICT DO NOTHING
            """, (NHS_ORG_ID, nhs_project_id, nhs_user_id, rate))
            imported += 1
    
    conn.commit()
    log.info(f"Rates import complete: {imported} imported, {skipped} skipped")
    return imported

# ─── Phase 5: Time Entries ───────────────────────────────────────────────────

def migrate_time_entries(conn, project_map, user_map):
    """Import all time entries from Toggl Reports API (paginated, rate-limited)."""
    log.info("=" * 60)
    log.info("PHASE 5: TIME ENTRIES IMPORT")
    log.info("=" * 60)
    
    cur = conn.cursor()
    
    # Clear existing time entries for org 7 (fresh import)
    cur.execute("DELETE FROM time_entries WHERE organization_id = %s", (NHS_ORG_ID,))
    conn.commit()
    log.info(f"Cleared existing time entries for org {NHS_ORG_ID}")
    
    # Get tag mapping for reference
    toggl_tags = toggl_get(f"/workspaces/{TOGGL_WORKSPACE_ID}/tags")
    tag_map = {t["id"]: t["name"] for t in toggl_tags}
    
    # Process in 365-day windows from EARLIEST_DATE to today
    today = datetime.now().strftime("%Y-%m-%d")
    window_start = datetime.strptime(EARLIEST_DATE, "%Y-%m-%d")
    end_date = datetime.strptime(today, "%Y-%m-%d")
    
    total_imported = 0
    total_skipped = 0
    total_entries_fetched = 0
    
    while window_start < end_date:
        window_end = min(window_start + timedelta(days=365), end_date)
        start_str = window_start.strftime("%Y-%m-%d")
        end_str = window_end.strftime("%Y-%m-%d")
        
        log.info(f"\n--- Processing window: {start_str} to {end_str} ---")
        
        # Paginate through all entries in this window
        first_row_number = None
        first_id = None
        first_timestamp = None
        page_num = 0
        window_entries = 0
        
        while True:
            page_num += 1
            body = {
                "start_date": start_str,
                "end_date": end_str,
                "page_size": 50,
                "enrich_response": True,
                "order_by": "date",
                "order_dir": "ASC",
            }
            
            if first_row_number is not None:
                body["first_row_number"] = first_row_number
                body["first_id"] = first_id
                body["first_timestamp"] = first_timestamp
            
            try:
                entries, headers = toggl_reports_post(
                    f"/workspace/{TOGGL_WORKSPACE_ID}/search/time_entries",
                    body
                )
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 429:
                    log.warning("Rate limited on reports API, sleeping 120s...")
                    time.sleep(120)
                    continue
                raise
            
            if not entries:
                log.info(f"  No more entries in this window (fetched {window_entries} total)")
                break
            
            total_entries_fetched += len(entries)
            window_entries += len(entries)
            
            # Process entries
            batch_values = []
            for entry in entries:
                toggl_uid = entry.get("user_id")
                toggl_pid = entry.get("project_id")
                description = entry.get("description", "")
                is_billable = entry.get("billable", True)
                entry_tag_ids = entry.get("tag_ids", [])
                entry_tags = [tag_map.get(tid, str(tid)) for tid in entry_tag_ids] if entry_tag_ids else None
                
                nhs_user_id = user_map.get(toggl_uid)
                nhs_project_id = project_map.get(toggl_pid) if toggl_pid else None
                
                if not nhs_user_id:
                    total_skipped += 1
                    continue
                
                # Each report entry can have multiple time_entries (sub-entries)
                time_entries_list = entry.get("time_entries", [])
                for te in time_entries_list:
                    te_start = te.get("start")
                    te_stop = te.get("stop")
                    te_seconds = te.get("seconds", 0)
                    te_id = te.get("id")
                    
                    if not te_start:
                        continue
                    
                    batch_values.append((
                        NHS_ORG_ID, nhs_user_id, nhs_project_id,
                        description, te_start, te_stop, te_seconds,
                        is_billable, json.dumps(entry_tags) if entry_tags else None,
                        False  # is_running
                    ))
            
            # Bulk insert
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
            
            # Commit every 10 pages
            if page_num % 10 == 0:
                conn.commit()
                log.info(f"  Page {page_num}: {window_entries} entries in window, {total_imported} total imported (quota: {quota_remaining})")
            
            # Check for next page
            next_row = headers.get("X-Next-Row-Number")
            next_id = headers.get("X-Next-ID")
            next_ts = headers.get("X-Next-Timestamp")
            
            if not next_row:
                log.info(f"  End of window (no more pages). {window_entries} entries.")
                break
            
            first_row_number = int(next_row)
            first_id = int(next_id) if next_id else None
            first_timestamp = int(next_ts) if next_ts else None
        
        conn.commit()
        window_start = window_end
    
    conn.commit()
    log.info(f"\nTime entries import complete!")
    log.info(f"  Total fetched from Toggl: {total_entries_fetched}")
    log.info(f"  Total imported to NHS: {total_imported}")
    log.info(f"  Total skipped (no user match): {total_skipped}")
    log.info(f"  Total API requests made: {request_count}")
    return total_imported

# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    start_time = time.time()
    log.info("=" * 60)
    log.info("TOGGL → NOTHUBSPOT MIGRATION")
    log.info(f"Started at: {datetime.now().isoformat()}")
    log.info(f"Target org: {NHS_ORG_ID} (Strategic Consulting & Coaching)")
    log.info(f"Date range: {EARLIEST_DATE} to today")
    log.info("=" * 60)
    
    conn = get_db()
    
    try:
        # Phase 1: Users
        user_map, toggl_members = migrate_users(conn)
        
        # Phase 2: Companies
        company_map = migrate_companies(conn)
        
        # Phase 3: Projects
        project_map = migrate_projects(conn, company_map)
        
        # Phase 4: Rates
        rates_imported = migrate_rates(conn, project_map, user_map)
        
        # Phase 5: Time Entries
        entries_imported = migrate_time_entries(conn, project_map, user_map)
        
        elapsed = time.time() - start_time
        log.info("\n" + "=" * 60)
        log.info("MIGRATION COMPLETE!")
        log.info(f"  Users mapped: {len(user_map)}")
        log.info(f"  Companies mapped: {len(company_map)}")
        log.info(f"  Projects mapped: {len(project_map)}")
        log.info(f"  Rates imported: {rates_imported}")
        log.info(f"  Time entries imported: {entries_imported}")
        log.info(f"  Total API requests: {request_count}")
        log.info(f"  Elapsed time: {elapsed/60:.1f} minutes")
        log.info("=" * 60)
        
    except Exception as e:
        conn.rollback()
        log.error(f"MIGRATION FAILED: {e}", exc_info=True)
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()
