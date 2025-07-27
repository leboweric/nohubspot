-- Fix contact counts for all companies
-- This script recalculates the contact_count field based on actual contacts

-- First, let's see the current state
SELECT 
    c.id,
    c.name,
    c.contact_count as current_count,
    COUNT(con.id) as actual_count,
    c.organization_id
FROM companies c
LEFT JOIN contacts con ON con.company_id = c.id AND con.organization_id = c.organization_id
GROUP BY c.id, c.name, c.contact_count, c.organization_id
HAVING c.contact_count != COUNT(con.id)
ORDER BY c.name;

-- Update all companies with correct contact counts
UPDATE companies c
SET contact_count = (
    SELECT COUNT(*)
    FROM contacts con
    WHERE con.company_id = c.id
    AND con.organization_id = c.organization_id
);

-- Verify the fix - check specific company
SELECT 
    c.id,
    c.name,
    c.contact_count,
    COUNT(con.id) as actual_contacts
FROM companies c
LEFT JOIN contacts con ON con.company_id = c.id
WHERE c.name = 'Legal Services of North Dakota'
GROUP BY c.id, c.name, c.contact_count;

-- Show all contacts for Legal Services of North Dakota
SELECT 
    con.id,
    con.first_name,
    con.last_name,
    con.email,
    con.company_id,
    con.company_name,
    c.name as company_name_from_company_table
FROM contacts con
LEFT JOIN companies c ON c.id = con.company_id
WHERE c.name = 'Legal Services of North Dakota'
   OR con.company_name = 'Legal Services of North Dakota';