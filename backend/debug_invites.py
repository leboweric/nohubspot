"""
Debug script to check invitation status
"""
from sqlalchemy.orm import Session
from database import SessionLocal
from models import UserInvite, Organization

def debug_invites():
    """Check all invitations in the database"""
    db = SessionLocal()
    
    try:
        # Get all organizations
        orgs = db.query(Organization).all()
        
        print("=== ALL INVITATIONS IN DATABASE ===\n")
        
        for org in orgs:
            print(f"\nOrganization: {org.name} (ID: {org.id})")
            print("-" * 50)
            
            # Get all invites for this org
            invites = db.query(UserInvite).filter(
                UserInvite.organization_id == org.id
            ).all()
            
            if not invites:
                print("  No invitations")
            else:
                for invite in invites:
                    print(f"  ID: {invite.id}")
                    print(f"  Email: {invite.email}")
                    print(f"  Status: {invite.status}")
                    print(f"  Role: {invite.role}")
                    print(f"  Created: {invite.created_at}")
                    print(f"  Expires: {invite.expires_at}")
                    print(f"  Invite Code: {invite.invite_code}")
                    print()
        
        # Check for any pending invites
        print("\n=== PENDING INVITATIONS ===")
        pending = db.query(UserInvite).filter(
            UserInvite.status == "pending"
        ).all()
        
        if not pending:
            print("No pending invitations found")
        else:
            for invite in pending:
                org = db.query(Organization).filter(
                    Organization.id == invite.organization_id
                ).first()
                print(f"ID: {invite.id} - {invite.email} - Org: {org.name if org else 'Unknown'}")
                
    finally:
        db.close()

if __name__ == "__main__":
    debug_invites()