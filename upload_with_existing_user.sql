-- Upload Data to Strategic Consulting & Coaching
-- Using an existing user from that organization
-- ============================================

-- Step 1: Find the Strategic Consulting & Coaching organization
SELECT id, name, slug, created_at
FROM organizations 
WHERE slug = 'strategic-consulting-coaching-llc-vo2w';

-- Note the organization ID from above
-- Replace {ORG_ID} with the actual ID in ALL queries below

-- Step 2: Find ANY user in that organization to use for the upload
-- This will show all users in Strategic Consulting & Coaching
SELECT id, email, first_name, last_name, role, created_at
FROM users 
WHERE organization_id = {ORG_ID}  -- Replace with actual organization ID
ORDER BY created_at ASC
LIMIT 10;

-- Pick ANY user ID from the above list (preferably an admin or owner)
-- Replace {USER_ID} with that user's ID in the upload queries

-- Alternative: Use the organization's creator
SELECT u.id, u.email, u.first_name, u.last_name, u.role
FROM users u
JOIN organizations o ON o.created_by = u.id
WHERE o.slug = 'strategic-consulting-coaching-llc-vo2w';

-- ============================================
-- Now proceed with the data upload
-- ============================================

-- Step 3: Upload Companies
-- Copy the INSERT INTO companies statement from upload_data.sql
-- Replace {ORG_ID} and {USER_ID} with the values from above

-- Step 4: Upload Contacts
-- Copy the INSERT INTO contacts statement from upload_data.sql  
-- Replace {ORG_ID} and {USER_ID} with the values from above

-- Step 5: Verify the upload
SELECT 
    (SELECT COUNT(*) FROM companies WHERE organization_id = {ORG_ID}) as company_count,
    (SELECT COUNT(*) FROM contacts WHERE organization_id = {ORG_ID}) as contact_count;