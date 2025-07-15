-- Fix NULL values in company counts
UPDATE companies 
SET contact_count = 0 
WHERE contact_count IS NULL;

UPDATE companies 
SET attachment_count = 0 
WHERE attachment_count IS NULL;

UPDATE companies 
SET status = 'Active' 
WHERE status IS NULL;

-- Add NOT NULL constraints to prevent future issues
ALTER TABLE companies 
ALTER COLUMN contact_count SET NOT NULL,
ALTER COLUMN attachment_count SET NOT NULL;

-- Set default for status if not already set
ALTER TABLE companies 
ALTER COLUMN status SET DEFAULT 'Active';