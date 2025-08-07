-- Add document management tables

-- Create document_categories table
CREATE TABLE IF NOT EXISTS document_categories (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    slug VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL,
    icon VARCHAR(50) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    keywords JSON,
    file_extensions JSON,
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create document_folders table
CREATE TABLE IF NOT EXISTS document_folders (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_folder_id INTEGER REFERENCES document_folders(id) ON DELETE CASCADE,
    folder_type VARCHAR(50) NOT NULL DEFAULT 'custom',
    category VARCHAR(50),
    color VARCHAR(7),
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    auto_rules JSON,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add folder support to attachments table
ALTER TABLE attachments 
ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES document_folders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS tags JSON,
ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP WITH TIME ZONE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_document_folders_company ON document_folders(company_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_parent ON document_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_org ON document_folders(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_categories_org ON document_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_attachments_folder ON attachments(folder_id);

-- Insert default document categories for all organizations
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