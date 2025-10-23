ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS primary_referral_source TEXT;

CREATE INDEX IF NOT EXISTS idx_companies_primary_referral_source 
ON companies(primary_referral_source);

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'companies' 
AND column_name = 'primary_referral_source';