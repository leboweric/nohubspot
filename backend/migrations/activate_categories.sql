UPDATE document_categories 
SET is_active = true 
WHERE is_active IS NULL;

SELECT organization_id, name, is_active FROM document_categories;