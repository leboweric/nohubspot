INSERT INTO document_categories (organization_id, name, description, slug, color, icon, sort_order, keywords, file_extensions, is_system, is_active)
SELECT 
    org.id,
    cat.name,
    cat.description,
    cat.slug,
    cat.color,
    cat.icon,
    cat.sort_order,
    cat.keywords,
    cat.file_extensions,
    cat.is_system,
    cat.is_active
FROM 
    (SELECT id FROM organizations ORDER BY id LIMIT 1) org,
    (VALUES 
        ('Proposals & Quotes', 'Sales proposals, quotes, and RFPs', 'proposals-quotes', '#3B82F6', 'FileText', 1, 
         '["proposal", "quote", "rfp", "rfq", "estimate", "bid"]'::jsonb, '[".pdf", ".docx", ".doc"]'::jsonb, true, true),
        ('Contracts & Agreements', 'Legal contracts, SOWs, NDAs, and agreements', 'contracts', '#10B981', 'FileSignature', 2,
         '["contract", "agreement", "sow", "nda", "msa", "legal"]'::jsonb, '[".pdf", ".docx"]'::jsonb, true, true),
        ('Financial Documents', 'Invoices, statements, purchase orders', 'financial', '#F59E0B', 'DollarSign', 3,
         '["invoice", "statement", "purchase", "order", "payment", "receipt"]'::jsonb, '[".pdf", ".xlsx", ".csv"]'::jsonb, true, true),
        ('Communications', 'Important emails, meeting notes, correspondence', 'communications', '#8B5CF6', 'MessageSquare', 4,
         '["email", "memo", "notes", "minutes", "correspondence"]'::jsonb, '[".pdf", ".docx", ".txt", ".msg"]'::jsonb, true, true),
        ('Technical Specs', 'Requirements, specifications, diagrams', 'technical', '#EF4444', 'Settings', 5,
         '["spec", "requirement", "technical", "diagram", "architecture"]'::jsonb, '[".pdf", ".docx", ".vsd", ".png", ".jpg"]'::jsonb, true, true),
        ('Presentations', 'Sales decks, demos, training materials', 'presentations', '#06B6D4', 'Presentation', 6,
         '["presentation", "deck", "slides", "demo", "training"]'::jsonb, '[".pptx", ".ppt", ".pdf", ".key"]'::jsonb, true, true)
    ) AS cat(name, description, slug, color, icon, sort_order, keywords, file_extensions, is_system, is_active)
WHERE NOT EXISTS (SELECT 1 FROM document_categories LIMIT 1);