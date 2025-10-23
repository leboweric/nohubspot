-- Create project_updates table for tracking project progress and milestones
CREATE TABLE IF NOT EXISTS project_updates (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    
    -- Update content
    title VARCHAR(255) NOT NULL,
    description TEXT,
    update_type VARCHAR(50) NOT NULL DEFAULT 'status', -- status, milestone, risk, decision
    
    -- Milestone-specific fields
    is_milestone BOOLEAN DEFAULT FALSE,
    milestone_date TIMESTAMP WITH TIME ZONE,
    milestone_completed BOOLEAN DEFAULT FALSE,
    milestone_completed_date TIMESTAMP WITH TIME ZONE,
    
    -- Status indicators
    project_health VARCHAR(20), -- green, yellow, red
    progress_percentage INTEGER CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    
    -- Metadata
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_by_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_project_updates_project_id ON project_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_project_updates_organization_id ON project_updates(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_updates_is_milestone ON project_updates(is_milestone);
CREATE INDEX IF NOT EXISTS idx_project_updates_created_at ON project_updates(created_at DESC);

-- Migration completed successfully