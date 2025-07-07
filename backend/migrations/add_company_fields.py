#!/usr/bin/env python3
"""
Migration script to add new fields to the companies table.
This can be run safely on existing databases.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text, Column, String, Float
from database import engine
from models import Company

def column_exists(table_name, column_name):
    """Check if a column exists in a table"""
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns

def add_company_fields():
    """Add new fields to the companies table if they don't exist"""
    print("🔍 Checking for new company fields...")
    
    fields_to_add = []
    
    # Check which fields need to be added
    if not column_exists('companies', 'street_address'):
        fields_to_add.append(('street_address', 'VARCHAR(255)'))
    
    if not column_exists('companies', 'city'):
        fields_to_add.append(('city', 'VARCHAR(100)'))
    
    if not column_exists('companies', 'state'):
        fields_to_add.append(('state', 'VARCHAR(100)'))
    
    if not column_exists('companies', 'postal_code'):
        fields_to_add.append(('postal_code', 'VARCHAR(20)'))
    
    if not column_exists('companies', 'phone'):
        fields_to_add.append(('phone', 'VARCHAR(50)'))
    
    if not column_exists('companies', 'annual_revenue'):
        fields_to_add.append(('annual_revenue', 'FLOAT'))
    
    if not fields_to_add:
        print("✅ All company fields already exist!")
        return True
    
    print(f"📦 Adding fields: {', '.join([f[0] for f in fields_to_add])}")
    
    try:
        with engine.connect() as conn:
            for field_name, field_type in fields_to_add:
                print(f"  Adding {field_name}...")
                # Use text() to create the SQL statement
                sql = text(f"ALTER TABLE companies ADD COLUMN {field_name} {field_type}")
                conn.execute(sql)
                conn.commit()
                print(f"  ✓ {field_name} added successfully")
        
        print("✅ All company fields added successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Failed to add fields: {e}")
        return False

def main():
    """Run the migration"""
    print("🚀 Company Fields Migration")
    print("=" * 50)
    
    success = add_company_fields()
    
    if success:
        print("\n✅ Migration completed successfully!")
        print("\nNew fields added to companies table:")
        print("- street_address: Street address")
        print("- city: City name")
        print("- state: State or region")
        print("- postal_code: Postal/ZIP code")
        print("- phone: Phone number")
        print("- annual_revenue: Annual revenue (numeric)")
        print("\nThe 'address' field is kept for backward compatibility.")
    else:
        print("\n❌ Migration failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()