-- Update all document categories to be active
UPDATE document_categories 
SET is_active = true 
WHERE is_active IS NULL;

-- Verify the update
SELECT organization_id, name, is_active FROM document_categories;