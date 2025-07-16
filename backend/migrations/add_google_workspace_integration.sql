-- Add Google Workspace Integration Tables

-- Google Organization Configuration Table
CREATE TABLE IF NOT EXISTS google_organization_configs (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Google Cloud Project Details
    client_id VARCHAR(255),
    client_secret_encrypted TEXT,
    project_id VARCHAR(255),
    
    -- Integration Feature Toggles
    gmail_sync_enabled BOOLEAN DEFAULT TRUE,
    calendar_sync_enabled BOOLEAN DEFAULT TRUE,
    contact_sync_enabled BOOLEAN DEFAULT TRUE,
    drive_sync_enabled BOOLEAN DEFAULT FALSE,
    
    -- Configuration Status
    is_configured BOOLEAN DEFAULT FALSE,
    last_test_at TIMESTAMP WITH TIME ZONE,
    last_test_success BOOLEAN DEFAULT FALSE,
    last_error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Google User Connection Table
CREATE TABLE IF NOT EXISTS google_user_connections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    org_config_id INTEGER NOT NULL REFERENCES google_organization_configs(id) ON DELETE CASCADE,
    
    -- Google Account Information
    google_user_id VARCHAR(255) NOT NULL,
    google_email VARCHAR(255) NOT NULL,
    google_display_name VARCHAR(255),
    google_picture_url VARCHAR(500),
    
    -- OAuth Tokens (Encrypted)
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT NOT NULL,
    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scopes_granted JSONB,
    
    -- User Sync Preferences
    sync_gmail_enabled BOOLEAN DEFAULT TRUE,
    sync_calendar_enabled BOOLEAN DEFAULT TRUE,
    sync_contacts_enabled BOOLEAN DEFAULT TRUE,
    sync_drive_enabled BOOLEAN DEFAULT FALSE,
    
    -- Email Privacy Settings
    sync_only_crm_contacts BOOLEAN DEFAULT TRUE,
    excluded_email_domains JSONB DEFAULT '[]'::jsonb,
    excluded_email_keywords JSONB DEFAULT '[]'::jsonb,
    include_sent_emails BOOLEAN DEFAULT TRUE,
    
    -- Sync Status
    last_gmail_sync TIMESTAMP WITH TIME ZONE,
    last_calendar_sync TIMESTAMP WITH TIME ZONE,
    last_contacts_sync TIMESTAMP WITH TIME ZONE,
    last_drive_sync TIMESTAMP WITH TIME ZONE,
    sync_error_count INTEGER DEFAULT 0,
    last_sync_error TEXT,
    
    -- Connection Status
    connection_status VARCHAR(50) DEFAULT 'active',
    connection_established_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_org_configs_org_id ON google_organization_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_google_user_connections_user_id ON google_user_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_google_user_connections_org_id ON google_user_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_google_user_connections_status ON google_user_connections(connection_status);

-- Add triggers for updated_at timestamp
CREATE OR REPLACE FUNCTION update_google_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop triggers if they exist before creating
DROP TRIGGER IF EXISTS google_org_configs_updated_at ON google_organization_configs;
DROP TRIGGER IF EXISTS google_user_connections_updated_at ON google_user_connections;

CREATE TRIGGER google_org_configs_updated_at
    BEFORE UPDATE ON google_organization_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_google_updated_at();

CREATE TRIGGER google_user_connections_updated_at
    BEFORE UPDATE ON google_user_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_google_updated_at();

-- Add comment for documentation
COMMENT ON TABLE google_organization_configs IS 'Stores Google Workspace OAuth configuration for organizations';
COMMENT ON TABLE google_user_connections IS 'Stores individual user Google account connections and sync preferences';