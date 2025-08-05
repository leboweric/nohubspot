-- Analyze Bennett Material Handling contacts for ALL CAPS issues

-- First, find all contacts from Bennett Material Handling organization
SELECT 
    c.id,
    c.first_name,
    c.last_name,
    c.email,
    c.title,
    c.phone,
    c.company_name,
    comp.name as company_name_from_table,
    comp.street_address as company_address,
    comp.city as company_city,
    comp.state as company_state
FROM contacts c
LEFT JOIN companies comp ON c.company_id = comp.id
JOIN organizations o ON c.organization_id = o.id
WHERE o.slug = 'bennett-material-handling-bp0s'
ORDER BY c.last_name, c.first_name
LIMIT 20;  -- Show sample to see the ALL CAPS issue

-- Count total contacts that need fixing
SELECT 
    COUNT(*) as total_contacts,
    COUNT(CASE WHEN c.first_name = UPPER(c.first_name) THEN 1 END) as all_caps_first_names,
    COUNT(CASE WHEN c.last_name = UPPER(c.last_name) THEN 1 END) as all_caps_last_names,
    COUNT(CASE WHEN c.title = UPPER(c.title) AND c.title IS NOT NULL THEN 1 END) as all_caps_titles,
    COUNT(CASE WHEN c.company_name = UPPER(c.company_name) AND c.company_name IS NOT NULL THEN 1 END) as all_caps_company_names
FROM contacts c
JOIN organizations o ON c.organization_id = o.id
WHERE o.slug = 'bennett-material-handling-bp0s';

-- Also check companies for ALL CAPS
SELECT 
    comp.id,
    comp.name,
    comp.street_address,
    comp.city,
    comp.state
FROM companies comp
JOIN organizations o ON comp.organization_id = o.id
WHERE o.slug = 'bennett-material-handling-bp0s'
AND (comp.name = UPPER(comp.name) 
     OR comp.city = UPPER(comp.city)
     OR comp.street_address = UPPER(comp.street_address))
ORDER BY comp.name
LIMIT 10;