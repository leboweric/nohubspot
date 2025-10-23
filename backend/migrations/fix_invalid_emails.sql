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
UPDATE contacts 
SET email = REGEXP_REPLACE(email, '\([^)]*\)', '', 'g'),
    updated_at = NOW()
WHERE organization_id = 7 
AND email LIKE '%(%)%';
UPDATE contacts 
SET email = REPLACE(email, ' ', ''),
    updated_at = NOW()
WHERE organization_id = 7 
AND email LIKE '% %';
UPDATE contacts 
SET email = REGEXP_REPLACE(email, '\.{2,}', '.', 'g'),
    updated_at = NOW()
WHERE organization_id = 7 
AND email LIKE '%..%';
UPDATE contacts 
SET email = 'info@' || email,
    updated_at = NOW()
WHERE organization_id = 7 
AND email NOT LIKE '%@%'
AND email LIKE '%.%';
UPDATE contacts 
SET status = 'Active'
WHERE status IS NULL;
SELECT 
    COUNT(*) as total_contacts,
    COUNT(CASE WHEN email LIKE '%(%)%' THEN 1 END) as emails_with_parens,
    COUNT(CASE WHEN email LIKE '% %' THEN 1 END) as emails_with_spaces,
    COUNT(CASE WHEN email NOT LIKE '%@%' THEN 1 END) as invalid_emails,
    COUNT(CASE WHEN status IS NULL THEN 1 END) as null_statuses
FROM contacts 
WHERE organization_id = 7;