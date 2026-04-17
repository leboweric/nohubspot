#!/usr/bin/env python3
"""Diagnose project mapping status of time entries in NHS database."""

import psycopg2

DB_URL = "postgresql://postgres:KXGPGFkLkkicZQoOVyixcuNNVtOlJvSo@switchback.proxy.rlwy.net:27597/railway"

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# First, check all columns in time_entries
cur.execute("""
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name = 'time_entries' ORDER BY ordinal_position
""")
cols = cur.fetchall()
print("--- time_entries columns ---")
col_names = []
for col, dtype in cols:
    print(f"  {col}: {dtype}")
    col_names.append(col)

# Check if organization_id or org_id exists
org_col = None
if 'org_id' in col_names:
    org_col = 'org_id'
elif 'organization_id' in col_names:
    org_col = 'organization_id'
print(f"\nOrg column: {org_col}")

# Build WHERE clause
where = f"WHERE {org_col} = 7" if org_col else ""

# Total time entries
cur.execute(f"SELECT COUNT(*) FROM time_entries {where}")
total = cur.fetchone()[0]
print(f"\nTotal time entries: {total}")

# Entries with no project
cur.execute(f"SELECT COUNT(*) FROM time_entries {where} {'AND' if where else 'WHERE'} project_id IS NULL")
no_project = cur.fetchone()[0]
print(f"Entries with NO project: {no_project} ({no_project*100//max(total,1)}%)")

# Entries with a project
with_project = total - no_project
print(f"Entries WITH project: {with_project} ({with_project*100//max(total,1)}%)")

# Check for toggl-related columns
toggl_cols = [c for c in col_names if 'toggl' in c.lower() or 'external' in c.lower()]
print(f"\nToggl/external columns: {toggl_cols}")

for tc in toggl_cols:
    cur.execute(f"SELECT COUNT(*) FROM time_entries {where} {'AND' if where else 'WHERE'} {tc} IS NOT NULL")
    cnt = cur.fetchone()[0]
    print(f"  Entries with {tc}: {cnt}")
    
    cur.execute(f"SELECT COUNT(*) FROM time_entries {where} {'AND' if where else 'WHERE'} {tc} IS NOT NULL AND project_id IS NULL")
    cnt2 = cur.fetchone()[0]
    print(f"  Entries with {tc} but NO project: {cnt2}")

# Show sample entries without project
cur.execute(f"""
    SELECT id, description, project_id, user_id, start_time 
    FROM time_entries 
    {where} {'AND' if where else 'WHERE'} project_id IS NULL 
    ORDER BY start_time DESC 
    LIMIT 10
""")
print("\n--- Sample entries WITHOUT project (most recent) ---")
for row in cur.fetchall():
    desc = row[1][:60] if row[1] else 'NULL'
    print(f"  id={row[0]}, desc='{desc}', user_id={row[3]}, start={row[4]}")

# Show sample entries WITH project
cur.execute(f"""
    SELECT te.id, te.description, te.project_id, p.title, te.start_time 
    FROM time_entries te
    LEFT JOIN projects p ON te.project_id = p.id
    {where.replace('WHERE', 'WHERE te.' + (org_col or 'id') + ' = 7 AND') if not org_col else where.replace(org_col, 'te.' + org_col)} 
    AND te.project_id IS NOT NULL 
    ORDER BY te.start_time DESC 
    LIMIT 10
""")
print("\n--- Sample entries WITH project (most recent) ---")
for row in cur.fetchall():
    desc = row[1][:60] if row[1] else 'NULL'
    print(f"  id={row[0]}, desc='{desc}', project_id={row[2]}, project='{row[3]}', start={row[4]}")

# Count entries per project
cur.execute(f"""
    SELECT p.title, COUNT(*) as cnt 
    FROM time_entries te
    LEFT JOIN projects p ON te.project_id = p.id
    WHERE te.project_id IS NOT NULL
    GROUP BY p.title
    ORDER BY cnt DESC
    LIMIT 20
""")
print("\n--- Entries per project (top 20) ---")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]} entries")

# Check projects table
cur.execute("""
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'projects' ORDER BY ordinal_position
""")
print("\n--- projects columns ---")
for row in cur.fetchall():
    print(f"  {row[0]}")

# Check for SCC Internal Work project
cur.execute("SELECT id, title FROM projects WHERE title ILIKE '%internal%' OR title ILIKE '%scc%' LIMIT 20")
print("\n--- Projects matching 'internal' or 'scc' ---")
for row in cur.fetchall():
    print(f"  id={row[0]}, title='{row[1]}'")

cur.close()
conn.close()
