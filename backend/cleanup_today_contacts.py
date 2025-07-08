"""
Script to delete contacts created today for Bennett Material Handling
"""
from datetime import datetime, date
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Contact, Organization, EmailThread, EmailMessage
import sys

def cleanup_today_contacts():
    """Delete contacts created today for Bennett Material Handling"""
    db = SessionLocal()
    
    try:
        # Find Bennett Material Handling organization
        org = db.query(Organization).filter(
            Organization.name.ilike('%bennett material%')
        ).first()
        
        if not org:
            print("❌ Could not find Bennett Material Handling organization")
            return
        
        print(f"✅ Found organization: {org.name} (ID: {org.id})")
        
        # Get today's date
        today = date.today()
        
        # Find contacts created today
        contacts_to_delete = db.query(Contact).filter(
            Contact.organization_id == org.id,
            Contact.created_at >= today
        ).all()
        
        print(f"\n📊 Found {len(contacts_to_delete)} contacts created today:")
        
        # Show contacts that will be deleted
        for contact in contacts_to_delete:
            # Count related email threads
            thread_count = db.query(EmailThread).filter(
                EmailThread.contact_id == contact.id
            ).count()
            
            print(f"  - {contact.first_name} {contact.last_name} ({contact.email}) - {thread_count} email threads")
        
        if not contacts_to_delete:
            print("✅ No contacts to delete")
            return
        
        # Confirm deletion
        print(f"\n⚠️  This will delete {len(contacts_to_delete)} contacts and all their associated data (email threads, messages, tasks, etc.)")
        confirm = input("Are you sure you want to proceed? (yes/no): ")
        
        if confirm.lower() != 'yes':
            print("❌ Deletion cancelled")
            return
        
        # Delete contacts (cascade will handle related records)
        deleted_count = 0
        for contact in contacts_to_delete:
            try:
                db.delete(contact)
                deleted_count += 1
                print(f"  ✅ Deleted: {contact.first_name} {contact.last_name} ({contact.email})")
            except Exception as e:
                print(f"  ❌ Error deleting {contact.email}: {str(e)}")
                db.rollback()
        
        # Commit the transaction
        db.commit()
        print(f"\n✅ Successfully deleted {deleted_count} contacts")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🧹 Bennett Material Handling Contact Cleanup")
    print("=" * 50)
    cleanup_today_contacts()