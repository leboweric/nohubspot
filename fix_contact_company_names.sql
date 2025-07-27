-- Fix company names for all contacts
-- This script updates the denormalized company_name field in contacts table

-- First, let's see contacts with mismatched or missing company names
SELECT 
    con.id,
    con.first_name,
    con.last_name,
    con.company_id,
    con.company_name as current_company_name,
    c.name as actual_company_name
FROM contacts con
LEFT JOIN companies c ON c.id = con.company_id
WHERE con.company_id IS NOT NULL
  AND (con.company_name IS NULL OR con.company_name != c.name)
ORDER BY con.last_name, con.first_name;

-- Update all contacts with correct company names
UPDATE contacts con
SET company_name = c.name
FROM companies c
WHERE con.company_id = c.id
  AND con.organization_id = c.organization_id
  AND (con.company_name IS NULL OR con.company_name != c.name);

-- Clear company_name for contacts with no company_id
UPDATE contacts
SET company_name = NULL
WHERE company_id IS NULL
  AND company_name IS NOT NULL;

-- Verify the fix - check if any mismatches remain
SELECT 
    COUNT(*) as mismatched_count
FROM contacts con
LEFT JOIN companies c ON c.id = con.company_id
WHERE con.company_id IS NOT NULL
  AND (con.company_name IS NULL OR con.company_name != c.name);

-- Show summary of all contacts and their company associations
SELECT 
    COUNT(*) FILTER (WHERE company_id IS NOT NULL AND company_name IS NOT NULL) as contacts_with_company,
    COUNT(*) FILTER (WHERE company_id IS NOT NULL AND company_name IS NULL) as contacts_missing_company_name,
    COUNT(*) FILTER (WHERE company_id IS NULL) as contacts_without_company,
    COUNT(*) as total_contacts
FROM contacts;