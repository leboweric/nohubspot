-- Add account team members to companies and contacts
-- This allows multiple team members to be associated with each company/contact

-- Add account_team_members to companies table
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS account_team_members JSON;

-- Add account_team_members to contacts table  
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS account_team_members JSON;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_companies_account_team_members 
ON companies USING GIN ((account_team_members::jsonb));

CREATE INDEX IF NOT EXISTS idx_contacts_account_team_members
ON contacts USING GIN ((account_team_members::jsonb));

-- Update existing records to have empty array as default
UPDATE companies 
SET account_team_members = '[]'::json 
WHERE account_team_members IS NULL;

UPDATE contacts
SET account_team_members = '[]'::json
WHERE account_team_members IS NULL;