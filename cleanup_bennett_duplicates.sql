-- Clean up duplicate companies for Bennett Material Handling
-- Only removes TRUE duplicates (same name AND same city or zip)

-- Step 1: Find duplicate companies by name + city
SELECT 'STEP 1: Duplicate companies by name + city' as step;

WITH duplicate_companies AS (
    SELECT 
        name,
        city,
        COUNT(*) as duplicate_count,
        STRING_AGG(id::text, ', ' ORDER BY created_at) as company_ids,
        MIN(id) as keep_id,
        MIN(created_at) as oldest_created
    FROM companies
    WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
    AND city IS NOT NULL AND city != ''
    GROUP BY name, city
    HAVING COUNT(*) > 1
)
SELECT 
    dc.name,
    dc.city,
    dc.duplicate_count,
    dc.company_ids,
    dc.keep_id as id_to_keep,
    (SELECT COUNT(*) FROM contacts WHERE company_id = ANY(STRING_TO_ARRAY(dc.company_ids, ', ')::int[])) as total_contacts
FROM duplicate_companies dc
ORDER BY dc.duplicate_count DESC, dc.name;

-- Step 2: Find duplicate companies by name + postal_code
SELECT 'STEP 2: Duplicate companies by name + postal code' as step;

WITH duplicate_companies AS (
    SELECT 
        name,
        postal_code,
        COUNT(*) as duplicate_count,
        STRING_AGG(id::text, ', ' ORDER BY created_at) as company_ids,
        MIN(id) as keep_id,
        MIN(created_at) as oldest_created
    FROM companies
    WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
    AND postal_code IS NOT NULL AND postal_code != ''
    GROUP BY name, postal_code
    HAVING COUNT(*) > 1
)
SELECT 
    dc.name,
    dc.postal_code,
    dc.duplicate_count,
    dc.company_ids,
    dc.keep_id as id_to_keep,
    (SELECT COUNT(*) FROM contacts WHERE company_id = ANY(STRING_TO_ARRAY(dc.company_ids, ', ')::int[])) as total_contacts
FROM duplicate_companies dc
ORDER BY dc.duplicate_count DESC, dc.name;

-- Step 3: Show examples like ACME Tools that are NOT duplicates
SELECT 'STEP 3: Companies with same name but different locations (NOT duplicates)' as step;

WITH name_groups AS (
    SELECT 
        name,
        COUNT(DISTINCT city) as city_count,
        COUNT(*) as total_count,
        STRING_AGG(DISTINCT city || ' (' || COALESCE(state, 'No State') || ')', ', ') as locations
    FROM companies
    WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
    GROUP BY name
    HAVING COUNT(DISTINCT city) > 1
)
SELECT * FROM name_groups
ORDER BY total_count DESC
LIMIT 10;

-- Step 4: Detailed view of true duplicates to be merged
SELECT 'STEP 4: Detailed view of duplicates to be merged' as step;

WITH duplicate_pairs AS (
    SELECT 
        c1.id as id1,
        c2.id as id2,
        c1.name,
        c1.city,
        c1.postal_code,
        c1.created_at as created1,
        c2.created_at as created2,
        (SELECT COUNT(*) FROM contacts WHERE company_id = c1.id) as contacts1,
        (SELECT COUNT(*) FROM contacts WHERE company_id = c2.id) as contacts2
    FROM companies c1
    JOIN companies c2 ON c1.name = c2.name 
        AND (c1.city = c2.city OR c1.postal_code = c2.postal_code)
        AND c1.id < c2.id
    WHERE c1.organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
    AND c2.organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
)
SELECT * FROM duplicate_pairs
ORDER BY name;

-- Step 5: Merge contacts from duplicate companies (COMMENTED OUT - Uncomment to execute)
-- This moves all contacts from duplicate companies to the oldest company record
/*
WITH duplicates_to_merge AS (
    SELECT 
        name,
        city,
        MIN(id) as keep_id,
        ARRAY_AGG(id ORDER BY created_at) as all_ids
    FROM companies
    WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
    AND city IS NOT NULL AND city != ''
    GROUP BY name, city
    HAVING COUNT(*) > 1
)
UPDATE contacts
SET company_id = dtm.keep_id,
    company_name = c.name,
    updated_at = CURRENT_TIMESTAMP
FROM duplicates_to_merge dtm
JOIN companies c ON c.id = dtm.keep_id
WHERE contacts.company_id = ANY(dtm.all_ids)
AND contacts.company_id != dtm.keep_id;
*/

-- Step 6: Delete duplicate companies after merging contacts (COMMENTED OUT - Uncomment to execute)
/*
WITH duplicates_to_delete AS (
    SELECT 
        name,
        city,
        MIN(id) as keep_id,
        ARRAY_AGG(id ORDER BY created_at) as all_ids
    FROM companies
    WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
    AND city IS NOT NULL AND city != ''
    GROUP BY name, city
    HAVING COUNT(*) > 1
)
DELETE FROM companies
WHERE id IN (
    SELECT unnest(all_ids)
    FROM duplicates_to_delete
    WHERE id != ALL(ARRAY[keep_id])
)
AND organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s');
*/

-- Step 7: Summary of what would be cleaned
SELECT 'STEP 7: Summary of cleanup impact' as step;

WITH duplicate_stats AS (
    SELECT 
        name,
        city,
        COUNT(*) as duplicate_count,
        MIN(id) as keep_id
    FROM companies
    WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
    AND city IS NOT NULL AND city != ''
    GROUP BY name, city
    HAVING COUNT(*) > 1
)
SELECT 
    COUNT(DISTINCT name || city) as unique_duplicate_sets,
    SUM(duplicate_count) - COUNT(DISTINCT name || city) as companies_to_delete,
    (SELECT COUNT(*) FROM contacts WHERE company_id IN (
        SELECT id FROM companies c
        JOIN duplicate_stats ds ON c.name = ds.name AND c.city = ds.city
        WHERE c.id != ds.keep_id
    )) as contacts_to_move
FROM duplicate_stats;