-- Create deal_updates table for tracking deal progress and updates
CREATE TABLE IF NOT EXISTS deal_updates (
    id SERIAL PRIMARY KEY,
    deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    
    -- Update content
    title VARCHAR(255) NOT NULL,
    description TEXT,
    update_type VARCHAR(50) NOT NULL DEFAULT 'status', -- status, progress, risk, decision
    
    -- Status indicators
    deal_health VARCHAR(20), -- green, yellow, red
    probability_change INTEGER, -- Change in probability percentage (-100 to 100)
    value_change FLOAT, -- Change in deal value
    
    -- Metadata
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_by_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_deal_updates_deal_id ON deal_updates(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_updates_org_id ON deal_updates(organization_id);
CREATE INDEX IF NOT EXISTS idx_deal_updates_created_at ON deal_updates(created_at DESC);