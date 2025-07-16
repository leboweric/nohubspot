-- Script to create super user accounts for each organization
-- This will create a user with email: superuser@nothubspot.com for each org
-- Password will be: SuperUser123! for all accounts (change after first login)

-- First, let's see what organizations exist
SELECT id, name FROM organizations;

-- Create super user for each organization
DO $$
DECLARE
    org_record RECORD;
    hashed_password TEXT;
BEGIN
    -- Hash the password 'SuperUser123!' using bcrypt
    -- This is the bcrypt hash for 'SuperUser123!'
    hashed_password := '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiLXCJoD/QsC';
    
    -- Loop through each organization
    FOR org_record IN SELECT id, name FROM organizations
    LOOP
        -- Check if super user already exists for this org
        IF NOT EXISTS (
            SELECT 1 FROM users 
            WHERE email = 'superuser@nothubspot.com' 
            AND organization_id = org_record.id
        ) THEN
            -- Insert super user for this organization
            INSERT INTO users (
                email,
                hashed_password,
                first_name,
                last_name,
                role,
                is_active,
                organization_id,
                created_at,
                updated_at,
                email_verified
            ) VALUES (
                'superuser@nothubspot.com',
                hashed_password,
                'Super',
                'User',
                'owner',  -- Give owner role for full access
                true,
                org_record.id,
                NOW(),
                NOW(),
                true  -- Mark as verified
            );
            
            RAISE NOTICE 'Created super user for organization: % (ID: %)', org_record.name, org_record.id;
        ELSE
            RAISE NOTICE 'Super user already exists for organization: % (ID: %)', org_record.name, org_record.id;
        END IF;
    END LOOP;
END $$;

-- Show all created super users
SELECT 
    u.id,
    u.email,
    u.first_name || ' ' || u.last_name as full_name,
    u.role,
    o.name as organization_name,
    o.id as organization_id
FROM users u
JOIN organizations o ON u.organization_id = o.id
WHERE u.email = 'superuser@nothubspot.com'
ORDER BY o.name;