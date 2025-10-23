ALTER TABLE attachments 
ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_attachments_project_id ON attachments(project_id);
CREATE INDEX IF NOT EXISTS idx_attachments_organization_id ON attachments(organization_id);

UPDATE attachments a
SET organization_id = c.organization_id
FROM companies c
WHERE a.company_id = c.id
AND a.organization_id IS NULL;