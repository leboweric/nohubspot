#!/usr/bin/env python3
"""
Migration script to add email tracking tables to existing databases.
This can be run safely on both new and existing databases.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text
from database import engine
from models import Base, EmailTracking, EmailEvent

def table_exists(table_name):
    """Check if a table exists in the database"""
    inspector = inspect(engine)
    return table_name in inspector.get_table_names()

def add_email_tracking_tables():
    """Add email tracking tables if they don't exist"""
    print("🔍 Checking for email tracking tables...")
    
    tables_to_create = []
    
    # Check which tables need to be created
    if not table_exists('email_tracking'):
        tables_to_create.append('email_tracking')
    
    if not table_exists('email_events'):
        tables_to_create.append('email_events')
    
    if not tables_to_create:
        print("✅ Email tracking tables already exist!")
        return True
    
    print(f"📦 Creating tables: {', '.join(tables_to_create)}")
    
    try:
        # Create only the missing tables
        # This uses SQLAlchemy's create_all with specific tables
        Base.metadata.create_all(
            engine, 
            tables=[
                EmailTracking.__table__,
                EmailEvent.__table__
            ],
            checkfirst=True  # Only create if doesn't exist
        )
        print("✅ Email tracking tables created successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Failed to create tables: {e}")
        return False

def main():
    """Run the migration"""
    print("🚀 Email Tracking Migration")
    print("=" * 50)
    
    success = add_email_tracking_tables()
    
    if success:
        print("\n✅ Migration completed successfully!")
        print("\nNext steps:")
        print("1. Configure SendGrid webhook URL in your SendGrid account")
        print("2. Restart your backend server to load the new endpoints")
    else:
        print("\n❌ Migration failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()