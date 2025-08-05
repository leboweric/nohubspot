-- Update Bennett Material Handling users
-- 1. Convert emails to lowercase
-- 2. Update password hash

-- First, verify the current state of these users
SELECT 
  'BEFORE UPDATE' as status,
  u.id, 
  u.email, 
  u.first_name, 
  u.last_name,
  u.organization_id,
  o.name as organization_name
FROM users u
JOIN organizations o ON u.organization_id = o.id
WHERE o.slug = 'bennett-material-handling-bp0s'
AND UPPER(u.email) IN ('RHAUER@BMHMN.COM', 'TAUGE@BMHMN.COM', 'KBUCKMAN@BMHMN.COM');

-- Update the users
UPDATE users 
SET 
  email = LOWER(email),
  password_hash = '$2a$10$lPUiRt3O5Hba0nAiGLPKQOtL.r30cXC8YllgbqxvpKASW0hHyq0Tu',
  updated_at = CURRENT_TIMESTAMP
WHERE organization_id = (
  SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s'
)
AND UPPER(email) IN ('RHAUER@BMHMN.COM', 'TAUGE@BMHMN.COM', 'KBUCKMAN@BMHMN.COM');

-- Verify the updates
SELECT 
  'AFTER UPDATE' as status,
  id, 
  email, 
  first_name, 
  last_name,
  password_hash,
  updated_at
FROM users u
WHERE organization_id = (
  SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s'
)
AND email IN ('rhauer@bmhmn.com', 'tauge@bmhmn.com', 'kbuckman@bmhmn.com');

-- Show all users in Bennett Material Handling org for context
SELECT 
  'ALL BENNETT USERS' as status,
  id,
  email,
  CONCAT(first_name, ' ', last_name) as full_name,
  role,
  is_active,
  created_at
FROM users
WHERE organization_id = (
  SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s'
)
ORDER BY email;