ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS theme_primary_color VARCHAR(7) DEFAULT '#3B82F6',
ADD COLUMN IF NOT EXISTS theme_secondary_color VARCHAR(7) DEFAULT '#1E40AF',
ADD COLUMN IF NOT EXISTS theme_accent_color VARCHAR(7) DEFAULT '#60A5FA';

CREATE INDEX IF NOT EXISTS idx_organizations_theme ON organizations(id, theme_primary_color, theme_secondary_color, theme_accent_color);