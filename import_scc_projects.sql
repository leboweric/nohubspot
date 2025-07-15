-- Import SCC Projects from spreadsheet data
-- This script creates companies, contacts, and projects in the Planning stage

DO $$
DECLARE
    scc_org_id INTEGER;
    planning_stage_id INTEGER;
    default_user_id INTEGER;
    v_company_id INTEGER;
    v_contact_id INTEGER;
    project_data RECORD;
    v_company_name TEXT;
    contact_first TEXT;
    contact_last TEXT;
    existing_count INTEGER;
BEGIN
    -- Get SCC organization ID
    SELECT id INTO scc_org_id
    FROM organizations
    WHERE name = 'Strategic Consulting & Coaching, LLC';
    
    IF scc_org_id IS NULL THEN
        RAISE EXCEPTION 'SCC organization not found';
    END IF;
    
    -- Get Planning stage ID
    SELECT id INTO planning_stage_id
    FROM project_stages
    WHERE organization_id = scc_org_id AND name = 'Planning';
    
    IF planning_stage_id IS NULL THEN
        RAISE EXCEPTION 'Planning stage not found for SCC';
    END IF;
    
    -- Get a default user (use owner or any user from SCC)
    SELECT id INTO default_user_id
    FROM users
    WHERE organization_id = scc_org_id AND role IN ('owner', 'admin')
    LIMIT 1;
    
    -- If no owner/admin, just get any user
    IF default_user_id IS NULL THEN
        SELECT id INTO default_user_id
        FROM users
        WHERE organization_id = scc_org_id
        LIMIT 1;
    END IF;
    
    IF default_user_id IS NULL THEN
        RAISE EXCEPTION 'No users found for SCC';
    END IF;
    
    RAISE NOTICE 'Using org_id: %, stage_id: %, user_id: %', scc_org_id, planning_stage_id, default_user_id;
    
    -- Create temporary table with project data
    CREATE TEMP TABLE temp_scc_projects (
        company_name TEXT,
        project_type TEXT,
        contact_name TEXT,
        job_title TEXT
    );
    
    -- Insert the data from spreadsheet
    INSERT INTO temp_scc_projects (company_name, project_type, contact_name, job_title) VALUES
    ('Repowered', 'Interim Development Director', 'Heather Walch', 'Executive Director'),
    ('River Valley Charities (RVC)', 'Grant Writing', 'Andy Johnson', 'Executive Director'),
    ('Baywood Home Services', 'Strategic Planning', 'Henrietta', 'Executive Director'),
    ('Asian Women United (AWUM)', 'Executive Search', 'Hao Nguyen', 'Board Chair'),
    ('Bakken Museum', NULL, NULL, NULL),
    ('Southern Anoka Community Assistance (SACA)', 'Organizational Assessment', 'Elaine Walker', 'Co-Director'),
    ('Southern Anoka Community Assistance (SACA)', 'Organizational Assessment', 'Dave Rudolph', 'Co-Director'),
    ('Minneapolis Housing Council', 'Interim Executive Director', NULL, NULL),
    ('Disabled American Veterans of MN', 'Strategic Planning', 'Stephen Whitehead', 'Executive Director'),
    ('Financial Planning Association of MN', 'Strategic Planning', 'Nicole Meeker', 'Chairperson'),
    ('Talmud Torah of Minneapolis', 'Organizational Assessment', 'Jaclyn Millner', 'Board Chair'),
    ('The Link', 'Grant Writing', 'Terry Sanner', 'Asst. to Director'),
    ('Little Sisters of the Poor', 'Mission/Vision/Values', 'Sister Mary', 'Development Director'),
    ('Kente Circle', 'Strategic Planning', 'Rev. Janiece Pryor', 'Board Member'),
    ('Twin Cities Rise', 'Individual or Team Coaching', 'Tom Streitz', 'CEO'),
    ('The Wildlife Rehabilitation Center of MN', NULL, 'Phil Jenni', 'Executive Director'),
    ('Summit-U District Planning Council', 'Grant Writing', 'Brendon Slotterback', 'Executive Director'),
    ('First Nations Kitchen', 'Executive Search', 'Doris Tinker', 'Board Member'),
    ('Tree Trust', 'Individual or Team Coaching', 'Jared Smith', 'President'),
    ('VEAP (Volunteers Enlisted to Assist People)', 'Communications Strategy', 'Rebekah Youngblood', 'Manager of Development'),
    ('Union Gospel Mission', 'Strategic Planning', 'Pam Stegora', 'Chief Advancement Officer'),
    ('Youth Farm and Market Project', 'Grant Writing', 'Gunnar Liden', 'Executive Director'),
    ('Twin Cities Diversity in Practice', 'Strategic Planning', NULL, NULL),
    ('Western Wisconsin Economic Development', 'Other', NULL, NULL),  -- WEDC @ The Hub
    ('Hmong American Partnership', 'Capital Campaign', NULL, NULL),
    ('New Lens Urban Mentoring Society', 'Board Development', NULL, NULL),
    ('Gillette Childrens Hospital Foundation', 'Communications Strategy', NULL, NULL),
    ('Community Mediation and Restorative Services', 'Conflict Resolution/Mediation', NULL, NULL),
    ('The Food Group', 'Feasibility Study', NULL, NULL),
    ('Open Arms of Minnesota', 'Gift Acceptance Policies', NULL, NULL),
    ('Boys and Girls Clubs of the Twin Cities', 'Human Resources', NULL, NULL),
    ('YWCA Minneapolis', 'Leadership Development/Training', NULL, NULL),
    ('Catholic Charities of St. Paul and Minneapolis', 'Major Gifts', NULL, NULL),
    ('Lutheran Social Service of Minnesota', 'Pastoral Counseling', NULL, NULL),
    ('Greater Twin Cities United Way', 'Planned Giving', NULL, NULL),
    ('Twin Cities Habitat for Humanity', 'Search - Other', NULL, NULL),
    ('Second Harvest Heartland', 'Social Media', NULL, NULL),
    ('Childrens Minnesota', 'Staff Search', NULL, NULL),
    ('Abbott Northwestern Hospital Foundation', 'Stewardship Campaign', NULL, NULL),
    ('Courage Kenny Foundation', 'Vision Framing', NULL, NULL),
    ('Episcopal Homes of Minnesota', 'Church Administration', NULL, NULL),
    ('Westminster Presbyterian Church', 'Church Search', NULL, NULL),
    ('Mt. Olivet Lutheran Church', 'Annual Giving', NULL, NULL),
    ('Plymouth Congregational Church', 'Fundraising Training', NULL, NULL),
    ('Unity Church-Unitarian', 'Fundraising/Resource Development', NULL, NULL),
    ('Temple Israel', 'Marketing Strategy/Support', NULL, NULL),
    ('St. Marks Episcopal Cathedral', 'Merger/Partnership', NULL, NULL),
    ('Hennepin Avenue United Methodist Church', 'Consultation Set-Up', NULL, NULL),
    ('Park Avenue United Methodist Church', 'Program Evaluation', NULL, NULL);
    
    -- Process each project
    FOR project_data IN 
        SELECT DISTINCT company_name, project_type, contact_name, job_title
        FROM temp_scc_projects
        WHERE company_name IS NOT NULL
        ORDER BY company_name
    LOOP
        v_company_name := project_data.company_name;
        
        -- Check/create company
        SELECT id INTO v_company_id
        FROM companies
        WHERE organization_id = scc_org_id AND name = v_company_name;
        
        IF v_company_id IS NULL THEN
            INSERT INTO companies (organization_id, name)
            VALUES (scc_org_id, v_company_name)
            RETURNING id INTO v_company_id;
            
            RAISE NOTICE 'Created company: %', v_company_name;
        END IF;
        
        -- Handle contact if provided
        v_contact_id := NULL;
        IF project_data.contact_name IS NOT NULL THEN
            -- Parse contact name (assuming "First Last" format)
            contact_first := split_part(project_data.contact_name, ' ', 1);
            contact_last := NULLIF(substring(project_data.contact_name from position(' ' in project_data.contact_name) + 1), '');
            
            -- Check if contact exists
            SELECT id INTO v_contact_id
            FROM contacts
            WHERE organization_id = scc_org_id 
            AND company_id = v_company_id
            AND first_name = contact_first
            AND (last_name = contact_last OR (last_name IS NULL AND contact_last IS NULL));
            
            IF v_contact_id IS NULL THEN
                INSERT INTO contacts (
                    organization_id, company_id, first_name, last_name, 
                    title, email
                )
                VALUES (
                    scc_org_id, v_company_id, contact_first, COALESCE(contact_last, ''),
                    project_data.job_title,
                    lower(contact_first) || '.' || COALESCE(lower(contact_last), 'contact') || '@' || 
                    lower(replace(replace(replace(v_company_name, ' ', ''), '.', ''), ',', '')) || '.com'
                )
                RETURNING id INTO v_contact_id;
                
                RAISE NOTICE 'Created contact: % % for %', contact_first, contact_last, v_company_name;
            END IF;
        END IF;
        
        -- Create project if project type is provided
        IF project_data.project_type IS NOT NULL THEN
            -- Check if project already exists
            SELECT COUNT(*) INTO existing_count
            FROM projects
            WHERE organization_id = scc_org_id
            AND title = project_data.project_type || ' - ' || v_company_name;
            
            IF existing_count = 0 THEN
                INSERT INTO projects (
                    organization_id, created_by, title, project_type,
                    company_id, contact_id, stage_id, is_active
                )
                VALUES (
                    scc_org_id, default_user_id,
                    project_data.project_type || ' - ' || v_company_name,
                    project_data.project_type,
                    v_company_id, v_contact_id, planning_stage_id, true
                );
                
                RAISE NOTICE 'Created project: % - %', project_data.project_type, v_company_name;
            ELSE
                RAISE NOTICE 'Project already exists: % - %', project_data.project_type, v_company_name;
            END IF;
        END IF;
    END LOOP;
    
    -- Drop temporary table
    DROP TABLE temp_scc_projects;
    
    -- Show summary
    RAISE NOTICE '';
    RAISE NOTICE '=== Import Summary ===';
    
    SELECT COUNT(*) INTO existing_count
    FROM projects
    WHERE organization_id = scc_org_id
    AND stage_id = planning_stage_id
    AND created_at >= CURRENT_DATE;
    
    RAISE NOTICE 'Projects created today: %', existing_count;
    
END $$;

-- View the results
SELECT 
    p.title as "Project Title",
    p.project_type as "Type",
    c.name as "Company",
    COALESCE(con.first_name || ' ' || con.last_name, 'No Contact') as "Primary Contact",
    ps.name as "Stage"
FROM projects p
JOIN companies c ON p.company_id = c.id
JOIN project_stages ps ON p.stage_id = ps.id
LEFT JOIN contacts con ON p.contact_id = con.id
WHERE p.organization_id = (
    SELECT id FROM organizations WHERE name = 'Strategic Consulting & Coaching, LLC'
)
AND ps.name = 'Planning'
ORDER BY p.created_at DESC
LIMIT 20;