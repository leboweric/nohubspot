#!/usr/bin/env python3
"""
Migration script to add project_types table to existing databases.
This can be run safely on both new and existing databases.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text
from database import engine
from models import Base, ProjectType

def table_exists(table_name):
    """Check if a table exists in the database"""
    inspector = inspect(engine)
    return table_name in inspector.get_table_names()

def add_project_types_table():
    """Add project_types table if it doesn't exist"""
    print("🔍 Checking for project_types table...")
    
    if table_exists('project_types'):
        print("✅ project_types table already exists!")
        return True
    
    print("📦 Creating project_types table...")
    
    try:
        # Create the project_types table
        Base.metadata.create_all(
            engine, 
            tables=[ProjectType.__table__],
            checkfirst=True  # Only create if doesn't exist
        )
        print("✅ project_types table created successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Failed to create table: {e}")
        return False

def populate_scc_project_types():
    """Populate Strategic Consulting & Coaching project types"""
    print("\n🔍 Checking for SCC organization...")
    
    try:
        with engine.connect() as conn:
            # Check if SCC exists
            result = conn.execute(text("""
                SELECT id FROM organizations 
                WHERE name = 'Strategic Consulting & Coaching, LLC'
            """)).fetchone()
            
            if not result:
                print("⚠️  Strategic Consulting & Coaching, LLC not found. Skipping project types.")
                return True
            
            org_id = result.id
            
            # Check if project types already exist
            existing = conn.execute(text("""
                SELECT COUNT(*) as count FROM project_types 
                WHERE organization_id = :org_id
            """), {"org_id": org_id}).fetchone()
            
            if existing.count > 0:
                print(f"✅ SCC already has {existing.count} project types.")
                return True
            
            # Define SCC project types
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
                "Other",
                "Pastoral Counseling",
                "Planned Giving",
                "Search - Other",
                "Social Media",
                "Staff Search",
                "Stewardship Campaign",
                "Strategic Planning",
                "Vision Framing"
            ]
            
            # Insert project types
            for i, type_name in enumerate(scc_types):
                conn.execute(text("""
                    INSERT INTO project_types 
                    (organization_id, name, display_order, is_active)
                    VALUES (:org_id, :name, :order, true)
                """), {
                    "org_id": org_id,
                    "name": type_name,
                    "order": i
                })
            
            conn.commit()
            print(f"✅ Added {len(scc_types)} project types for SCC.")
            return True
            
    except Exception as e:
        print(f"❌ Failed to populate SCC project types: {e}")
        return False

def main():
    """Run the migration"""
    print("🚀 Project Types Migration")
    print("=" * 50)
    
    # First, create the table
    success = add_project_types_table()
    
    if success:
        # Then populate SCC types if applicable
        success = populate_scc_project_types()
    
    if success:
        print("\n✅ Migration completed successfully!")
        print("\nNote: Project types are now organization-specific.")
        print("Each organization can configure their own project types.")
    else:
        print("\n❌ Migration failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()