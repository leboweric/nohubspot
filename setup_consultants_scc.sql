-- Setup Consultants for Strategic Consulting & Coaching, LLC
-- This script will:
-- 1. Check which consultants already exist as users
-- 2. Add missing consultants
-- 3. Verify all consultants are available in the dropdown

-- Step 1: Verify which consultants already exist
SELECT 
  'STEP 1: Checking existing consultants' AS step;

WITH consultant_list AS (
  SELECT unnest(ARRAY[
    'Cheryl Jensen',
    'Renae Oswald Anderson', 
    'Andréa Kish-Bailey',
    'Imogen Davis',
    'Dan Bartholomay',
    'Susan Marschalk',
    'Molly Schwartz',
    'Susan Rostkoski',
    'Cecily Harris',
    'Christopher Taykalo',
    'Jennifer Hipple',
    'Michelle Basham',
    'Dori Marty',
    'Krista Harding'
  ]) AS full_name
)
SELECT 
  cl.full_name,
  u.email,
  u.id,
  u.role,
  CASE WHEN u.id IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM consultant_list cl
LEFT JOIN users u ON (
  -- Try to match by full name (first + last)
  CONCAT(u.first_name, ' ', u.last_name) = cl.full_name
  -- Also check if organization matches
  AND u.organization_id = 7
)
ORDER BY cl.full_name;

-- Step 2: Insert missing consultants
-- Note: We'll use a standardized email format: firstname.lastname@strategic-cc.com
-- Password will be 'abc123' (hashed)

SELECT 
  'STEP 2: Adding missing consultants' AS step;

-- Insert missing consultants
INSERT INTO users (
  email,
  password_hash,
  first_name,
  last_name,
  organization_id,
  role,
  is_active,
  email_verified,
  created_at,
  updated_at
)
SELECT 
  -- Generate email from name
  LOWER(
    REPLACE(
      REPLACE(
        REPLACE(
          CONCAT(
            SPLIT_PART(cl.full_name, ' ', 1), 
            '.', 
            SPLIT_PART(cl.full_name, ' ', ARRAY_LENGTH(STRING_TO_ARRAY(cl.full_name, ' '), 1))
          ),
          'é', 'e'
        ),
        'è', 'e'
      ),
      '''', ''
    )
  ) || '@strategic-cc.com' AS email,
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYpfQwBylPrX6yC' AS password_hash, -- abc123
  SPLIT_PART(cl.full_name, ' ', 1) AS first_name,
  -- Handle last names (everything after first space)
  SUBSTRING(cl.full_name FROM POSITION(' ' IN cl.full_name) + 1) AS last_name,
  7 AS organization_id, -- Strategic Consulting & Coaching, LLC
  'user' AS role,
  true AS is_active,
  false AS email_verified,
  CURRENT_TIMESTAMP AS created_at,
  CURRENT_TIMESTAMP AS updated_at
FROM (
  SELECT unnest(ARRAY[
    'Cheryl Jensen',
    'Renae Oswald Anderson', 
    'Andréa Kish-Bailey',
    'Imogen Davis',
    'Dan Bartholomay',
    'Susan Marschalk',
    'Molly Schwartz',
    'Susan Rostkoski',
    'Cecily Harris',
    'Christopher Taykalo',
    'Jennifer Hipple',
    'Michelle Basham',
    'Dori Marty',
    'Krista Harding'
  ]) AS full_name
) AS cl
WHERE NOT EXISTS (
  SELECT 1 FROM users u 
  WHERE CONCAT(u.first_name, ' ', u.last_name) = cl.full_name
  AND u.organization_id = 7
);

-- Step 3: Verify all consultants are now in the system
SELECT 
  'STEP 3: Final verification - All consultants in the system' AS step;

SELECT 
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  CONCAT(u.first_name, ' ', u.last_name) AS full_name,
  u.role,
  u.is_active
FROM users u
WHERE u.organization_id = 7
AND CONCAT(u.first_name, ' ', u.last_name) IN (
  'Cheryl Jensen',
  'Renae Oswald Anderson', 
  'Andréa Kish-Bailey',
  'Imogen Davis',
  'Dan Bartholomay',
  'Susan Marschalk',
  'Molly Schwartz',
  'Susan Rostkoski',
  'Cecily Harris',
  'Christopher Taykalo',
  'Jennifer Hipple',
  'Michelle Basham',
  'Dori Marty',
  'Krista Harding'
)
ORDER BY u.last_name, u.first_name;

-- Step 4: Show all active users in Strategic Consulting & Coaching, LLC
-- (These will all appear in the consultant dropdown)
SELECT 
  'STEP 4: All users in SCC organization (available in dropdown)' AS step;

SELECT 
  u.id,
  u.email,
  CONCAT(u.first_name, ' ', u.last_name) AS full_name,
  u.role,
  u.is_active,
  u.created_at
FROM users u
WHERE u.organization_id = 7
AND u.is_active = true
ORDER BY u.last_name, u.first_name;

-- Optional: Update specific emails if needed
-- For example, if some consultants have specific email addresses:
/*
UPDATE users SET email = 'cheryl.jensen@strategic-cc.com' 
WHERE first_name = 'Cheryl' AND last_name = 'Jensen' AND organization_id = 7;

UPDATE users SET email = 'renae.oswald@strategic-cc.com' 
WHERE first_name = 'Renae' AND last_name = 'Oswald Anderson' AND organization_id = 7;

-- etc...
*/