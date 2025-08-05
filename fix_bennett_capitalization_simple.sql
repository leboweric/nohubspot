-- Fix ALL CAPS formatting for Bennett Material Handling contacts and companies
-- This script converts ALL CAPS text to proper capitalization

-- Step 1: Show before state (sample)
SELECT 'STEP 1: Sample of contacts BEFORE fix' as step;

SELECT 
    id,
    first_name,
    last_name,
    title,
    company_name,
    phone,
    email
FROM contacts c
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND (first_name = UPPER(first_name) OR last_name = UPPER(last_name))
LIMIT 10;

-- Step 2: Fix contacts using PostgreSQL's INITCAP function
SELECT 'STEP 2: Fixing contact names and titles' as step;

-- Fix first and last names with INITCAP
UPDATE contacts
SET 
    first_name = INITCAP(first_name),
    last_name = INITCAP(last_name),
    title = CASE 
        WHEN title = UPPER(title) THEN INITCAP(title)
        ELSE title
    END,
    company_name = CASE 
        WHEN company_name = UPPER(company_name) THEN INITCAP(company_name)
        ELSE company_name
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND (
    first_name = UPPER(first_name) 
    OR last_name = UPPER(last_name)
    OR (title IS NOT NULL AND title = UPPER(title))
    OR (company_name IS NOT NULL AND company_name = UPPER(company_name))
);

-- Step 3: Fix companies
SELECT 'STEP 3: Fixing company names and addresses' as step;

UPDATE companies
SET 
    name = CASE 
        WHEN name = UPPER(name) THEN INITCAP(name)
        ELSE name
    END,
    street_address = CASE 
        WHEN street_address = UPPER(street_address) THEN INITCAP(street_address)
        ELSE street_address
    END,
    city = CASE 
        WHEN city = UPPER(city) THEN INITCAP(city)
        ELSE city
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND (
    name = UPPER(name)
    OR (street_address IS NOT NULL AND street_address = UPPER(street_address))
    OR (city IS NOT NULL AND city = UPPER(city))
);

-- Step 4: Manual fixes for common abbreviations that should stay uppercase
-- Fix LLC, INC, etc. in company names
UPDATE companies
SET name = REGEXP_REPLACE(
    REGEXP_REPLACE(
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                REGEXP_REPLACE(name, '\sLlc\b', ' LLC', 'g'),
                '\sInc\b', ' INC', 'g'
            ),
            '\sCorp\b', ' CORP', 'g'
        ),
        '\sCo\b', ' CO', 'g'
    ),
    '\sLtd\b', ' LTD', 'g'
)
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND updated_at >= NOW() - INTERVAL '5 minutes';

-- Fix directionals (NW, NE, SW, SE) in addresses
UPDATE companies
SET street_address = REGEXP_REPLACE(
    REGEXP_REPLACE(
        REGEXP_REPLACE(
            REGEXP_REPLACE(street_address, '\sNw\b', ' NW', 'g'),
            '\sNe\b', ' NE', 'g'
        ),
        '\sSw\b', ' SW', 'g'
    ),
    '\sSe\b', ' SE', 'g'
)
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND street_address IS NOT NULL
AND updated_at >= NOW() - INTERVAL '5 minutes';

-- Fix ordinal numbers (1st, 2nd, 3rd, 4th, etc.) to uppercase
UPDATE companies
SET street_address = REGEXP_REPLACE(
    REGEXP_REPLACE(
        REGEXP_REPLACE(
            REGEXP_REPLACE(street_address, '([0-9]+)st\b', '\1ST', 'gi'),
            '([0-9]+)nd\b', '\1ND', 'gi'
        ),
        '([0-9]+)rd\b', '\1RD', 'gi'
    ),
    '([0-9]+)th\b', '\1TH', 'gi'
)
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND street_address IS NOT NULL
AND updated_at >= NOW() - INTERVAL '5 minutes';

-- Step 5: Show after state (sample)
SELECT 'STEP 5: Sample of contacts AFTER fix' as step;

SELECT 
    id,
    first_name,
    last_name,
    title,
    company_name,
    phone,
    email
FROM contacts c
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
ORDER BY last_name, first_name
LIMIT 10;

-- Step 6: Show sample of companies after fix
SELECT 'STEP 6: Sample of companies AFTER fix' as step;

SELECT 
    id,
    name,
    street_address,
    city,
    state
FROM companies
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
ORDER BY name
LIMIT 10;

-- Step 7: Summary of changes
SELECT 'STEP 7: Summary of changes' as step;

SELECT 
    'Contacts updated' as entity,
    COUNT(*) as count
FROM contacts
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND updated_at >= NOW() - INTERVAL '10 minutes'
UNION ALL
SELECT 
    'Companies updated' as entity,
    COUNT(*) as count
FROM companies
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND updated_at >= NOW() - INTERVAL '10 minutes';