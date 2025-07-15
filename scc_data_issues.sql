-- Projects without contacts (to add contacts later if needed)
SELECT 
    p.id as project_id,
    p.title as "Project",
    c.name as "Company"
FROM projects p
JOIN companies c ON p.company_id = c.id
JOIN organizations o ON p.organization_id = o.id
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND p.created_at::date = CURRENT_DATE
AND p.contact_id IS NULL
ORDER BY c.name
LIMIT 10;

-- Contact with single name (Henrietta)
SELECT 
    con.id as contact_id,
    con.first_name,
    con.last_name,
    c.name as company,
    con.title
FROM contacts con
JOIN companies c ON con.company_id = c.id
JOIN organizations o ON con.organization_id = o.id
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND con.created_at::date = CURRENT_DATE
AND (con.last_name = '' OR con.first_name = con.last_name);

-- Project marked as "Other" (to update type if needed)
SELECT 
    p.id as project_id,
    p.title,
    c.name as company,
    p.project_type
FROM projects p
JOIN companies c ON p.company_id = c.id
JOIN organizations o ON p.organization_id = o.id
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND p.created_at::date = CURRENT_DATE
AND p.project_type = 'Other';

-- Quick fix for Henrietta's duplicate last name
-- UPDATE contacts 
-- SET last_name = ''
-- WHERE id = [contact_id from query above]
-- AND first_name = 'Henrietta';