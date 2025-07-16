-- =====================================================
-- CREATE SUPER USER ACCOUNTS FOR EACH ORGANIZATION
-- =====================================================
-- This script creates a test account for each organization
-- Email format: superuser+{org_id}@nothubspot.com
-- Password: SuperUser123! (same for all accounts)
-- =====================================================

-- First, let's see what organizations exist
SELECT id, name, domain FROM organizations ORDER BY name;

-- Create super user for each organization
-- The password hash below is for 'SuperUser123!'
-- Generated using bcrypt with 12 rounds
DO $$
DECLARE
    org_record RECORD;
    user_email TEXT;
    user_exists BOOLEAN;
BEGIN
    -- Loop through each organization
    FOR org_record IN SELECT id, name FROM organizations ORDER BY name
    LOOP
        -- Create unique email for this org
        user_email := 'superuser+' || org_record.id || '@nothubspot.com';
        
        -- Check if user already exists
        SELECT EXISTS(
            SELECT 1 FROM users 
            WHERE email = user_email 
            AND organization_id = org_record.id
        ) INTO user_exists;
        
        IF NOT user_exists THEN
            -- Insert super user for this organization
            INSERT INTO users (
                email,
                password_hash,
                first_name,
                last_name,
                role,
                is_active,
                organization_id,
                created_at,
                updated_at,
                email_verified
            ) VALUES (
                user_email,
                '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCJoD/QsC', -- SuperUser123!
                'Super',
                'User',
                'owner',  -- Owner role for full access
                true,
                org_record.id,
                NOW(),
                NOW(),
                true  -- Mark as verified
            );
            
            RAISE NOTICE 'Created super user for %: %', org_record.name, user_email;
        ELSE
            RAISE NOTICE 'Super user already exists for %: %', org_record.name, user_email;
        END IF;
    END LOOP;
END $$;

-- Show all created super users with their organization details
SELECT 
    u.id as user_id,
    u.email,
    u.first_name || ' ' || u.last_name as full_name,
    u.role,
    o.id as org_id,
    o.name as organization_name,
    o.domain as organization_domain,
    u.created_at
FROM users u
JOIN organizations o ON u.organization_id = o.id
WHERE u.email LIKE 'superuser+%@nothubspot.com'
ORDER BY o.name;

-- =====================================================
-- FIND STRATEGIC CONSULTING SPECIFICALLY
-- =====================================================
SELECT 
    '*** STRATEGIC CONSULTING LOGIN INFO ***' as info,
    u.email as "Email",
    'SuperUser123!' as "Password",
    o.name as "Organization"
FROM users u
JOIN organizations o ON u.organization_id = o.id
WHERE o.name ILIKE '%Strategic Consulting%'
AND u.email LIKE 'superuser+%@nothubspot.com';

-- =====================================================
-- OPTIONAL: Remove all super users (if needed)
-- =====================================================
-- Uncomment and run this section if you need to clean up:
/*
DELETE FROM users 
WHERE email LIKE 'superuser+%@nothubspot.com';
*/