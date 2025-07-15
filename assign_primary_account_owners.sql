-- Assign Primary Account Owners to companies based on Primary SCC Contact data
-- First get the user IDs for the SCC team members

-- Cheryl Jensen assignments (32 companies)
UPDATE companies SET primary_account_owner_id = (SELECT id FROM users WHERE email = 'cjensen@strategic-cc.com' AND organization_id = 7 LIMIT 1) 
WHERE organization_id = 7 AND name IN (
    'Advocating Change Together (ACT)',
    'American Association of Woodturners',
    'American Indian Family Center',
    'Ampersand Families',
    'Arcola Mills',
    'Ausherman Family Foundation',
    'Communnity Emergency Assistance Program (CEAP)',
    'Center for Coaching in Organizations',
    'Children''s Hospital Association',
    'Conservation Corps Minnesota and Iowa',
    'Corner House',
    'Customized Options',
    'Epilepsy Foundation of Minnesota',
    'EVOLVE Family Services',
    'H2O For Life',
    'Handy Help LLC',
    'HOPE 4 Youth',
    'HOPE Coalition',
    'ICA Food Shelf',
    'Irish Fair of Minnesota',
    'Joint Religious Legislative Coalition',
    'Listen Up Youth Radio',
    'Lutheran Island Camp',
    'Merrick Community Services',
    'Midwest Reliability Organization',
    'Minnesota Housing Partnership (MHP)',
    'PRISM',
    'Ramsey County Workforce Solutions',
    'Seward Community Co-Op',
    'Sibley County FoodShare',
    'Somerset Community Food Pantry',
    'Veteran Resilience Project'
);

-- Renae Oswald-Anderson assignments (38 companies)
UPDATE companies SET primary_account_owner_id = (SELECT id FROM users WHERE email = 'roanderson@strategic-cc.com' AND organization_id = 7 LIMIT 1) 
WHERE organization_id = 7 AND name IN (
    'American Indian OIC',
    'Avenues for Youth',
    'Big Lake Community Food Shelf',
    'Breakthrough Twin Cities',
    'Bridge for Youth',
    'Bridges of Hope',
    'CADA',
    'CAER Food Shelf',
    'Camp Omega',
    'CAPI',
    'Carver County Historical Society',
    'Century College Foundation',
    'College Possible',
    'Dakota Woodlands',
    'DARTS',
    'DepartSmart',
    'Emerge',
    'Face 2 Face',
    'Feline Rescue, Inc.',
    'Foundations for Essential Needs',
    'Friends in Need Food Shelf',
    'Great Expectations School',
    'Green Card Voices',
    'Hawkinson Fund for Peace and Justice',
    'Hawthorne Neighborhood Council',
    'Hope House',
    'Interfaith Outreach & Community Partners',
    'Jewish Family and Children''s Services',
    'Jewish Programming and Housing (J-HAP)',
    'Joyce Uptown Food Shelf',
    'Lakeshore Payers',
    'Love Inc.',
    'Metropolitan Alliance of Connected Communities (MACC)',
    'Manna Market',
    'McLeod Emergency Food Shelf',
    'MELSA',
    'Milestone',
    'Minneapolis Farmers Market',
    'MN Black Chamber of Commerce',
    'MN China Friendship Garden Society',
    'MN Community Education Association',
    'MN Community Health Workers Alliance',
    'MN HomeCare Association',
    'MN Metro North Tourism',
    'MN School Bus Operators Association',
    'MN State Community and Technical College Foundation',
    'MN State Fire Chiefs Association',
    'MN Youth Ski League',
    'MNRAAA',
    'Minnesota Organization for Habilitation and Rehabilitation(MOHR)',
    'MoveFwd Minnesota',
    'MN Subcontractors Association',
    'NAEHCY',
    'National Association of Social Workers',
    'Neighbors, Inc.',
    'North St. Paul Area Food Shelf',
    'Northeast Contemporary Services, Inc.',
    'Oasis for Youth',
    'Onward Eden Prairie',
    'Open Cupboard',
    'Open Doors for Youth',
    'Our Neighbor''s Place',
    'Phoenix Alternative, Inc.(PAI)',
    'Partnership Resources, Inc.',
    'Pathway Health Services',
    'Phoenix Residence',
    'Portable Sanitation Association International',
    'Preservation Alliance',
    'Project Pathfinder',
    'Public Arts St. Paul',
    'Ampact',
    'Relate Counseling Center',
    'RESOURCE',
    'Resource West',
    'Ridgeview Senior Apartments',
    'Rural Renewable Energy Alliance (RREAL)',
    'SOAR Regional Arts',
    'Som Gum Cooperative',
    'Southeast Minnesota Area Agency on Aging',
    'Southside Services I. INC.',
    'St. Paul Community Literacy Consortium',
    'St. Paul Conservatory of Music',
    'Agate Housing and Services',
    'Start Early Funders Coalition',
    'START Senior Solutions',
    'Steve Rummler Hope Network',
    'Stillwater Public Library Foundation',
    'Tanager Place',
    'Trellis',
    'Tasks Unlimited',
    'The Annex Teen Clinic',
    'The Isthmus Foundation',
    'The Lift Garage',
    'The Link',
    'The Partnership Plan',
    'The Periphery Foundation',
    'Think Small',
    'Move Minnesota',
    'US Math Recovery Council',
    'White Bear Lake Area Historical Society',
    'YouthLink',
    'White Bear Area Food Shelf'
);

