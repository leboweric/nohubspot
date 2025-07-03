-- Cleanup script to remove duplicate Profitbuilder organizations
-- Run these commands one by one in pgAdmin

-- First, let's see what organizations exist
SELECT id, name, slug, created_at FROM organizations WHERE name ILIKE '%profitbuilder%';

-- See what users are associated with each organization
SELECT u.id, u.email, u.first_name, u.last_name, u.organization_id, o.name as org_name 
FROM users u 
JOIN organizations o ON u.organization_id = o.id 
WHERE o.name ILIKE '%profitbuilder%';

-- Step 1: Clear the created_by foreign key reference for all Profitbuilder organizations
UPDATE organizations SET created_by = NULL WHERE name ILIKE '%profitbuilder%';

-- Step 2: Delete all data associated with Profitbuilder organizations
-- Get the organization IDs first
-- Replace the IDs below with the actual IDs from your SELECT query above

-- Delete activities
DELETE FROM activities WHERE organization_id IN (
    SELECT id FROM organizations WHERE name ILIKE '%profitbuilder%'
);

-- Delete user invites  
DELETE FROM user_invites WHERE organization_id IN (
    SELECT id FROM organizations WHERE name ILIKE '%profitbuilder%'
);

-- Delete email signatures
DELETE FROM email_signatures WHERE organization_id IN (
    SELECT id FROM organizations WHERE name ILIKE '%profitbuilder%'
);

-- Delete email messages (through email threads)
DELETE FROM email_messages WHERE thread_id IN (
    SELECT id FROM email_threads WHERE organization_id IN (
        SELECT id FROM organizations WHERE name ILIKE '%profitbuilder%'
    )
);

-- Delete email threads
DELETE FROM email_threads WHERE organization_id IN (
    SELECT id FROM organizations WHERE name ILIKE '%profitbuilder%'
);

-- Delete attachments (through companies)
DELETE FROM attachments WHERE company_id IN (
    SELECT id FROM companies WHERE organization_id IN (
        SELECT id FROM organizations WHERE name ILIKE '%profitbuilder%'
    )
);

-- Delete tasks
DELETE FROM tasks WHERE organization_id IN (
    SELECT id FROM organizations WHERE name ILIKE '%profitbuilder%'
);

-- Delete contacts
DELETE FROM contacts WHERE organization_id IN (
    SELECT id FROM organizations WHERE name ILIKE '%profitbuilder%'
);

-- Delete companies
DELETE FROM companies WHERE organization_id IN (
    SELECT id FROM organizations WHERE name ILIKE '%profitbuilder%'
);

-- Delete users
DELETE FROM users WHERE organization_id IN (
    SELECT id FROM organizations WHERE name ILIKE '%profitbuilder%'
);

-- Finally, delete the organizations
DELETE FROM organizations WHERE name ILIKE '%profitbuilder%';

-- Verify cleanup - these should return 0 rows
SELECT * FROM organizations WHERE name ILIKE '%profitbuilder%';
SELECT * FROM users WHERE organization_id IN (
    SELECT id FROM organizations WHERE name ILIKE '%profitbuilder%'
);