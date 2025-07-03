-- SQL script to remove a tenant and all associated data
-- Replace 'TENANT_SLUG_HERE' with the actual slug of the tenant you want to remove

-- First, let's see what tenants exist
SELECT id, slug, name, created_at FROM tenants ORDER BY created_at DESC;

-- Set the tenant slug you want to remove
-- Example: If your tenant slug is 'profitbuilder-network-mbtd', use that
\set tenant_slug 'profitbuilder-network-mbtd'

-- Get the tenant ID for the slug
SELECT id FROM tenants WHERE slug = :'tenant_slug';

-- IMPORTANT: Make sure you have the correct tenant ID before running the DELETE statements!
-- You can uncomment the following lines and replace TENANT_ID with the actual ID

-- Remove all data associated with this tenant (in correct order to handle foreign keys)

-- 1. Remove activities for this tenant
-- DELETE FROM activities WHERE tenant_id = TENANT_ID;

-- 2. Remove user invites for this tenant
-- DELETE FROM user_invites WHERE tenant_id = TENANT_ID;

-- 3. Remove email signatures for this tenant
-- DELETE FROM email_signatures WHERE tenant_id = TENANT_ID;

-- 4. Remove email messages (via email threads)
-- DELETE FROM email_messages WHERE thread_id IN (
--     SELECT id FROM email_threads WHERE tenant_id = TENANT_ID
-- );

-- 5. Remove email threads for this tenant
-- DELETE FROM email_threads WHERE tenant_id = TENANT_ID;

-- 6. Remove attachments for companies in this tenant
-- DELETE FROM attachments WHERE company_id IN (
--     SELECT id FROM companies WHERE tenant_id = TENANT_ID
-- );

-- 7. Remove tasks for this tenant
-- DELETE FROM tasks WHERE tenant_id = TENANT_ID;

-- 8. Remove contacts for this tenant
-- DELETE FROM contacts WHERE tenant_id = TENANT_ID;

-- 9. Remove companies for this tenant
-- DELETE FROM companies WHERE tenant_id = TENANT_ID;

-- 10. Remove users for this tenant
-- DELETE FROM users WHERE tenant_id = TENANT_ID;

-- 11. Finally, remove the tenant itself
-- DELETE FROM tenants WHERE id = TENANT_ID;

-- Verify the tenant has been removed
-- SELECT COUNT(*) as remaining_tenants FROM tenants WHERE slug = :'tenant_slug';

-- Alternative: If you want to remove ALL tenants and start completely fresh:
-- UNCOMMENT THE FOLLOWING LINES (and comment out the above selective removal)

-- WARNING: This will remove ALL data from ALL tenants!
-- DELETE FROM activities;
-- DELETE FROM user_invites;
-- DELETE FROM email_signatures;
-- DELETE FROM email_messages;
-- DELETE FROM email_threads;
-- DELETE FROM attachments;
-- DELETE FROM tasks;
-- DELETE FROM contacts;
-- DELETE FROM companies;
-- DELETE FROM users;
-- DELETE FROM tenants;

-- Reset auto-increment counters (PostgreSQL)
-- ALTER SEQUENCE tenants_id_seq RESTART WITH 1;
-- ALTER SEQUENCE users_id_seq RESTART WITH 1;
-- ALTER SEQUENCE companies_id_seq RESTART WITH 1;
-- ALTER SEQUENCE contacts_id_seq RESTART WITH 1;
-- ALTER SEQUENCE tasks_id_seq RESTART WITH 1;
-- ALTER SEQUENCE activities_id_seq RESTART WITH 1;
-- ALTER SEQUENCE user_invites_id_seq RESTART WITH 1;
-- ALTER SEQUENCE email_signatures_id_seq RESTART WITH 1;
-- ALTER SEQUENCE email_threads_id_seq RESTART WITH 1;
-- ALTER SEQUENCE email_messages_id_seq RESTART WITH 1;
-- ALTER SEQUENCE attachments_id_seq RESTART WITH 1;