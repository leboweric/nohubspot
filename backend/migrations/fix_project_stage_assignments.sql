-- Fix Project Stage Assignments
-- This script reassigns all projects with invalid stage_ids to the first available stage

-- First, let's see what the issue is
SELECT 'Projects by Stage' as check_type;
SELECT 
    p.organization_id,
    p.stage_id,
    ps.name as stage_name,
    COUNT(*) as project_count
FROM projects p
LEFT JOIN project_stages ps ON p.stage_id = ps.id AND ps.organization_id = p.organization_id
WHERE p.is_active = true
GROUP BY p.organization_id, p.stage_id, ps.name
ORDER BY p.organization_id, p.stage_id;

-- Check which projects have invalid stage_ids
SELECT 'Projects with Invalid Stages' as check_type;
SELECT 
    p.id,
    p.title,
    p.organization_id,
    p.stage_id as invalid_stage_id,
    o.name as org_name
FROM projects p
JOIN organizations o ON p.organization_id = o.id
WHERE p.is_active = true
AND p.stage_id NOT IN (
    SELECT id FROM project_stages 
    WHERE organization_id = p.organization_id
)
ORDER BY p.organization_id, p.id;

-- Check available stages per organization
SELECT 'Available Stages by Organization' as check_type;
SELECT 
    ps.organization_id,
    o.name as org_name,
    ps.id as stage_id,
    ps.name as stage_name,
    ps.position
FROM project_stages ps
JOIN organizations o ON ps.organization_id = o.id
WHERE ps.is_active = true
ORDER BY ps.organization_id, ps.position;

-- Fix the projects by assigning them to the first stage for their organization
UPDATE projects p
SET stage_id = (
    SELECT id 
    FROM project_stages 
    WHERE organization_id = p.organization_id 
    AND is_active = true
    ORDER BY position 
    LIMIT 1
)
WHERE p.is_active = true
AND (
    p.stage_id IS NULL
    OR p.stage_id NOT IN (
        SELECT id FROM project_stages 
        WHERE organization_id = p.organization_id
    )
);

-- Verify the fix
SELECT 'After Fix - Projects by Stage' as check_type;
SELECT 
    p.organization_id,
    o.name as org_name,
    ps.name as stage_name,
    COUNT(*) as project_count
FROM projects p
JOIN organizations o ON p.organization_id = o.id
LEFT JOIN project_stages ps ON p.stage_id = ps.id
WHERE p.is_active = true
GROUP BY p.organization_id, o.name, ps.name
ORDER BY p.organization_id, ps.name;