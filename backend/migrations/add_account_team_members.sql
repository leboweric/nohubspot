ALTER TABLE companies
ADD COLUMN IF NOT EXISTS account_team_members JSON;

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS account_team_members JSON;

CREATE INDEX IF NOT EXISTS idx_companies_account_team_members 
ON companies USING GIN ((account_team_members::jsonb));

CREATE INDEX IF NOT EXISTS idx_contacts_account_team_members
ON contacts USING GIN ((account_team_members::jsonb));

UPDATE companies 
SET account_team_members = '[]'::json 
WHERE account_team_members IS NULL;

UPDATE contacts
SET account_team_members = '[]'::json
WHERE account_team_members IS NULL;