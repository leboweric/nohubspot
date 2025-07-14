-- Add Primary Referral Source field to companies table
-- This is a free-form text field to capture who made the referral

ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS primary_referral_source TEXT;

-- Add an index for better search performance on this field
CREATE INDEX IF NOT EXISTS idx_companies_primary_referral_source 
ON companies(primary_referral_source);

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'companies' 
AND column_name = 'primary_referral_source';