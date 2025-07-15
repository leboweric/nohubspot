#!/usr/bin/env python3
"""
Migration script to update email_signatures table schema
to match the current models.py definition.
"""

import sqlite3
import os
from datetime import datetime

def migrate_email_signatures():
    db_path = 'nohubspot.db'
    
    if not os.path.exists(db_path):
        print("Database file not found!")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("Starting email_signatures table migration...")
        
        # 1. Create backup of current table
        print("1. Creating backup table...")
        cursor.execute('''
            CREATE TABLE email_signatures_backup AS 
            SELECT * FROM email_signatures
        ''')
        
        # 2. Drop the old table
        print("2. Dropping old email_signatures table...")
        cursor.execute('DROP TABLE email_signatures')
        
        # 3. Create new table with correct schema
        print("3. Creating new email_signatures table...")
        cursor.execute('''
            CREATE TABLE email_signatures (
                id INTEGER PRIMARY KEY,
                organization_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                name VARCHAR(255),
                title VARCHAR(255),
                company VARCHAR(255),
                phone VARCHAR(50),
                email VARCHAR(255),
                website VARCHAR(255),
                custom_text TEXT,
                enabled BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (organization_id) REFERENCES organizations(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        
        # 4. Get valid user and organization IDs
        cursor.execute('SELECT id FROM users LIMIT 1')
        user_result = cursor.fetchone()
        if not user_result:
            print("No users found! Cannot migrate signature data.")
            conn.rollback()
            return
        user_id = user_result[0]
        
        cursor.execute('SELECT id FROM organizations LIMIT 1') 
        org_result = cursor.fetchone()
        if not org_result:
            print("No organizations found! Cannot migrate signature data.")
            conn.rollback()
            return
        org_id = org_result[0]
        
        # 5. Migrate data from backup (excluding rows with user_id='default')
        print(f"4. Migrating data (assigning to user_id={user_id}, org_id={org_id})...")
        cursor.execute('''
            INSERT INTO email_signatures 
            (organization_id, user_id, name, title, company, phone, email, website, custom_text, enabled, created_at, updated_at)
            SELECT ?, ?, name, title, company, phone, email, website, custom_text, enabled, created_at, updated_at
            FROM email_signatures_backup
            WHERE user_id != 'default' OR user_id IS NULL
        ''', (org_id, user_id))
        
        # 6. Drop backup table
        print("5. Cleaning up backup table...")
        cursor.execute('DROP TABLE email_signatures_backup')
        
        # 7. Commit changes
        conn.commit()
        print("✅ Migration completed successfully!")
        
        # Show final state
        cursor.execute('SELECT COUNT(*) FROM email_signatures')
        count = cursor.fetchone()[0]
        print(f"Final signature count: {count}")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
        
        # Restore from backup if it exists
        try:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='email_signatures_backup'")
            if cursor.fetchone():
                print("Restoring from backup...")
                cursor.execute('DROP TABLE IF EXISTS email_signatures')
                cursor.execute('ALTER TABLE email_signatures_backup RENAME TO email_signatures')
                conn.commit()
                print("Backup restored.")
        except:
            pass
            
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_email_signatures()