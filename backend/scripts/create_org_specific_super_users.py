"""
Script to create organization-specific super user accounts for testing.
Creates unique emails like: superuser+orgid@nothubspot.com
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database import get_db
from models import User, Organization
# Removed direct passlib import - using centralized auth function
import logging
from datetime import datetime
import re

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import the centralized password hashing function
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth import get_password_hash

def sanitize_org_name(org_name: str) -> str:
    """Convert organization name to a safe email suffix."""
    # Remove special characters and spaces, convert to lowercase
    safe_name = re.sub(r'[^a-zA-Z0-9]', '', org_name).lower()
    # Limit length
    return safe_name[:20]

def create_org_specific_super_users(password: str = "SuperUser123!"):
    """
    Create organization-specific super user accounts.
    """
    db = next(get_db())
    
    try:
        # Hash the password using centralized function
        hashed_password = get_password_hash(password)
        
        # Get all organizations
        organizations = db.query(Organization).order_by(Organization.name).all()
        logger.info(f"Found {len(organizations)} organizations")
        
        created_count = 0
        accounts = []
        
        for org in organizations:
            # Create unique email for this org
            safe_name = sanitize_org_name(org.name)
            email = f"superuser+{org.id}@nothubspot.com"
            
            # Check if super user already exists
            existing_user = db.query(User).filter(
                User.email == email,
                User.organization_id == org.id
            ).first()
            
            if existing_user:
                logger.info(f"Super user already exists for {org.name}")
                accounts.append({
                    'org_name': org.name,
                    'org_id': org.id,
                    'email': email,
                    'status': 'existing'
                })
                continue
            
            # Create new super user
            super_user = User(
                email=email,
                hashed_password=hashed_password,
                first_name="Super",
                last_name=f"User ({safe_name})",
                role="owner",
                is_active=True,
                organization_id=org.id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                email_verified=True
            )
            
            db.add(super_user)
            logger.info(f"Created super user for {org.name}")
            created_count += 1
            accounts.append({
                'org_name': org.name,
                'org_id': org.id,
                'email': email,
                'status': 'created'
            })
        
        # Commit all changes
        db.commit()
        
        # Print summary
        logger.info(f"\n{'='*80}")
        logger.info("SUPER USER ACCOUNTS SUMMARY")
        logger.info(f"{'='*80}")
        logger.info(f"Created {created_count} new accounts")
        logger.info(f"\nAll accounts (Password for all: {password}):\n")
        
        logger.info(f"{'Organization':<40} {'Email':<40}")
        logger.info(f"{'-'*40} {'-'*40}")
        
        for account in accounts:
            status_mark = "✓" if account['status'] == 'created' else "•"
            logger.info(f"{status_mark} {account['org_name']:<38} {account['email']:<40}")
        
        # Special note for Strategic Consulting
        strategic = next((acc for acc in accounts if "Strategic Consulting" in acc['org_name']), None)
        if strategic:
            logger.info(f"\n{'='*80}")
            logger.info("FOR STRATEGIC CONSULTING & COACHING:")
            logger.info(f"Email: {strategic['email']}")
            logger.info(f"Password: {password}")
            logger.info(f"{'='*80}")
        
    except Exception as e:
        logger.error(f"Error creating super users: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


def remove_org_specific_super_users():
    """
    Remove all organization-specific super user accounts.
    """
    db = next(get_db())
    
    try:
        # Delete all super users with the pattern
        deleted_count = db.query(User).filter(
            User.email.like("superuser+%@nothubspot.com")
        ).delete(synchronize_session=False)
        
        db.commit()
        logger.info(f"Removed {deleted_count} super user accounts")
        
    except Exception as e:
        logger.error(f"Error removing super users: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Create org-specific super user accounts")
    parser.add_argument("--remove", action="store_true", help="Remove all super user accounts")
    parser.add_argument("--password", default="SuperUser123!", help="Password for accounts")
    args = parser.parse_args()
    
    if args.remove:
        confirm = input("Remove all org-specific super user accounts? (yes/no): ")
        if confirm.lower() == "yes":
            remove_org_specific_super_users()
    else:
        create_org_specific_super_users(password=args.password)