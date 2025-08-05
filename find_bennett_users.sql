-- Find Bennett Material Handling organization and users

-- Step 1: Find the Bennett organization
SELECT 
  id,
  name,
  slug,
  created_at
FROM organizations
WHERE name LIKE '%Bennett%' 
   OR slug LIKE '%bennett%';

-- Step 2: Find all users in Bennett organization (using the org name)
SELECT 
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  u.role,
  u.is_active,
  o.name as organization_name,
  o.slug as organization_slug
FROM users u
JOIN organizations o ON u.organization_id = o.id
WHERE o.name LIKE '%Bennett%'
ORDER BY u.email;

-- Step 3: Check specifically for the emails we're looking for (case-insensitive)
SELECT 
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  o.name as organization_name
FROM users u
JOIN organizations o ON u.organization_id = o.id
WHERE LOWER(u.email) IN ('rhauer@bmhmn.com', 'tauge@bmhmn.com', 'kbuckman@bmhmn.com')
   OR UPPER(u.email) IN ('RHAUER@BMHMN.COM', 'TAUGE@BMHMN.COM', 'KBUCKMAN@BMHMN.COM')
   OR u.email LIKE '%@bmhmn.com';

-- Step 4: Show all users with @bmhmn.com emails regardless of organization
SELECT 
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  u.organization_id,
  o.name as organization_name,
  o.slug as organization_slug
FROM users u
LEFT JOIN organizations o ON u.organization_id = o.id
WHERE u.email LIKE '%@bmhmn.com'
ORDER BY u.email;