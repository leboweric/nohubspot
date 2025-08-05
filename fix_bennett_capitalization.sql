-- Fix ALL CAPS formatting for Bennett Material Handling contacts and companies
-- This script converts ALL CAPS text to proper capitalization

-- Create a function to properly capitalize names (handles special cases)
CREATE OR REPLACE FUNCTION proper_case(input_string TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
    word TEXT;
    words TEXT[];
    i INTEGER;
BEGIN
    IF input_string IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Convert to lowercase first
    result := LOWER(input_string);
    
    -- Split into words
    words := string_to_array(result, ' ');
    result := '';
    
    -- Process each word
    FOR i IN 1..array_length(words, 1) LOOP
        word := words[i];
        
        -- Handle special cases
        IF word IN ('ii', 'iii', 'iv', 'jr', 'sr', 'llc', 'inc', 'co', 'corp', 'ltd', 'lp', 'llp', 'plc', 'nw', 'ne', 'sw', 'se') THEN
            -- Keep these uppercase
            word := UPPER(word);
        ELSIF word IN ('a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with') AND i > 1 THEN
            -- Keep articles and prepositions lowercase (unless first word)
            word := word;
        ELSIF word ~ '^[0-9]+st$|^[0-9]+nd$|^[0-9]+rd$|^[0-9]+th$' THEN
            -- Handle ordinal numbers (1st, 2nd, 3rd, 4th, etc.)
            word := UPPER(word);
        ELSIF word ~ '^[a-z]+-[0-9]+' OR word ~ '^[0-9]+-[a-z]+' THEN
            -- Handle codes like "a-1" or "7-sigma"
            word := UPPER(word);
        ELSIF word LIKE '%''%' AND POSITION('''' IN word) > 1 THEN
            -- Handle names with apostrophes (O'Brien, D'Angelo)
            word := UPPER(SUBSTRING(word, 1, 1)) || 
                    SUBSTRING(word, 2, POSITION('''' IN word) - 1) || 
                    '''' || 
                    UPPER(SUBSTRING(word, POSITION('''' IN word) + 1, 1)) || 
                    SUBSTRING(word FROM POSITION('''' IN word) + 2);
        ELSIF word LIKE '%-%' AND word !~ '^[0-9]' THEN
            -- Handle hyphenated names (but not numbers like 7-sigma)
            word := UPPER(SUBSTRING(word, 1, 1)) || 
                    SUBSTRING(word, 2, POSITION('-' IN word) - 1) || 
                    '-' || 
                    UPPER(SUBSTRING(word, POSITION('-' IN word) + 1, 1)) || 
                    SUBSTRING(word FROM POSITION('-' IN word) + 2);
        ELSIF word LIKE 'mc%' AND LENGTH(word) > 2 THEN
            -- Handle Scottish names (McDonald, McBride)
            word := 'Mc' || UPPER(SUBSTRING(word, 3, 1)) || SUBSTRING(word FROM 4);
        ELSIF word LIKE 'mac%' AND LENGTH(word) > 3 THEN
            -- Handle Scottish names (MacDonald)
            word := 'Mac' || UPPER(SUBSTRING(word, 4, 1)) || SUBSTRING(word FROM 5);
        ELSE
            -- Normal capitalization
            word := UPPER(SUBSTRING(word, 1, 1)) || SUBSTRING(word FROM 2);
        END IF;
        
        -- Add to result
        IF result = '' THEN
            result := word;
        ELSE
            result := result || ' ' || word;
        END IF;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

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

-- Step 2: Fix contacts
SELECT 'STEP 2: Fixing contact names and titles' as step;

UPDATE contacts
SET 
    first_name = proper_case(first_name),
    last_name = proper_case(last_name),
    title = CASE 
        WHEN title = UPPER(title) THEN proper_case(title)
        ELSE title
    END,
    company_name = CASE 
        WHEN company_name = UPPER(company_name) THEN proper_case(company_name)
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
        WHEN name = UPPER(name) THEN proper_case(name)
        ELSE name
    END,
    street_address = CASE 
        WHEN street_address = UPPER(street_address) THEN proper_case(street_address)
        ELSE street_address
    END,
    city = CASE 
        WHEN city = UPPER(city) THEN proper_case(city)
        ELSE city
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND (
    name = UPPER(name)
    OR (street_address IS NOT NULL AND street_address = UPPER(street_address))
    OR (city IS NOT NULL AND city = UPPER(city))
);

-- Step 4: Show after state (sample)
SELECT 'STEP 4: Sample of contacts AFTER fix' as step;
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

-- Step 5: Summary of changes
SELECT 'STEP 5: Summary of changes' as step;
SELECT 
    'Contacts updated' as entity,
    COUNT(*) as count
FROM contacts
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND updated_at >= NOW() - INTERVAL '5 minutes'
UNION ALL
SELECT 
    'Companies updated' as entity,
    COUNT(*) as count
FROM companies
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'bennett-material-handling-bp0s')
AND updated_at >= NOW() - INTERVAL '5 minutes';

-- Clean up the function
DROP FUNCTION IF EXISTS proper_case(TEXT);