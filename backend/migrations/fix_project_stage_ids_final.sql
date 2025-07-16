-- Final fix for Strategic Consulting & Coaching project stage IDs
-- All projects currently have stage_id = 17, but need stage_id = 29 (Planning)

-- First verify the issue
SELECT 
    'Current Project Stage IDs' as check_type,
    p.stage_id,
    COUNT(*) as project_count
FROM projects p
WHERE p.organization_id = 7
AND p.is_active = true
GROUP BY p.stage_id;

-- Check the correct stage IDs for organization 7
SELECT 
    'Available Stages for Org 7' as check_type,
    id as stage_id,
    name as stage_name,
    position
FROM project_stages
WHERE organization_id = 7
AND is_active = true
ORDER BY position;

-- Fix: Update all projects with stage_id = 17 to stage_id = 29 (Planning)
UPDATE projects
SET stage_id = 29
WHERE organization_id = 7
AND stage_id = 17;

-- Verify the fix
SELECT 
    'After Fix' as check_type,
    p.stage_id,
    ps.name as stage_name,
    COUNT(*) as project_count
FROM projects p
JOIN project_stages ps ON p.stage_id = ps.id AND ps.organization_id = p.organization_id
WHERE p.organization_id = 7
AND p.is_active = true
GROUP BY p.stage_id, ps.name;