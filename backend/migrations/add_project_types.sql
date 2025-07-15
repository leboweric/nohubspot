-- Migration script to add project_types table and populate SCC project types

-- Create the project_types table
CREATE TABLE IF NOT EXISTS project_types (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT _org_project_type_uc UNIQUE (organization_id, name)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_project_types_org ON project_types(organization_id);

-- Populate SCC project types
DO $$
DECLARE
    scc_org_id INTEGER;
    project_types TEXT[] := ARRAY[
        'Annual Giving',
        'Board Development',
        'Capital Campaign',
        'Church Administration',
        'Church Search',
        'Communication Strategies',
        'Conflict Resolution/Mediation',
        'Feasibility Study',
        'Gift Acceptance Policies',
        'Human Resources',
        'Leadership Development/Training',
        'Major Gifts',
        'Other',
        'Pastoral Counseling',
        'Planned Giving',
        'Search - Other',
        'Social Media',
        'Staff Search',
        'Stewardship Campaign',
        'Strategic Planning',
        'Vision Framing'
    ];
    i INTEGER;
BEGIN
    -- Get SCC organization ID
    SELECT id INTO scc_org_id
    FROM organizations
    WHERE name = 'Strategic Consulting & Coaching, LLC';
    
    -- Only proceed if SCC exists
    IF scc_org_id IS NOT NULL THEN
        -- Check if project types already exist for SCC
        IF NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = scc_org_id) THEN
            -- Insert project types
            FOR i IN 1..array_length(project_types, 1) LOOP
                INSERT INTO project_types (organization_id, name, display_order, is_active)
                VALUES (scc_org_id, project_types[i], i - 1, true);
            END LOOP;
            
            RAISE NOTICE 'Added % project types for Strategic Consulting & Coaching, LLC', array_length(project_types, 1);
        ELSE
            RAISE NOTICE 'Project types already exist for Strategic Consulting & Coaching, LLC';
        END IF;
    ELSE
        RAISE NOTICE 'Strategic Consulting & Coaching, LLC organization not found';
    END IF;
END $$;


-- View the results
SELECT o.name as organization, COUNT(pt.id) as project_type_count
FROM organizations o
LEFT JOIN project_types pt ON o.id = pt.organization_id
GROUP BY o.id, o.name
ORDER BY o.name;