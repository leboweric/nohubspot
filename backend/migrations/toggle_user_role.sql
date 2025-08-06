-- Script to toggle user role between owner and admin for testing
-- For eric@profitbuildernetwork.com

-- First, check current role
SELECT 
    id,
    email,
    first_name,
    last_name,
    role as current_role,
    organization_id
FROM users 
WHERE email = 'eric@profitbuildernetwork.com';

-- Change from owner to admin to test
UPDATE users 
SET role = 'admin'
WHERE email = 'eric@profitbuildernetwork.com';

-- Verify the change
SELECT 
    email,
    role as updated_role,
    CASE 
        WHEN role = 'admin' THEN 'Admin - Should see Project Types section'
        WHEN role = 'owner' THEN 'Owner - Should see Project Types section'
        ELSE 'Other - Will NOT see Project Types section'
    END as expected_visibility
FROM users 
WHERE email = 'eric@profitbuildernetwork.com';

-- To change back to owner later, use:
-- UPDATE users 
-- SET role = 'owner'
-- WHERE email = 'eric@profitbuildernetwork.com';