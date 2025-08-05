-- Cleanup Admin records from Bennett Material Handling data

-- Step 1: Find all contacts that start with "Admin"
SELECT 'STEP 1: Contacts starting with Admin' as step;

SELECT 
    c.id,
    c.first_name,
    c.last_name,
    c.email,
    c.title,
    c.company_name,
    comp.name as company_from_table
FROM contacts c
LEFT JOIN companies comp ON c.company_id = comp.id
WHERE c.organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND (
    c.first_name LIKE 'Admin%' 
    OR c.last_name LIKE 'Admin%'
    OR c.email LIKE 'admin%'
)
ORDER BY c.first_name, c.last_name;

-- Step 2: Find all companies that start with "Admin"
SELECT 'STEP 2: Companies starting with Admin' as step;

SELECT 
    comp.id,
    comp.name,
    comp.street_address,
    comp.city,
    comp.state,
    (SELECT COUNT(*) FROM contacts c WHERE c.company_id = comp.id) as contact_count
FROM companies comp
WHERE comp.organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND comp.name LIKE 'Admin%'
ORDER BY comp.name;

-- Step 3: Count records to be deleted
SELECT 'STEP 3: Summary of Admin records to be cleaned' as step;

SELECT 
    'Contacts with Admin' as type,
    COUNT(*) as count
FROM contacts
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND (first_name LIKE 'Admin%' OR last_name LIKE 'Admin%' OR email LIKE 'admin%')
UNION ALL
SELECT 
    'Companies with Admin' as type,
    COUNT(*) as count
FROM companies
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND name LIKE 'Admin%';

-- Step 4: Delete Admin contacts (COMMENTED OUT - Uncomment to execute)
/*
DELETE FROM contacts
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND (
    first_name LIKE 'Admin%' 
    OR last_name LIKE 'Admin%'
    OR email LIKE 'admin%'
);
*/

-- Step 5: Delete Admin companies that have no contacts (COMMENTED OUT - Uncomment to execute)
/*
DELETE FROM companies
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND name LIKE 'Admin%'
AND NOT EXISTS (
    SELECT 1 FROM contacts c WHERE c.company_id = companies.id
);
*/

-- Step 6: Alternative - If you want to keep the records but flag them
-- Add a note to contacts instead of deleting
/*
UPDATE contacts
SET 
    notes = COALESCE(notes || E'\n', '') || '[SYSTEM NOTE: Flagged as administrative/test record - ' || CURRENT_DATE || ']',
    status = 'Inactive',
    updated_at = CURRENT_TIMESTAMP
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND (
    first_name LIKE 'Admin%' 
    OR last_name LIKE 'Admin%'
    OR email LIKE 'admin%'
);
*/

-- Step 7: Show specific Admin patterns found
SELECT 'STEP 7: Admin record patterns' as step;

SELECT DISTINCT
    CASE 
        WHEN first_name LIKE 'Admin%' THEN first_name
        WHEN last_name LIKE 'Admin%' THEN last_name
        ELSE email
    END as admin_pattern,
    COUNT(*) as occurrences
FROM contacts
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND (first_name LIKE 'Admin%' OR last_name LIKE 'Admin%' OR email LIKE 'admin%')
GROUP BY 1
ORDER BY 2 DESC;