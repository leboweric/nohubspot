#!/usr/bin/env python3
"""
Add foreign key constraint for primary_account_owner_id
This is done in Python to avoid issues with semicolon parsing in DO blocks
"""
import os
import sys
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.exc import SQLAlchemyError

# Get database URL from environment or use default
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost/nothubspot')

def constraint_exists(engine, constraint_name, table_name):
    """Check if a constraint exists on a table"""
    query = text("""
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = :constraint_name
        AND table_name = :table_name
    """)
    result = engine.execute(query, constraint_name=constraint_name, table_name=table_name)
    return result.fetchone() is not None

def main():
    engine = create_engine(DATABASE_URL)
    
    try:
        with engine.begin() as conn:
            # Check if the foreign key constraint already exists
            if not constraint_exists(engine, 'fk_companies_primary_account_owner', 'companies'):
                print("Adding foreign key constraint for primary_account_owner_id...")
                conn.execute(text("""
                    ALTER TABLE companies 
                    ADD CONSTRAINT fk_companies_primary_account_owner 
                    FOREIGN KEY (primary_account_owner_id) 
                    REFERENCES users(id) ON DELETE SET NULL
                """))
                print("✅ Foreign key constraint added successfully")
            else:
                print("⏭️  Foreign key constraint already exists, skipping...")
                
    except SQLAlchemyError as e:
        print(f"❌ Error adding foreign key constraint: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()