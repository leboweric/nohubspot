-- Create user for Eric Lebow in Strategic Consulting & Coaching, LLC organization
-- Email: elebow@strategic-cc.com
-- Password: abc123 (user should change after first login)

-- First, verify the organization exists and get its ID
SELECT id, name, slug 
FROM organizations 
WHERE name = 'Strategic Consulting & Coaching, LLC'
   OR slug LIKE '%strategic%';

-- Insert the new user
-- Organization ID 7 corresponds to Strategic Consulting & Coaching, LLC based on existing scripts
INSERT INTO users (
    email,
    password_hash,
    first_name,
    last_name,
    organization_id,
    role,
    is_active,
    email_verified,
    created_at,
    updated_at
) VALUES (
    'elebow@strategic-cc.com',
    '$2b$12$w0ejnbWd7M9cSg/fhBqlkekQ3Sw4PsRA/rKxgQKrp2EzkYdviVCXy',  -- Hash for password 'abc123'
    'Eric',
    'Lebow',
    7,  -- Strategic Consulting & Coaching, LLC organization ID
    'user',  -- Standard user role (can be changed to 'admin' or 'owner' if needed)
    true,
    false,  -- Email not verified initially - user can verify after first login
    NOW(),
    NOW()
);

-- Verify the user was created successfully
SELECT 
    id,
    email,
    first_name,
    last_name,
    role,
    is_active,
    email_verified,
    organization_id,
    created_at
FROM users 
WHERE email = 'elebow@strategic-cc.com';

-- Show all users in the Strategic Consulting & Coaching organization for context
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.role,
    u.is_active,
    o.name as organization_name
FROM users u
JOIN organizations o ON u.organization_id = o.id
WHERE u.organization_id = 7
ORDER BY u.last_name, u.first_name;

-- Optional: If you need to change the role to admin or owner, uncomment and run:
-- UPDATE users 
-- SET role = 'admin', updated_at = NOW()
-- WHERE email = 'elebow@strategic-cc.com';

-- Optional: If you need to verify the email immediately, uncomment and run:
-- UPDATE users 
-- SET email_verified = true, updated_at = NOW()
-- WHERE email = 'elebow@strategic-cc.com';