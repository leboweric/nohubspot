-- Migration to simplify Google OAuth by removing organization-level configuration
-- This makes Google integration work like Zapier - users just click connect without setup

-- Make org_config_id nullable since we're not using org-level configs anymore
ALTER TABLE google_user_connections 
ALTER COLUMN org_config_id DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN google_user_connections.org_config_id IS 'DEPRECATED: No longer used after simplifying to centralized OAuth. Kept for backward compatibility.';

-- Note: We're not dropping the google_organization_configs table yet
-- to allow for potential rollback. It can be dropped in a future migration.
COMMENT ON TABLE google_organization_configs IS 'DEPRECATED: Table no longer used after switching to centralized OAuth. Kept for backward compatibility.';