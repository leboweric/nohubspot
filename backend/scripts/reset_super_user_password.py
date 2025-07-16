"""
Script to reset super user password with a working hash.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database import get_db
from models import User
from auth_crud import get_password_hash
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def reset_strategic_consulting_password():
    """Reset the Strategic Consulting super user password."""
    db = next(get_db())
    
    try:
        # Find the Strategic Consulting super user
        user = db.query(User).filter(
            User.email == "superuser+7@nothubspot.com"
        ).first()
        
        if not user:
            logger.error("Super user not found for Strategic Consulting!")
            return
        
        # Generate new password hash using the same method as the app
        new_password = "TestUser123!"
        new_hash = get_password_hash(new_password)
        
        # Update the password
        user.password_hash = new_hash
        db.commit()
        
        logger.info("="*60)
        logger.info("PASSWORD RESET SUCCESSFUL")
        logger.info("="*60)
        logger.info(f"Email: {user.email}")
        logger.info(f"New Password: {new_password}")
        logger.info(f"Organization ID: {user.organization_id}")
        logger.info("="*60)
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    reset_strategic_consulting_password()