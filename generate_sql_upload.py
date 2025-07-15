#!/usr/bin/env python3
"""
Generate SQL scripts for uploading companies and contacts to NotHubSpot
"""

import json
from datetime import datetime

def escape_sql_string(value):
    """Escape single quotes for SQL"""
    if value is None:
        return 'NULL'
    return "'" + str(value).replace("'", "''") + "'"

def generate_sql():
    """Generate SQL insert statements from JSON files"""
    
    # Load data
    with open('companies_to_upload.json', 'r') as f:
        companies = json.load(f)
    
    with open('contacts_to_upload.json', 'r') as f:
        contacts = json.load(f)
    
    # Start SQL file
    sql_content = """-- NotHubSpot Data Upload SQL Script
-- Generated: {}
-- Companies: {}
-- Contacts: {}

-- ============================================
-- IMPORTANT: READ BEFORE RUNNING
-- ============================================
-- 1. First run the SELECT queries to get your organization and user IDs
-- 2. Replace {{ORG_ID}} and {{USER_ID}} with the actual values
-- 3. Run the INSERT statements in order (companies first, then contacts)
-- ============================================

-- Step 1: Find your organization ID
SELECT id, name, slug 
FROM organizations 
WHERE slug = 'strategic-consulting-coaching-llc-vo2w';

-- Step 2: Find your user ID  
SELECT id, email, first_name, last_name 
FROM users 
WHERE email = 'eleblow@bmhmn.com';

-- ============================================
-- REPLACE {{ORG_ID}} and {{USER_ID}} below with actual values from above queries!
-- ============================================

""".format(
        datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        len(companies),
        len(contacts)
    )
    
    # Generate company inserts
    sql_content += "\n-- Insert Companies (run this first)\n"
    sql_content += "INSERT INTO companies (\n"
    sql_content += "    name, street_address, city, state, postal_code, website, description, status,\n"
    sql_content += "    organization_id, created_by_id, created_at, updated_at\n"
    sql_content += ") VALUES\n"
    
    company_values = []
    company_name_to_id = {}  # Track company names for contact mapping
    
    for i, company in enumerate(companies):
        # Store the mapping
        company_name_to_id[company['name']] = i + 1
        
        values = "({}, {}, {}, {}, {}, {}, {}, {}, {{ORG_ID}}, {{USER_ID}}, NOW(), NOW())".format(
            escape_sql_string(company['name']),
            escape_sql_string(company.get('street_address')),
            escape_sql_string(company.get('city')),
            escape_sql_string(company.get('state')),
            escape_sql_string(company.get('postal_code')),
            escape_sql_string(company.get('website')),
            escape_sql_string(company.get('description')),
            escape_sql_string(company.get('status', 'Active'))
        )
        company_values.append(values)
    
    sql_content += ",\n".join(company_values) + ";\n"
    
    # Add query to show inserted companies with their IDs
    sql_content += f"""
-- Verify companies were inserted and get their IDs
SELECT id, name 
FROM companies 
WHERE organization_id = {{ORG_ID}}
ORDER BY created_at DESC
LIMIT {len(companies)};

"""
    
    # Generate contact inserts with company lookup
    sql_content += "\n-- Insert Contacts (run this after companies)\n"
    sql_content += "-- This uses a subquery to find the company ID by name\n"
    sql_content += "INSERT INTO contacts (\n"
    sql_content += "    first_name, last_name, email, company_id,\n"
    sql_content += "    organization_id, created_by_id, created_at, updated_at\n"
    sql_content += ") VALUES\n"
    
    contact_values = []
    
    for contact in contacts:
        company_name = contact.get('company_name')
        
        if company_name:
            # Use subquery to get company ID
            company_subquery = "(SELECT id FROM companies WHERE name = {} AND organization_id = {{ORG_ID}} LIMIT 1)".format(
                escape_sql_string(company_name)
            )
        else:
            company_subquery = "NULL"
        
        values = "({}, {}, {}, {}, {{ORG_ID}}, {{USER_ID}}, NOW(), NOW())".format(
            escape_sql_string(contact.get('first_name', '')),
            escape_sql_string(contact.get('last_name', '')),
            escape_sql_string(contact.get('email')),
            company_subquery
        )
        contact_values.append(values)
    
    sql_content += ",\n".join(contact_values) + ";\n"
    
    # Add verification query
    sql_content += """
-- Verify contacts were inserted
SELECT COUNT(*) as contact_count 
FROM contacts 
WHERE organization_id = {{ORG_ID}};

-- Show sample of inserted contacts with their companies
SELECT 
    c.first_name,
    c.last_name,
    c.email,
    comp.name as company_name
FROM contacts c
LEFT JOIN companies comp ON c.company_id = comp.id
WHERE c.organization_id = {{ORG_ID}}
ORDER BY c.created_at DESC
LIMIT 10;
"""
    
    # Save to file
    with open('upload_data.sql', 'w') as f:
        f.write(sql_content)
    
    print("✅ SQL script generated: upload_data.sql")
    print(f"📊 Total: {len(companies)} companies, {len(contacts)} contacts")
    print("\n📋 Next steps:")
    print("1. Open pgAdmin and connect to your NotHubSpot database")
    print("2. Open upload_data.sql in pgAdmin's query tool")
    print("3. Run the first two SELECT queries to get your org and user IDs")
    print("4. Replace all {ORG_ID} and {USER_ID} placeholders with the actual values")
    print("5. Run the INSERT statements")

if __name__ == "__main__":
    generate_sql()