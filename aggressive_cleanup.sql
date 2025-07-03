-- AGGRESSIVE CLEANUP - Run these commands one by one
-- This will completely reset the database

-- First, let's see exactly what we have
SELECT 'ORGANIZATIONS:' as table_name;
SELECT id, name, slug, created_by FROM organizations;

SELECT 'USERS:' as table_name;
SELECT id, email, first_name, last_name, organization_id FROM users;

-- Option 1: Nuclear option - Delete ALL data from ALL tables
-- Uncomment these lines if you want to start completely fresh

-- TRUNCATE TABLE activities CASCADE;
-- TRUNCATE TABLE user_invites CASCADE;
-- TRUNCATE TABLE email_signatures CASCADE;
-- TRUNCATE TABLE email_messages CASCADE;
-- TRUNCATE TABLE email_threads CASCADE;
-- TRUNCATE TABLE attachments CASCADE;
-- TRUNCATE TABLE tasks CASCADE;
-- TRUNCATE TABLE contacts CASCADE;
-- TRUNCATE TABLE companies CASCADE;
-- TRUNCATE TABLE users CASCADE;
-- TRUNCATE TABLE organizations CASCADE;

-- Option 2: More targeted approach
-- First, let's disable foreign key checks temporarily and force delete

-- Get all organization IDs that contain 'profitbuilder' (case insensitive)
DO $$
DECLARE
    org_ids INTEGER[];
    org_id INTEGER;
BEGIN
    -- Get all profitbuilder organization IDs
    SELECT ARRAY(SELECT id FROM organizations WHERE LOWER(name) LIKE '%profitbuilder%') INTO org_ids;
    
    -- If we found any organizations
    IF array_length(org_ids, 1) > 0 THEN
        RAISE NOTICE 'Found organization IDs: %', org_ids;
        
        -- Delete all related data for each organization
        FOREACH org_id IN ARRAY org_ids LOOP
            RAISE NOTICE 'Cleaning up organization ID: %', org_id;
            
            -- Delete activities
            DELETE FROM activities WHERE organization_id = org_id;
            
            -- Delete user invites
            DELETE FROM user_invites WHERE organization_id = org_id;
            
            -- Delete email signatures
            DELETE FROM email_signatures WHERE organization_id = org_id;
            
            -- Delete email messages via threads
            DELETE FROM email_messages WHERE thread_id IN (
                SELECT id FROM email_threads WHERE organization_id = org_id
            );
            
            -- Delete email threads
            DELETE FROM email_threads WHERE organization_id = org_id;
            
            -- Delete attachments via companies
            DELETE FROM attachments WHERE company_id IN (
                SELECT id FROM companies WHERE organization_id = org_id
            );
            
            -- Delete tasks
            DELETE FROM tasks WHERE organization_id = org_id;
            
            -- Delete contacts
            DELETE FROM contacts WHERE organization_id = org_id;
            
            -- Delete companies
            DELETE FROM companies WHERE organization_id = org_id;
            
            -- Clear created_by reference in organizations
            UPDATE organizations SET created_by = NULL WHERE id = org_id;
            
            -- Delete users
            DELETE FROM users WHERE organization_id = org_id;
            
            -- Delete the organization
            DELETE FROM organizations WHERE id = org_id;
            
            RAISE NOTICE 'Completed cleanup for organization ID: %', org_id;
        END LOOP;
    ELSE
        RAISE NOTICE 'No profitbuilder organizations found';
    END IF;
END $$;

-- Verify the cleanup
SELECT 'REMAINING ORGANIZATIONS:' as status;
SELECT id, name, slug, created_by FROM organizations;

SELECT 'REMAINING USERS:' as status;
SELECT id, email, first_name, last_name, organization_id FROM users;

-- Check for any orphaned data
SELECT 'ORPHANED USERS (no org):' as status;
SELECT id, email, organization_id FROM users 
WHERE organization_id NOT IN (SELECT id FROM organizations);

SELECT 'ORPHANED COMPANIES (no org):' as status;
SELECT id, name, organization_id FROM companies 
WHERE organization_id NOT IN (SELECT id FROM organizations);