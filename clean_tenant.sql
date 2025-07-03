-- Simple script to remove the tenant 'profitbuilder-network-mbtd' and all associated data
-- Run this in your PostgreSQL console

-- Step 1: Check what tenants exist
SELECT id, slug, name, created_at FROM tenants ORDER BY created_at DESC;

-- Step 2: Remove all data for the specific tenant (replace the slug as needed)
-- This will cascade and remove all associated data due to foreign key constraints

-- Get the tenant ID first
DO $$
DECLARE
    tenant_id_to_delete INTEGER;
BEGIN
    -- Get the tenant ID for 'profitbuilder-network-mbtd' (change this if your slug is different)
    SELECT id INTO tenant_id_to_delete FROM tenants WHERE slug = 'profitbuilder-network-mbtd';
    
    IF tenant_id_to_delete IS NOT NULL THEN
        -- Remove all data in correct order
        DELETE FROM activities WHERE tenant_id = tenant_id_to_delete;
        DELETE FROM user_invites WHERE tenant_id = tenant_id_to_delete;
        DELETE FROM email_signatures WHERE tenant_id = tenant_id_to_delete;
        DELETE FROM email_messages WHERE thread_id IN (
            SELECT id FROM email_threads WHERE tenant_id = tenant_id_to_delete
        );
        DELETE FROM email_threads WHERE tenant_id = tenant_id_to_delete;
        DELETE FROM attachments WHERE company_id IN (
            SELECT id FROM companies WHERE tenant_id = tenant_id_to_delete
        );
        DELETE FROM tasks WHERE tenant_id = tenant_id_to_delete;
        DELETE FROM contacts WHERE tenant_id = tenant_id_to_delete;
        DELETE FROM companies WHERE tenant_id = tenant_id_to_delete;
        DELETE FROM users WHERE tenant_id = tenant_id_to_delete;
        DELETE FROM tenants WHERE id = tenant_id_to_delete;
        
        RAISE NOTICE 'Tenant with ID % has been removed successfully', tenant_id_to_delete;
    ELSE
        RAISE NOTICE 'Tenant with slug "profitbuilder-network-mbtd" not found';
    END IF;
END $$;

-- Step 3: Verify the tenant has been removed
SELECT COUNT(*) as remaining_tenants FROM tenants WHERE slug = 'profitbuilder-network-mbtd';

-- Step 4: Check all remaining tenants
SELECT id, slug, name, created_at FROM tenants ORDER BY created_at DESC;