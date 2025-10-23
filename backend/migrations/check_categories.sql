-- Fixed version of check_categories.sql
-- This migration safely inserts default document categories only if:
-- 1. At least one organization exists in the database
-- 2. No document categories have been created yet

DO $
DECLARE
    org_id INTEGER;
    category_count INTEGER;
BEGIN
    -- Check if any categories already exist
    SELECT COUNT(*) INTO category_count FROM document_categories;
    
    -- Only proceed if no categories exist
    IF category_count = 0 THEN
        -- Get the first organization ID
        SELECT id INTO org_id FROM organizations ORDER BY id LIMIT 1;
        
        -- Only insert if an organization exists
        IF org_id IS NOT NULL THEN
            INSERT INTO document_categories (organization_id, name, description, slug, color, icon, sort_order, keywords, file_extensions, is_system, is_active)
            VALUES 
                (org_id, 'Proposals & Quotes', 'Sales proposals, quotes, and RFPs', 'proposals-quotes', '#3B82F6', 'FileText', 1, 
                 '["proposal", "quote", "rfp", "rfq", "estimate", "bid"]'::jsonb, '[".pdf", ".docx", ".doc"]'::jsonb, true, true),
                (org_id, 'Contracts & Agreements', 'Legal contracts, SOWs, NDAs, and agreements', 'contracts', '#10B981', 'FileSignature', 2,
                 '["contract", "agreement", "sow", "nda", "msa", "legal"]'::jsonb, '[".pdf", ".docx"]'::jsonb, true, true),
                (org_id, 'Financial Documents', 'Invoices, statements, purchase orders', 'financial', '#F59E0B', 'DollarSign', 3,
                 '["invoice", "statement", "purchase", "order", "payment", "receipt"]'::jsonb, '[".pdf", ".xlsx", ".csv"]'::jsonb, true, true),
                (org_id, 'Communications', 'Important emails, meeting notes, correspondence', 'communications', '#8B5CF6', 'MessageSquare', 4,
                 '["email", "memo", "notes", "minutes", "correspondence"]'::jsonb, '[".pdf", ".docx", ".txt", ".msg"]'::jsonb, true, true),
                (org_id, 'Technical Specs', 'Requirements, specifications, diagrams', 'technical', '#EF4444', 'Settings', 5,
                 '["spec", "requirement", "technical", "diagram", "architecture"]'::jsonb, '[".pdf", ".docx", ".vsd", ".png", ".jpg"]'::jsonb, true, true),
                (org_id, 'Presentations', 'Sales decks, demos, training materials', 'presentations', '#06B6D4', 'Presentation', 6,
                 '["presentation", "deck", "slides", "demo", "training"]'::jsonb, '[".pptx", ".ppt", ".pdf", ".key"]'::jsonb, true, true);
            
            RAISE NOTICE 'Successfully created % document categories for organization %', 6, org_id;
        ELSE
            RAISE NOTICE 'No organizations found - skipping category creation';
        END IF;
    ELSE
        RAISE NOTICE 'Document categories already exist (%) - skipping creation', category_count;
    END IF;
END $;