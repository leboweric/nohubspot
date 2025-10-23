SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.role,
    u.organization_id,
    o.name as organization_name,
    o.slug as organization_slug
FROM users u
JOIN organizations o ON u.organization_id = o.id
WHERE u.email = 'eric@profitbuildernetwork.com';

SELECT 
    u.id,
    u.email,
    u.first_name || ' ' || u.last_name as full_name,
    u.role,
    CASE 
        WHEN u.role = 'owner' THEN 'Owner (Full Admin)'
        WHEN u.role = 'admin' THEN 'Admin'
        WHEN u.role = 'user' THEN 'Regular User'
        WHEN u.role = 'readonly' THEN 'Read Only'
        ELSE u.role
    END as role_description
FROM users u
JOIN organizations o ON u.organization_id = o.id
WHERE o.slug = 'profitbuilder-network-8flp'
ORDER BY 
    CASE u.role 
        WHEN 'owner' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'user' THEN 3
        WHEN 'readonly' THEN 4
        ELSE 5
    END;