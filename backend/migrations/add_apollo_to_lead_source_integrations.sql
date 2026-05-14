-- Migration: Add Apollo.io columns to lead_source_integrations
-- Applied automatically by run_migrations.py on next server startup
-- Safe to run multiple times (uses IF NOT EXISTS / DO $$ patterns)

DO $$
BEGIN
    -- apollo_enabled
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lead_source_integrations'
          AND column_name = 'apollo_enabled'
    ) THEN
        ALTER TABLE lead_source_integrations
            ADD COLUMN apollo_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    -- apollo_api_key (Bearer token NHS generates; Apollo uses this to POST to us)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lead_source_integrations'
          AND column_name = 'apollo_api_key'
    ) THEN
        ALTER TABLE lead_source_integrations
            ADD COLUMN apollo_api_key VARCHAR(255);
    END IF;

    -- apollo_webhook_url (auto-generated URL shown to user)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lead_source_integrations'
          AND column_name = 'apollo_webhook_url'
    ) THEN
        ALTER TABLE lead_source_integrations
            ADD COLUMN apollo_webhook_url VARCHAR(500);
    END IF;

    -- apollo_last_import_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lead_source_integrations'
          AND column_name = 'apollo_last_import_at'
    ) THEN
        ALTER TABLE lead_source_integrations
            ADD COLUMN apollo_last_import_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- apollo_total_imported
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lead_source_integrations'
          AND column_name = 'apollo_total_imported'
    ) THEN
        ALTER TABLE lead_source_integrations
            ADD COLUMN apollo_total_imported INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Index for fast API key lookups on inbound Apollo webhooks
CREATE INDEX IF NOT EXISTS idx_lsi_apollo_api_key
    ON lead_source_integrations (apollo_api_key)
    WHERE apollo_api_key IS NOT NULL;
