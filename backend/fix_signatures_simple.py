#!/usr/bin/env python3
"""
Simple fix for email_signatures table to work with current schema.
This modifies the table to have a string user_id without foreign keys.
"""

import sqlite3
import os

def fix_email_signatures():
    db_path = 'nohubspot.db'
    
    if not os.path.exists(db_path):
        print("Database file not found!")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("Fixing email_signatures table...")
        
        # Check current schema
        cursor.execute('PRAGMA table_info(email_signatures)')
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        print(f"Current columns: {column_names}")
        
        # Add organization_id column if it doesn't exist
        if 'organization_id' not in column_names:
            print("Adding organization_id column...")
            cursor.execute('ALTER TABLE email_signatures ADD COLUMN organization_id INTEGER DEFAULT 1')
        
        # Update user_id for the existing signature(s) to use a valid format
        print("Updating existing signatures...")
        cursor.execute('UPDATE email_signatures SET user_id = ? WHERE user_id = ?', ('1', 'default'))
        
        conn.commit()
        print("✅ Email signatures table fixed!")
        
        # Show current state
        cursor.execute('SELECT id, user_id, organization_id, name, enabled FROM email_signatures')
        signatures = cursor.fetchall()
        print("Current signatures:")
        for sig in signatures:
            print(f"  ID: {sig[0]}, User: {sig[1]}, Org: {sig[2]}, Name: {sig[3]}, Enabled: {sig[4]}")
        
    except Exception as e:
        print(f"❌ Fix failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    fix_email_signatures()