#!/usr/bin/env python3
"""
Database migration to add password reset fields to users table
"""
import sqlite3
import os

def migrate_database():
    db_path = os.path.join('src', 'database', 'app.db')
    
    if not os.path.exists(db_path):
        print("Database does not exist. It will be created with the new schema.")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'reset_token_hash' not in columns:
            print("Adding reset_token_hash column...")
            cursor.execute("ALTER TABLE users ADD COLUMN reset_token_hash TEXT")
        
        if 'reset_token_expires' not in columns:
            print("Adding reset_token_expires column...")
            cursor.execute("ALTER TABLE users ADD COLUMN reset_token_expires DATETIME")
        
        conn.commit()
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database()

