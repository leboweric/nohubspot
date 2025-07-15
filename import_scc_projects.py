#!/usr/bin/env python3
"""
Import SCC Projects from Excel file
- Creates companies if they don't exist
- Creates contacts if they don't exist
- Creates projects in Planning stage
"""

import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime

# Database connection
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("❌ Please set DATABASE_URL environment variable")
    exit(1)

# Fix Railway PostgreSQL URL
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Project type mappings to fix typos and normalize
PROJECT_TYPE_MAPPINGS = {
    "Exec Search": "Executive Search",
    "Interim Exectuive Director": "Interim Executive Director", 
    "Strategic Planning ": "Strategic Planning",
    "Grant Writing": "Grant Writing",
    "Grantwriting": "Grant Writing",
    "Organizational Assessment": "Organizational Assessment",
    "Organizational  Asessment": "Organizational Assessment",
    "Organizational Asessment": "Organizational Assessment",
    "WEDC @ The Hub": "Other",  # Unclear what this is
    "2352 S. Park St., Suite 303": "Other"  # This is an address, not a project type
}

def clean_project_type(project_type):
    """Clean and normalize project type"""
    if pd.isna(project_type):
        return None
    
    project_type = str(project_type).strip()
    return PROJECT_TYPE_MAPPINGS.get(project_type, project_type)

def split_contact_names(full_name):
    """Split names like 'Elaine Walker and Dave Rudolph' into separate contacts"""
    if pd.isna(full_name):
        return []
    
    contacts = []
    
    # Handle "and" separator
    if " and " in full_name:
        names = full_name.split(" and ")
    else:
        names = [full_name]
    
    for name in names:
        name = name.strip()
        if not name:
            continue
            
        # Split into first and last name
        parts = name.split()
        if len(parts) >= 2:
            first_name = parts[0]
            last_name = " ".join(parts[1:])
        else:
            first_name = name
            last_name = ""
        
        contacts.append({
            "first_name": first_name,
            "last_name": last_name
        })
    
    return contacts

def main():
    print("🚀 Starting SCC Projects Import")
    print("=" * 50)
    
    # Read Excel file
    df = pd.read_excel('SCC Projects.xlsx')
    
    # Remove completely empty rows
    df = df.dropna(how='all')
    
    # Clean project types
    df['Project Type'] = df['Project Type'].apply(clean_project_type)
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Get SCC organization ID
        cur.execute("""
            SELECT id FROM organizations 
            WHERE name = 'Strategic Consulting & Coaching, LLC'
        """)
        org = cur.fetchone()
        if not org:
            print("❌ SCC organization not found!")
            return
        
        org_id = org['id']
        print(f"✅ Found SCC organization (ID: {org_id})")
        
        # Get Planning stage ID
        cur.execute("""
            SELECT id FROM project_stages 
            WHERE organization_id = %s AND name = 'Planning'
        """, (org_id,))
        stage = cur.fetchone()
        if not stage:
            print("❌ Planning stage not found!")
            return
        
        planning_stage_id = stage['id']
        print(f"✅ Found Planning stage (ID: {planning_stage_id})")
        
        # Get a default user for created_by (first admin user in org)
        cur.execute("""
            SELECT id FROM users 
            WHERE organization_id = %s AND is_admin = true
            LIMIT 1
        """, (org_id,))
        user = cur.fetchone()
        if not user:
            print("❌ No admin user found!")
            return
        
        created_by_id = user['id']
        
        # Process each row
        created_companies = 0
        created_contacts = 0
        created_projects = 0
        skipped_projects = 0
        
        for idx, row in df.iterrows():
            company_name = row['Company']
            project_type = row['Project Type']
            contact_name = row['Primary Contact']
            job_title = row['Job Title']
            
            # Skip if no company name
            if pd.isna(company_name):
                skipped_projects += 1
                continue
            
            company_name = str(company_name).strip()
            
            # Check if company exists
            cur.execute("""
                SELECT id FROM companies 
                WHERE organization_id = %s AND name = %s
            """, (org_id, company_name))
            company = cur.fetchone()
            
            if not company:
                # Create company
                cur.execute("""
                    INSERT INTO companies (organization_id, name, created_by_id)
                    VALUES (%s, %s, %s)
                    RETURNING id
                """, (org_id, company_name, created_by_id))
                company = cur.fetchone()
                created_companies += 1
                print(f"  ✅ Created company: {company_name}")
            
            company_id = company['id']
            
            # Handle contacts
            contact_id = None
            if not pd.isna(contact_name):
                contacts = split_contact_names(contact_name)
                
                # Use the first contact as primary (we'll create all of them)
                for i, contact_info in enumerate(contacts):
                    # Check if contact exists
                    cur.execute("""
                        SELECT id FROM contacts 
                        WHERE organization_id = %s 
                        AND first_name = %s 
                        AND last_name = %s
                        AND company_id = %s
                    """, (org_id, contact_info['first_name'], contact_info['last_name'], company_id))
                    contact = cur.fetchone()
                    
                    if not contact:
                        # Create contact
                        job_title_value = job_title if not pd.isna(job_title) and i == 0 else None
                        
                        cur.execute("""
                            INSERT INTO contacts 
                            (organization_id, company_id, first_name, last_name, job_title, email, created_by_id)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                            RETURNING id
                        """, (
                            org_id, 
                            company_id, 
                            contact_info['first_name'], 
                            contact_info['last_name'],
                            job_title_value,
                            f"{contact_info['first_name'].lower()}.{contact_info['last_name'].lower()}@{company_name.lower().replace(' ', '')}.com",
                            created_by_id
                        ))
                        contact = cur.fetchone()
                        created_contacts += 1
                        print(f"  ✅ Created contact: {contact_info['first_name']} {contact_info['last_name']}")
                    
                    # Use first contact as primary
                    if i == 0:
                        contact_id = contact['id']
            
            # Skip project if no project type
            if pd.isna(project_type) or not project_type:
                print(f"  ⚠️  Skipping project for {company_name} - no project type")
                skipped_projects += 1
                continue
            
            # Create project
            project_title = f"{project_type} - {company_name}"
            
            # Check if project already exists
            cur.execute("""
                SELECT id FROM projects
                WHERE organization_id = %s AND title = %s
            """, (org_id, project_title))
            existing_project = cur.fetchone()
            
            if existing_project:
                print(f"  ⚠️  Project already exists: {project_title}")
                skipped_projects += 1
                continue
            
            cur.execute("""
                INSERT INTO projects 
                (organization_id, created_by, title, project_type, company_id, contact_id, stage_id, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, true)
                RETURNING id
            """, (
                org_id,
                created_by_id,
                project_title,
                project_type,
                company_id,
                contact_id,
                planning_stage_id
            ))
            project = cur.fetchone()
            created_projects += 1
            print(f"  ✅ Created project: {project_title}")
        
        # Commit all changes
        conn.commit()
        
        print("\n" + "=" * 50)
        print("✅ Import Summary:")
        print(f"  - Companies created: {created_companies}")
        print(f"  - Contacts created: {created_contacts}")
        print(f"  - Projects created: {created_projects}")
        print(f"  - Projects skipped: {skipped_projects}")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Error: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()