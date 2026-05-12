-- Migration: Add Lead Source Integration tables
-- Supports Clay, Surfe, and LinkedIn Sales Navigator inbound webhooks
-- Applied automatically by run_migrations.py on next server startup

-- ─────────────────────────────────────────────────────────────
-- Table: lead_source_integrations
-- One row per organization; stores API keys and stats for each source
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_source_integrations (
    id                          SERIAL PRIMARY KEY,
    organization_id             INTEGER NOT NULL UNIQUE REFERENCES organizations(id),

    -- Clay
    clay_enabled                BOOLEAN NOT NULL DEFAULT FALSE,
    clay_api_key                VARCHAR(255),
    clay_webhook_url            VARCHAR(500),
    clay_last_import_at         TIMESTAMP WITH TIME ZONE,
    clay_total_imported         INTEGER NOT NULL DEFAULT 0,

    -- Surfe
    surfe_enabled               BOOLEAN NOT NULL DEFAULT FALSE,
    surfe_api_key_encrypted     TEXT,
    surfe_webhook_secret        VARCHAR(255),
    surfe_last_enrichment_at    TIMESTAMP WITH TIME ZONE,
    surfe_total_enriched        INTEGER NOT NULL DEFAULT 0,

    -- LinkedIn Sales Navigator
    linkedin_enabled            BOOLEAN NOT NULL DEFAULT FALSE,
    linkedin_webhook_api_key    VARCHAR(255),
    linkedin_last_import_at     TIMESTAMP WITH TIME ZONE,
    linkedin_total_imported     INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast API key lookups on inbound webhooks
CREATE INDEX IF NOT EXISTS idx_lsi_clay_api_key
    ON lead_source_integrations (clay_api_key)
    WHERE clay_api_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lsi_linkedin_api_key
    ON lead_source_integrations (linkedin_webhook_api_key)
    WHERE linkedin_webhook_api_key IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- Table: lead_import_logs
-- Audit trail for every inbound lead event
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_import_logs (
    id                  SERIAL PRIMARY KEY,
    organization_id     INTEGER NOT NULL REFERENCES organizations(id),

    source              VARCHAR(50)  NOT NULL,   -- clay | surfe | linkedin
    event_type          VARCHAR(100),
    raw_payload         JSONB,

    -- What was created / updated
    contact_id          INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    company_id          INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    action              VARCHAR(50),             -- created | updated | skipped | error
    error_message       TEXT,

    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lil_org_id
    ON lead_import_logs (organization_id);

CREATE INDEX IF NOT EXISTS idx_lil_source
    ON lead_import_logs (source);

CREATE INDEX IF NOT EXISTS idx_lil_created_at
    ON lead_import_logs (created_at DESC);
