-- Summary of SCC Projects Import

-- Overall Summary
SELECT 
    'Import Summary' as report_section,
    COUNT(DISTINCT p.id) as total_projects,
    COUNT(DISTINCT p.company_id) as unique_companies,
    COUNT(DISTINCT p.contact_id) as projects_with_contacts,
    COUNT(DISTINCT CASE WHEN p.contact_id IS NULL THEN p.id END) as projects_without_contacts
FROM projects p
JOIN organizations o ON p.organization_id = o.id
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND p.created_at::date = CURRENT_DATE;

-- Projects by Type
SELECT 
    'Projects by Type' as report_section,
    p.project_type,
    COUNT(*) as project_count
FROM projects p
JOIN organizations o ON p.organization_id = o.id
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND p.created_at::date = CURRENT_DATE
GROUP BY p.project_type
ORDER BY COUNT(*) DESC;

-- All Imported Projects with Details
SELECT 
    'Detailed Project List' as report_section,
    p.title as "Project Title",
    p.project_type as "Type",
    c.name as "Company",
    CASE 
        WHEN con.id IS NULL THEN '(No Contact)'
        ELSE con.first_name || ' ' || con.last_name
    END as "Primary Contact",
    CASE 
        WHEN con.title IS NOT NULL THEN con.title
        ELSE ''
    END as "Contact Title",
    ps.name as "Stage"
FROM projects p
JOIN companies c ON p.company_id = c.id
JOIN project_stages ps ON p.stage_id = ps.id
JOIN organizations o ON p.organization_id = o.id
LEFT JOIN contacts con ON p.contact_id = con.id
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND p.created_at::date = CURRENT_DATE
ORDER BY p.project_type, c.name;

-- Companies Created Today
SELECT 
    'New Companies Added' as report_section,
    c.name as "Company Name",
    COUNT(DISTINCT p.id) as "Projects",
    COUNT(DISTINCT con.id) as "Contacts"
FROM companies c
JOIN organizations o ON c.organization_id = o.id
LEFT JOIN projects p ON c.id = p.company_id AND p.created_at::date = CURRENT_DATE
LEFT JOIN contacts con ON c.id = con.company_id AND con.created_at::date = CURRENT_DATE
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND c.created_at::date = CURRENT_DATE
GROUP BY c.id, c.name
ORDER BY c.name;

-- Contacts Created Today
SELECT 
    'New Contacts Added' as report_section,
    con.first_name || ' ' || con.last_name as "Contact Name",
    con.title as "Title",
    c.name as "Company",
    con.email as "Email (Generated)"
FROM contacts con
JOIN companies c ON con.company_id = c.id
JOIN organizations o ON con.organization_id = o.id
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND con.created_at::date = CURRENT_DATE
ORDER BY c.name, con.last_name, con.first_name;

-- Data Quality Issues
SELECT 
    'Data Quality Issues' as report_section,
    'Projects without contacts' as issue_type,
    COUNT(*) as count
FROM projects p
JOIN organizations o ON p.organization_id = o.id
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND p.created_at::date = CURRENT_DATE
AND p.contact_id IS NULL

UNION ALL

SELECT 
    'Data Quality Issues' as report_section,
    'Contacts with single name only' as issue_type,
    COUNT(*) as count
FROM contacts con
JOIN organizations o ON con.organization_id = o.id
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND con.created_at::date = CURRENT_DATE
AND (con.last_name = '' OR con.first_name = con.last_name)

UNION ALL

SELECT 
    'Data Quality Issues' as report_section,
    'Projects marked as "Other" type' as issue_type,
    COUNT(*) as count
FROM projects p
JOIN organizations o ON p.organization_id = o.id
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND p.created_at::date = CURRENT_DATE
AND p.project_type = 'Other';