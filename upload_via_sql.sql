-- Upload Companies and Contacts to Strategic Consulting & Coaching
-- 
-- IMPORTANT: Run these queries in order!
-- First, we need to find the organization and user IDs

-- Step 1: Find the organization ID for Strategic Consulting & Coaching
SELECT id, name, slug FROM organizations 
WHERE slug = 'strategic-consulting-coaching-llc-vo2w';

-- Note the organization ID from above (let's assume it's stored in @org_id)
-- Replace {ORG_ID} with the actual ID in the queries below

-- Step 2: Find a user in this organization to use as created_by
SELECT id, email, first_name, last_name, role 
FROM users 
WHERE organization_id = {ORG_ID} 
AND email = 'eleblow@bmhmn.com';

-- Note the user ID from above (let's assume it's stored in @user_id)
-- Replace {USER_ID} with the actual ID in the queries below

-- Step 3: Insert Companies
-- Run this first to create all companies
INSERT INTO companies (
    name, 
    street_address, 
    city, 
    state, 
    postal_code, 
    website, 
    description, 
    status,
    organization_id, 
    created_by_id, 
    created_at, 
    updated_at
) VALUES