-- Clean up zip codes for Bennett Material Handling only
-- Removes the +4 extension (-xxxx) from ZIP codes

-- Step 1: Show Bennett companies with extended zip codes (ZIP+4 format)
SELECT 'STEP 1: Bennett companies with ZIP+4 format' as step;

SELECT 
    id,
    name,
    postal_code,
    city,
    state
FROM companies
WHERE postal_code LIKE '%-%'
AND organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
ORDER BY name;

-- Step 2: Count how many Bennett records need cleaning
SELECT 'STEP 2: Count of Bennett records needing cleanup' as step;

SELECT 
    COUNT(*) as bennett_companies_with_zip_plus_4,
    COUNT(DISTINCT postal_code) as unique_zip_codes
FROM companies
WHERE postal_code LIKE '%-%'
AND organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s');

-- Step 3: Preview the cleanup for Bennett (show before and after)
SELECT 'STEP 3: Preview of Bennett zip code cleanup' as step;

SELECT 
    id,
    name,
    postal_code as current_zip,
    SUBSTRING(postal_code FROM 1 FOR POSITION('-' IN postal_code) - 1) as cleaned_zip,
    city,
    state
FROM companies
WHERE postal_code LIKE '%-%'
AND organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
ORDER BY postal_code
LIMIT 20;

-- Step 4: Clean up Bennett Material Handling zip codes (COMMENTED OUT - Uncomment to execute)
/*
UPDATE companies
SET 
    postal_code = SUBSTRING(postal_code FROM 1 FOR POSITION('-' IN postal_code) - 1),
    updated_at = CURRENT_TIMESTAMP
WHERE postal_code LIKE '%-%'
AND organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s');
*/

-- Step 5: Verify the Bennett cleanup
SELECT 'STEP 5: Verify no more Bennett ZIP+4 formats remain' as step;

SELECT 
    COUNT(*) as remaining_bennett_zip_plus_4
FROM companies
WHERE postal_code LIKE '%-%'
AND organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s');

-- Step 6: Show sample of cleaned Bennett zip codes
SELECT 'STEP 6: Sample of cleaned Bennett zip codes' as step;

SELECT 
    id,
    name,
    postal_code,
    city,
    state
FROM companies
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND updated_at >= NOW() - INTERVAL '5 minutes'
AND postal_code IS NOT NULL
ORDER BY postal_code
LIMIT 20;