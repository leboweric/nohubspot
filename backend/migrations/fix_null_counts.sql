UPDATE companies 
SET contact_count = 0 
WHERE contact_count IS NULL;

UPDATE companies 
SET attachment_count = 0 
WHERE attachment_count IS NULL;

UPDATE companies 
SET status = 'Active' 
WHERE status IS NULL;

ALTER TABLE companies 
ALTER COLUMN contact_count SET NOT NULL,
ALTER COLUMN attachment_count SET NOT NULL;

ALTER TABLE companies 
ALTER COLUMN status SET DEFAULT 'Active';