-- Fix invalid emails and NULL statuses in contacts table

-- First, let's see the problematic contacts in Strategic Consulting
SELECT id, first_name, last_name, email, status, organization_id 
FROM contacts 
WHERE organization_id = 7 
AND (
    email LIKE '%(%)%' OR 
    email LIKE '% %' OR 
    email NOT LIKE '%@%' OR
    status IS NULL
)
ORDER BY email;

-- Fix emails with parentheses - remove the parenthetical part
UPDATE contacts 
SET email = REGEXP_REPLACE(email, '\([^)]*\)', '', 'g'),
    updated_at = NOW()
WHERE organization_id = 7 
AND email LIKE '%(%)%';

-- Fix email with spaces before @ sign
UPDATE contacts 
SET email = REPLACE(email, ' ', ''),
    updated_at = NOW()
WHERE organization_id = 7 
AND email LIKE '% %';

-- Fix emails with consecutive periods
UPDATE contacts 
SET email = REGEXP_REPLACE(email, '\.{2,}', '.', 'g'),
    updated_at = NOW()
WHERE organization_id = 7 
AND email LIKE '%..%';

-- Fix entries that are domains without @ sign (add info@ prefix)
UPDATE contacts 
SET email = 'info@' || email,
    updated_at = NOW()
WHERE organization_id = 7 
AND email NOT LIKE '%@%'
AND email LIKE '%.%';

-- Fix NULL status values
UPDATE contacts 
SET status = 'Active'
WHERE status IS NULL;

-- Show the results
SELECT 
    COUNT(*) as total_contacts,
    COUNT(CASE WHEN email LIKE '%(%)%' THEN 1 END) as emails_with_parens,
    COUNT(CASE WHEN email LIKE '% %' THEN 1 END) as emails_with_spaces,
    COUNT(CASE WHEN email NOT LIKE '%@%' THEN 1 END) as invalid_emails,
    COUNT(CASE WHEN status IS NULL THEN 1 END) as null_statuses
FROM contacts 
WHERE organization_id = 7;