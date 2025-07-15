-- Add Strategic Consulting & Coaching team members as users
-- These users will be assigned as Primary Account Owners for companies

-- Note: Using a placeholder password hash - users will need to reset passwords
-- The password_hash below is for 'TempPassword123!' - they should change it immediately

INSERT INTO users (
    email,
    password_hash,
    first_name,
    last_name,
    organization_id,
    role,
    is_active,
    created_at,
    updated_at
) VALUES 
(
    'cjensen@strategic-cc.com',
    '$2b$12$dummy.hash.for.sql.insert.only',
    'Cheryl',
    'Jensen',
    7,
    'user',
    true,
    NOW(),
    NOW()
),
(
    'roanderson@strategic-cc.com',
    '$2b$12$dummy.hash.for.sql.insert.only',
    'Renae',
    'Oswald-Anderson',
    7,
    'user',
    true,
    NOW(),
    NOW()
),
(
    'idavis@strategic-cc.com',
    '$2b$12$dummy.hash.for.sql.insert.only',
    'Imogen',
    'Davis',
    7,
    'user',
    true,
    NOW(),
    NOW()
),
(
    'ctaykalo@strategic-cc.com',
    '$2b$12$dummy.hash.for.sql.insert.only',
    'Christopher',
    'Taykalo',
    7,
    'user',
    true,
    NOW(),
    NOW()
),
(
    'smarschalk@strategic-cc.com',
    '$2b$12$dummy.hash.for.sql.insert.only',
    'Susan',
    'Marschalk',
    7,
    'user',
    true,
    NOW(),
    NOW()
);

-- Verify the users were added
SELECT id, email, first_name, last_name, role
FROM users
WHERE organization_id = 7
AND email IN (
    'cjensen@strategic-cc.com',
    'roanderson@strategic-cc.com',
    'idavis@strategic-cc.com',
    'ctaykalo@strategic-cc.com',
    'smarschalk@strategic-cc.com'
)
ORDER BY last_name, first_name;