-- Add User to Strategic Consulting & Coaching and Upload Data
-- ============================================

-- Step 1: Find the Strategic Consulting & Coaching organization
SELECT id, name, slug 
FROM organizations 
WHERE slug = 'strategic-consulting-coaching-llc-vo2w';

-- Note the organization ID from above (let's call it ORG_ID)
-- Replace {ORG_ID} with the actual ID in ALL queries below

-- Step 2: Check if you already exist as a user in any organization
SELECT id, email, first_name, last_name, organization_id 
FROM users 
WHERE email = 'eleblow@bmhmn.com';

-- Step 3: Add yourself as an admin user to Strategic Consulting & Coaching
-- Only run this if you're not already in that organization
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
) VALUES (
    'eleblow@bmhmn.com',
    '$2b$12$dummy.hash.for.sql.insert.only',  -- You'll need to set password via app
    'Eric',
    'Lebow', 
    {ORG_ID},  -- Replace with actual organization ID
    'admin',
    true,
    NOW(),
    NOW()
);

-- Step 4: Get your new user ID
SELECT id, email, first_name, last_name, role
FROM users 
WHERE email = 'eleblow@bmhmn.com' 
AND organization_id = {ORG_ID};  -- Replace with actual organization ID

-- Note your user ID from above
-- Replace {USER_ID} with your actual user ID in the upload queries below

-- ============================================
-- Now you can proceed with the data upload
-- ============================================

-- Step 5: Upload Companies
-- Copy the INSERT INTO companies statement from upload_data.sql here
-- Remember to replace both {ORG_ID} and {USER_ID} with actual values

-- Step 6: Upload Contacts  
-- Copy the INSERT INTO contacts statement from upload_data.sql here
-- Remember to replace both {ORG_ID} and {USER_ID} with actual values