-- Imogen Davis assignments (10 companies)
UPDATE companies SET primary_account_owner_id = (SELECT id FROM users WHERE email = 'idavis@strategic-cc.com' AND organization_id = 7 LIMIT 1) 
WHERE organization_id = 7 AND name IN (
    'Annex Teen Clinic',
    'Belle Plaine Food Shelf',
    'Bellis',
    'Beyond New Beginnings',
    'Child Care Aware',
    'CommonBond Communities',
    'Accord',
    'Community Thread',
    'Family Child Development Center',
    'Feed Iowa First'
);

-- Christopher Taykalo assignments (1 company)
UPDATE companies SET primary_account_owner_id = (SELECT id FROM users WHERE email = 'ctaykalo@strategic-cc.com' AND organization_id = 7 LIMIT 1) 
WHERE organization_id = 7 AND name IN (
    'The Beacon'
);

-- Susan Marschalk assignments (7 companies)
UPDATE companies SET primary_account_owner_id = (SELECT id FROM users WHERE email = 'smarschalk@strategic-cc.com' AND organization_id = 7 LIMIT 1) 
WHERE organization_id = 7 AND name IN (
    'Aqwalife',
    'Dispute Resolution Center',
    'DuNord Foundation',
    'Financial One Credit Union',
    'Friends of St. Paul College Foundation',
    'Friends of Willow River and Kinnickinnic State Parks',
    'Hmong Cultural Center'
);

-- Verify the assignments
SELECT 
    comp.name as company_name,
    u.first_name || ' ' || u.last_name as primary_account_owner,
    u.email as owner_email
FROM companies comp
LEFT JOIN users u ON comp.primary_account_owner_id = u.id
WHERE comp.organization_id = 7
AND comp.primary_account_owner_id IS NOT NULL
ORDER BY u.last_name, u.first_name, comp.name;

-- Summary count by owner
SELECT 
    u.first_name || ' ' || u.last_name as owner_name,
    u.email,
    COUNT(comp.id) as company_count
FROM users u
LEFT JOIN companies comp ON comp.primary_account_owner_id = u.id AND comp.organization_id = 7
WHERE u.organization_id = 7
AND u.email LIKE '%@strategic-cc.com'
GROUP BY u.id, u.first_name, u.last_name, u.email
ORDER BY COUNT(comp.id) DESC;