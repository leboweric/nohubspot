ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS primary_account_owner_id INTEGER REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_contacts_primary_account_owner_id 
ON contacts(primary_account_owner_id);