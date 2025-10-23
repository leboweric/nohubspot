ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS primary_account_owner_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_companies_primary_account_owner 
ON companies(primary_account_owner_id);

COMMENT ON COLUMN companies.primary_account_owner_id IS 'The user (Sales Rep) who is the primary owner of this company account';