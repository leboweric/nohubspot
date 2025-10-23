ALTER TABLE google_user_connections 
ALTER COLUMN org_config_id DROP NOT NULL;

COMMENT ON COLUMN google_user_connections.org_config_id IS 'DEPRECATED: No longer used after simplifying to centralized OAuth. Kept for backward compatibility.';

COMMENT ON TABLE google_organization_configs IS 'DEPRECATED: Table no longer used after switching to centralized OAuth. Kept for backward compatibility.';