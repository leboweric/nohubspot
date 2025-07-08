-- Add email privacy controls migration
-- This migration adds privacy fields to support email privacy features

-- Add privacy fields to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS shared_with_team BOOLEAN DEFAULT FALSE;

-- Add privacy fields to email_threads table
ALTER TABLE email_threads 
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS shared_with JSONB;

-- Add email sync settings to o365_user_connections table
ALTER TABLE o365_user_connections 
ADD COLUMN IF NOT EXISTS sync_only_crm_contacts BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS excluded_domains JSONB,
ADD COLUMN IF NOT EXISTS excluded_keywords JSONB,
ADD COLUMN IF NOT EXISTS auto_create_contacts BOOLEAN DEFAULT FALSE;

-- Create email sharing permissions table
CREATE TABLE IF NOT EXISTS email_sharing_permissions (
    id SERIAL PRIMARY KEY,
    email_thread_id INTEGER NOT NULL REFERENCES email_threads(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    permission_level VARCHAR(50) NOT NULL,
    granted_by INTEGER NOT NULL REFERENCES users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email_thread_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_owner_shared ON contacts(owner_id, shared_with_team);
CREATE INDEX IF NOT EXISTS idx_email_threads_owner_private ON email_threads(owner_id, is_private);
CREATE INDEX IF NOT EXISTS idx_email_sharing_permissions_thread ON email_sharing_permissions(email_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_sharing_permissions_user ON email_sharing_permissions(user_id);

-- Update existing contacts to set owner_id based on organization
-- This assigns ownership to the first admin/owner in each organization
UPDATE contacts 
SET owner_id = (
    SELECT id FROM users 
    WHERE users.organization_id = contacts.organization_id 
    AND users.role IN ('owner', 'admin')
    ORDER BY users.created_at ASC
    LIMIT 1
)
WHERE owner_id IS NULL;

-- Update existing email threads to set owner_id
-- This assigns ownership based on the contact owner
UPDATE email_threads 
SET owner_id = (
    SELECT owner_id FROM contacts 
    WHERE contacts.id = email_threads.contact_id
)
WHERE owner_id IS NULL;