-- Check if categories were created for your organization
-- First, let's see all organizations
SELECT id, name FROM organizations;

-- Then check how many categories each organization has
SELECT 
    o.id as org_id,
    o.name as org_name,
    COUNT(dc.id) as category_count
FROM organizations o
LEFT JOIN document_categories dc ON dc.organization_id = o.id
GROUP BY o.id, o.name;

-- See all categories (if any)
SELECT * FROM document_categories;

-- If no categories exist, let's manually insert them for organization ID 1
-- (replace 1 with your actual organization ID from the first query)
INSERT INTO document_categories (organization_id, name, description, slug, color, icon, sort_order, keywords, file_extensions, is_system, is_active)
VALUES 
    (1, 'Proposals & Quotes', 'Sales proposals, quotes, and RFPs', 'proposals-quotes', '#3B82F6', 'FileText', 1, 
     '["proposal", "quote", "rfp", "rfq", "estimate", "bid"]'::jsonb, '[".pdf", ".docx", ".doc"]'::jsonb, true, true),
    (1, 'Contracts & Agreements', 'Legal contracts, SOWs, NDAs, and agreements', 'contracts', '#10B981', 'FileSignature', 2,
     '["contract", "agreement", "sow", "nda", "msa", "legal"]'::jsonb, '[".pdf", ".docx"]'::jsonb, true, true),
    (1, 'Financial Documents', 'Invoices, statements, purchase orders', 'financial', '#F59E0B', 'DollarSign', 3,
     '["invoice", "statement", "purchase", "order", "payment", "receipt"]'::jsonb, '[".pdf", ".xlsx", ".csv"]'::jsonb, true, true),
    (1, 'Communications', 'Important emails, meeting notes, correspondence', 'communications', '#8B5CF6', 'MessageSquare', 4,
     '["email", "memo", "notes", "minutes", "correspondence"]'::jsonb, '[".pdf", ".docx", ".txt", ".msg"]'::jsonb, true, true),
    (1, 'Technical Specs', 'Requirements, specifications, diagrams', 'technical', '#EF4444', 'Settings', 5,
     '["spec", "requirement", "technical", "diagram", "architecture"]'::jsonb, '[".pdf", ".docx", ".vsd", ".png", ".jpg"]'::jsonb, true, true),
    (1, 'Presentations', 'Sales decks, demos, training materials', 'presentations', '#06B6D4', 'Presentation', 6,
     '["presentation", "deck", "slides", "demo", "training"]'::jsonb, '[".pptx", ".ppt", ".pdf", ".key"]'::jsonb, true, true);

-- Verify the insert worked
SELECT * FROM document_categories WHERE organization_id = 1;