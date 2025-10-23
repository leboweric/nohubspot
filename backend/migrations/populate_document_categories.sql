SELECT 
    o.id as org_id,
    o.name as org_name,
    COUNT(dc.id) as category_count
FROM organizations o
LEFT JOIN document_categories dc ON dc.organization_id = o.id
GROUP BY o.id, o.name;
INSERT INTO document_categories (organization_id, name, description, slug, color, icon, sort_order, keywords, file_extensions, is_system)
SELECT 
    o.id,
    cat.name,
    cat.description,
    cat.slug,
    cat.color,
    cat.icon,
    cat.sort_order,
    cat.keywords::jsonb,
    cat.file_extensions::jsonb,
    true
FROM organizations o
CROSS JOIN (
    VALUES 
    ('Proposals & Quotes', 'Sales proposals, quotes, and RFPs', 'proposals-quotes', '#3B82F6', 'FileText', 1, 
     '["proposal", "quote", "rfp", "rfq", "estimate", "bid"]'::text, '[".pdf", ".docx", ".doc"]'::text),
    ('Contracts & Agreements', 'Legal contracts, SOWs, NDAs, and agreements', 'contracts', '#10B981', 'FileSignature', 2,
     '["contract", "agreement", "sow", "nda", "msa", "legal"]'::text, '[".pdf", ".docx"]'::text),
    ('Financial Documents', 'Invoices, statements, purchase orders', 'financial', '#F59E0B', 'DollarSign', 3,
     '["invoice", "statement", "purchase", "order", "payment", "receipt"]'::text, '[".pdf", ".xlsx", ".csv"]'::text),
    ('Communications', 'Important emails, meeting notes, correspondence', 'communications', '#8B5CF6', 'MessageSquare', 4,
     '["email", "memo", "notes", "minutes", "correspondence"]'::text, '[".pdf", ".docx", ".txt", ".msg"]'::text),
    ('Technical Specs', 'Requirements, specifications, diagrams', 'technical', '#EF4444', 'Settings', 5,
     '["spec", "requirement", "technical", "diagram", "architecture"]'::text, '[".pdf", ".docx", ".vsd", ".png", ".jpg"]'::text),
    ('Presentations', 'Sales decks, demos, training materials', 'presentations', '#06B6D4', 'Presentation', 6,
     '["presentation", "deck", "slides", "demo", "training"]'::text, '[".pptx", ".ppt", ".pdf", ".key"]'::text)
) AS cat(name, description, slug, color, icon, sort_order, keywords, file_extensions)
WHERE NOT EXISTS (
    SELECT 1 FROM document_categories dc 
    WHERE dc.organization_id = o.id AND dc.slug = cat.slug
);
SELECT 
    o.id as org_id,
    o.name as org_name,
    COUNT(dc.id) as category_count
FROM organizations o
LEFT JOIN document_categories dc ON dc.organization_id = o.id
GROUP BY o.id, o.name;