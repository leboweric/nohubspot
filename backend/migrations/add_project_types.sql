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
CREATE INDEX IF NOT EXISTS idx_project_types_org ON project_types(organization_id);
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Annual Giving', 0, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Annual Giving');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Board Development', 1, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Board Development');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Capital Campaign', 2, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Capital Campaign');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Church Administration', 3, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Church Administration');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Church Search', 4, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Church Search');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Communication Strategies', 5, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Communication Strategies');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Conflict Resolution/Mediation', 6, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Conflict Resolution/Mediation');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Feasibility Study', 7, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Feasibility Study');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Gift Acceptance Policies', 8, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Gift Acceptance Policies');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Human Resources', 9, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Human Resources');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Leadership Development/Training', 10, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Leadership Development/Training');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Major Gifts', 11, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Major Gifts');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Other', 12, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Other');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Pastoral Counseling', 13, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Pastoral Counseling');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Planned Giving', 14, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Planned Giving');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Search - Other', 15, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Search - Other');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Social Media', 16, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Social Media');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Staff Search', 17, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Staff Search');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Stewardship Campaign', 18, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Stewardship Campaign');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Strategic Planning', 19, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Strategic Planning');
INSERT INTO project_types (organization_id, name, display_order, is_active)
SELECT o.id, 'Vision Framing', 20, true
FROM organizations o
WHERE o.name = 'Strategic Consulting & Coaching, LLC'
AND NOT EXISTS (SELECT 1 FROM project_types WHERE organization_id = o.id AND name = 'Vision Framing');