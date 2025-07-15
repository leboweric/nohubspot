-- Add primary_account_owner_id to companies table
-- This field tracks which user (Sales Rep) is the primary owner of each company account

-- Add the column if it doesn't exist
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS primary_account_owner_id INTEGER;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_companies_primary_account_owner 
ON companies(primary_account_owner_id);

-- Add comment to document the column
COMMENT ON COLUMN companies.primary_account_owner_id IS 'The user (Sales Rep) who is the primary owner of this company account';