"""
Fix project types tenant isolation and clean up cross-pollinated data.

This migration:
1. Removes any project types that don't belong to the correct organization
2. Ensures each organization has their own set of project types
3. Initializes default project types for organizations that don't have any
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
from datetime import datetime

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://nohubspot_user:secure_password@localhost/nohubspot_db")

def run_migration():
    engine = create_engine(DATABASE_URL)
    
    with engine.begin() as conn:
        # First, let's check for any cross-pollination issues
        # Get all organizations and their project types
        result = conn.execute(text("""
            SELECT 
                o.id as org_id,
                o.name as org_name,
                pt.id as type_id,
                pt.name as type_name,
                pt.organization_id as pt_org_id
            FROM organizations o
            LEFT JOIN project_types pt ON pt.organization_id = o.id
            ORDER BY o.id, pt.display_order, pt.name
        """))
        
        org_types = {}
        for row in result:
            if row.org_id not in org_types:
                org_types[row.org_id] = {
                    'name': row.org_name,
                    'types': []
                }
            if row.type_id:
                org_types[row.org_id]['types'].append({
                    'id': row.type_id,
                    'name': row.type_name,
                    'org_id': row.pt_org_id
                })
        
        print("Current organization project types:")
        for org_id, org_data in org_types.items():
            print(f"\nOrganization {org_id} ({org_data['name']}):")
            if org_data['types']:
                for pt in org_data['types']:
                    print(f"  - {pt['name']} (type_id: {pt['id']})")
            else:
                print("  No project types")
        
        # Clean up any cross-pollinated data (shouldn't exist with proper constraints)
        conn.execute(text("""
            DELETE FROM project_types
            WHERE id IN (
                SELECT pt.id
                FROM project_types pt
                WHERE NOT EXISTS (
                    SELECT 1 FROM organizations o
                    WHERE o.id = pt.organization_id
                )
            )
        """))
        
        # For organizations without project types, create default ones
        orgs_without_types = [org_id for org_id, data in org_types.items() if not data['types']]
        
        default_types = [
            "Consulting",
            "Implementation", 
            "Training",
            "Support",
            "Development",
            "Research",
            "Strategy",
            "Other"
        ]
        
        for org_id in orgs_without_types:
            print(f"\nInitializing default project types for organization {org_id}")
            for i, type_name in enumerate(default_types):
                conn.execute(text("""
                    INSERT INTO project_types (organization_id, name, display_order, is_active, created_at, updated_at)
                    VALUES (:org_id, :name, :order, true, :now, :now)
                    ON CONFLICT (organization_id, name) DO NOTHING
                """), {
                    'org_id': org_id,
                    'name': type_name,
                    'order': i,
                    'now': datetime.utcnow()
                })
        
        # Special handling for Strategic Consulting & Coaching
        scc_result = conn.execute(text("""
            SELECT id FROM organizations 
            WHERE name = 'Strategic Consulting & Coaching, LLC'
        """))
        scc_org = scc_result.fetchone()
        
        if scc_org:
            print(f"\nFound Strategic Consulting & Coaching (org_id: {scc_org.id})")
            
            # Define SCC-specific project types
            scc_types = [
                "Annual Giving",
                "Board Development",
                "Capital Campaign",
                "Church Administration",
                "Church Search",
                "Communication Strategies",
                "Conflict Resolution/Mediation",
                "Feasibility Study",
                "Gift Acceptance Policies",
                "Human Resources",
                "Leadership Development/Training",
                "Major Gifts",
                "Pastoral Counseling",
                "Planned Giving",
                "Search - Other",
                "Social Media",
                "Staff Search",
                "Stewardship Campaign",
                "Strategic Planning",
                "Vision Framing",
                "Other"
            ]
            
            # Clear existing types for SCC
            conn.execute(text("""
                DELETE FROM project_types WHERE organization_id = :org_id
            """), {'org_id': scc_org.id})
            
            # Insert SCC-specific types
            for i, type_name in enumerate(scc_types):
                conn.execute(text("""
                    INSERT INTO project_types (organization_id, name, display_order, is_active, created_at, updated_at)
                    VALUES (:org_id, :name, :order, true, :now, :now)
                """), {
                    'org_id': scc_org.id,
                    'name': type_name,
                    'order': i,
                    'now': datetime.utcnow()
                })
            print(f"Initialized {len(scc_types)} project types for SCC")
        
        print("\nMigration completed successfully!")
        
        # Verify final state
        final_result = conn.execute(text("""
            SELECT 
                o.id as org_id,
                o.name as org_name,
                COUNT(pt.id) as type_count
            FROM organizations o
            LEFT JOIN project_types pt ON pt.organization_id = o.id
            GROUP BY o.id, o.name
            ORDER BY o.id
        """))
        
        print("\nFinal project type counts by organization:")
        for row in final_result:
            print(f"  Organization {row.org_id} ({row.org_name}): {row.type_count} types")

if __name__ == "__main__":
    run_migration()