"""
Script to list all organizations and their IDs for super user login.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database import get_db
from models import User, Organization
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s'
)
logger = logging.getLogger(__name__)

def list_organizations_with_super_user():
    """
    List all organizations that have super user access.
    """
    db = next(get_db())
    
    try:
        # Get all organizations with super user
        results = db.query(Organization, User).join(
            User, User.organization_id == Organization.id
        ).filter(
            User.email == "superuser@nothubspot.com"
        ).order_by(Organization.name).all()
        
        if not results:
            logger.info("No super user accounts found. Run create_super_users.py first.")
            return
        
        logger.info("\n" + "="*70)
        logger.info("ORGANIZATIONS WITH SUPER USER ACCESS")
        logger.info("="*70)
        logger.info(f"{'ID':<6} {'Organization Name':<40} {'Domain':<20}")
        logger.info("-"*70)
        
        for org, user in results:
            domain = org.domain or "N/A"
            logger.info(f"{org.id:<6} {org.name:<40} {domain:<20}")
        
        logger.info("-"*70)
        logger.info(f"\nTotal: {len(results)} organizations")
        logger.info("\nLogin credentials:")
        logger.info("Email: superuser@nothubspot.com")
        logger.info("Password: SuperUser123!")
        
        # Find Strategic Consulting specifically
        strategic = next((org for org, _ in results if "Strategic Consulting" in org.name), None)
        if strategic:
            logger.info(f"\n✓ Strategic Consulting & Coaching found - Organization ID: {strategic.id}")
        
    except Exception as e:
        logger.error(f"Error listing organizations: {str(e)}")
        raise
    finally:
        db.close()


def get_organization_login_url(org_name_partial: str):
    """
    Get the login URL for a specific organization by partial name match.
    """
    db = next(get_db())
    
    try:
        # Search for organization by partial name
        org = db.query(Organization).filter(
            Organization.name.ilike(f"%{org_name_partial}%")
        ).first()
        
        if org:
            # Check if super user exists
            user = db.query(User).filter(
                User.email == "superuser@nothubspot.com",
                User.organization_id == org.id
            ).first()
            
            if user:
                logger.info(f"\nFound: {org.name}")
                logger.info(f"Organization ID: {org.id}")
                logger.info(f"Domain: {org.domain or 'Not set'}")
                logger.info(f"\nLogin URL: https://nothubspot.app/auth/login")
                logger.info(f"Email: superuser@nothubspot.com")
                logger.info(f"Password: SuperUser123!")
                logger.info(f"\nNote: The system will automatically log you into the {org.name} organization")
            else:
                logger.info(f"\nOrganization '{org.name}' found but no super user account exists.")
                logger.info("Run create_super_users.py to create one.")
        else:
            logger.info(f"\nNo organization found matching '{org_name_partial}'")
        
    except Exception as e:
        logger.error(f"Error finding organization: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="List organizations with super user access")
    parser.add_argument("--find", help="Find a specific organization by name")
    args = parser.parse_args()
    
    if args.find:
        get_organization_login_url(args.find)
    else:
        list_organizations_with_super_user()