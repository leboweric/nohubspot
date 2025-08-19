-- Add primary_account_owner_id to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS primary_account_owner_id INTEGER REFERENCES users(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_contacts_primary_account_owner_id 
ON contacts(primary_account_owner_id);