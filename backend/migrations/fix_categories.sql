-- Step 1: Find your organization ID
SELECT id, name FROM organizations;

-- Step 2: Check if you have any categories (replace YOUR_ORG_ID with the ID from step 1)
SELECT COUNT(*) FROM document_categories WHERE organization_id = YOUR_ORG_ID;

-- Step 3: If count is 0, insert categories (replace YOUR_ORG_ID with your actual organization ID)
-- For example, if your organization ID is 1, use this:
INSERT INTO document_categories (organization_id, name, description, slug, color, icon, sort_order, keywords, file_extensions, is_system, is_active)
VALUES 
    (YOUR_ORG_ID, 'Proposals & Quotes', 'Sales proposals, quotes, and RFPs', 'proposals-quotes', '#3B82F6', 'FileText', 1, 
     '["proposal", "quote", "rfp", "rfq", "estimate", "bid"]', '[".pdf", ".docx", ".doc"]', true, true),
    (YOUR_ORG_ID, 'Contracts & Agreements', 'Legal contracts, SOWs, NDAs, and agreements', 'contracts', '#10B981', 'FileSignature', 2,
     '["contract", "agreement", "sow", "nda", "msa", "legal"]', '[".pdf", ".docx"]', true, true),
    (YOUR_ORG_ID, 'Financial Documents', 'Invoices, statements, purchase orders', 'financial', '#F59E0B', 'DollarSign', 3,
     '["invoice", "statement", "purchase", "order", "payment", "receipt"]', '[".pdf", ".xlsx", ".csv"]', true, true),
    (YOUR_ORG_ID, 'Communications', 'Important emails, meeting notes, correspondence', 'communications', '#8B5CF6', 'MessageSquare', 4,
     '["email", "memo", "notes", "minutes", "correspondence"]', '[".pdf", ".docx", ".txt", ".msg"]', true, true),
    (YOUR_ORG_ID, 'Technical Specs', 'Requirements, specifications, diagrams', 'technical', '#EF4444', 'Settings', 5,
     '["spec", "requirement", "technical", "diagram", "architecture"]', '[".pdf", ".docx", ".vsd", ".png", ".jpg"]', true, true),
    (YOUR_ORG_ID, 'Presentations', 'Sales decks, demos, training materials', 'presentations', '#06B6D4', 'Presentation', 6,
     '["presentation", "deck", "slides", "demo", "training"]', '[".pptx", ".ppt", ".pdf", ".key"]', true, true);

-- Step 4: Verify the categories were created
SELECT * FROM document_categories WHERE organization_id = YOUR_ORG_ID;