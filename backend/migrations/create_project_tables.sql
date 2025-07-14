-- Create Project Management tables
-- This migration adds project stages and projects tables for project management functionality

-- Create project_stages table
CREATE TABLE IF NOT EXISTS project_stages (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    position INTEGER NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    color VARCHAR(7) DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE,
    projected_end_date TIMESTAMP WITH TIME ZONE,
    actual_end_date TIMESTAMP WITH TIME ZONE,
    hourly_rate DECIMAL(10,2),
    project_type VARCHAR(100),
    projected_hours DECIMAL(10,2),
    actual_hours DECIMAL(10,2) DEFAULT 0.0,
    stage_id INTEGER NOT NULL REFERENCES project_stages(id),
    contact_id INTEGER REFERENCES contacts(id),
    company_id INTEGER REFERENCES companies(id),
    assigned_team_members JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    tags JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_stages_organization_id ON project_stages(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_stages_position ON project_stages(organization_id, position);

CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_stage_id ON projects(stage_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_contact_id ON projects(contact_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON projects(start_date);
CREATE INDEX IF NOT EXISTS idx_projects_projected_end_date ON projects(projected_end_date);

-- Insert default project stages for each organization
INSERT INTO project_stages (organization_id, name, description, position, is_closed, color)
SELECT 
    id as organization_id,
    stage_name,
    stage_description,
    stage_position,
    stage_is_closed,
    stage_color
FROM organizations o
CROSS JOIN (
    VALUES 
        ('Planning', 'Project approved, not yet started', 0, FALSE, '#3B82F6'),
        ('Active', 'Currently in progress', 1, FALSE, '#10B981'),
        ('Wrapping Up', 'Nearing completion', 2, FALSE, '#F59E0B'),
        ('Closed', 'Completed projects', 3, TRUE, '#6B7280')
) AS stages(stage_name, stage_description, stage_position, stage_is_closed, stage_color)
WHERE NOT EXISTS (
    SELECT 1 FROM project_stages ps 
    WHERE ps.organization_id = o.id 
    AND ps.name = stages.stage_name
);

-- Verify tables were created
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('project_stages', 'projects')
ORDER BY table_name, ordinal_position;