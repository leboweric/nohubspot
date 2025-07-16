"""
Script to create super user accounts for testing in each organization.
Creates a user with email: superuser@nothubspot.com for each org.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database import get_db
from models import User, Organization
from passlib.context import CryptContext
import logging
from datetime import datetime

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_super_users(password: str = "SuperUser123!"):
    """
    Create a super user account for each organization in the system.
    """
    db = next(get_db())
    
    try:
        # Hash the password
        hashed_password = pwd_context.hash(password)
        
        # Get all organizations
        organizations = db.query(Organization).all()
        logger.info(f"Found {len(organizations)} organizations")
        
        created_count = 0
        skipped_count = 0
        
        for org in organizations:
            # Check if super user already exists for this org
            existing_user = db.query(User).filter(
                User.email == "superuser@nothubspot.com",
                User.organization_id == org.id
            ).first()
            
            if existing_user:
                logger.info(f"Super user already exists for {org.name} (ID: {org.id})")
                skipped_count += 1
                continue
            
            # Create new super user
            super_user = User(
                email="superuser@nothubspot.com",
                hashed_password=hashed_password,
                first_name="Super",
                last_name="User",
                role="owner",  # Owner role for full access
                is_active=True,
                organization_id=org.id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                email_verified=True
            )
            
            db.add(super_user)
            logger.info(f"Created super user for {org.name} (ID: {org.id})")
            created_count += 1
        
        # Commit all changes
        db.commit()
        
        logger.info(f"\nSummary:")
        logger.info(f"- Created {created_count} new super users")
        logger.info(f"- Skipped {skipped_count} existing super users")
        logger.info(f"\nLogin credentials:")
        logger.info(f"Email: superuser@nothubspot.com")
        logger.info(f"Password: {password}")
        logger.info(f"\nIMPORTANT: Change the password after first login!")
        
        # List all organizations with super user access
        logger.info(f"\nOrganizations with super user access:")
        all_super_users = db.query(User, Organization).join(
            Organization, User.organization_id == Organization.id
        ).filter(
            User.email == "superuser@nothubspot.com"
        ).order_by(Organization.name).all()
        
        for user, org in all_super_users:
            logger.info(f"- {org.name} (Org ID: {org.id}, User ID: {user.id})")
        
    except Exception as e:
        logger.error(f"Error creating super users: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


def remove_super_users():
    """
    Remove all super user accounts (for cleanup).
    """
    db = next(get_db())
    
    try:
        # Delete all super users
        deleted_count = db.query(User).filter(
            User.email == "superuser@nothubspot.com"
        ).delete()
        
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
    
    parser = argparse.ArgumentParser(description="Manage super user accounts for testing")
    parser.add_argument("--remove", action="store_true", help="Remove all super user accounts")
    parser.add_argument("--password", default="SuperUser123!", help="Password for super user accounts")
    args = parser.parse_args()
    
    if args.remove:
        confirm = input("Are you sure you want to remove all super user accounts? (yes/no): ")
        if confirm.lower() == "yes":
            remove_super_users()
        else:
            logger.info("Cancelled")
    else:
        create_super_users(password=args.password)