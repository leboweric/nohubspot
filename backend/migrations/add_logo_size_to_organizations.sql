ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS logo_size INTEGER DEFAULT 100 CHECK (logo_size >= 50 AND logo_size <= 150);