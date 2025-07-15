"""
Script to standardize all phone numbers in the database.
Can be run manually or scheduled as a cron job.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database import get_db
from models import Company, Contact, EmailSignature
from phone_utils import format_phone_number
import logging
from datetime import datetime

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'phone_standardization_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def standardize_phone_numbers():
    """
    Standardize all phone numbers in the database to format: (XXX) XXX-XXXX
    """
    db = next(get_db())
    
    try:
        # Track statistics
        stats = {
            'companies_processed': 0,
            'companies_updated': 0,
            'contacts_processed': 0,
            'contacts_updated': 0,
            'email_signatures_processed': 0,
            'email_signatures_updated': 0,
            'errors': 0
        }
        
        logger.info("Starting phone number standardization...")
        
        # Process Companies
        logger.info("Processing companies...")
        companies = db.query(Company).filter(Company.phone.isnot(None)).all()
        stats['companies_processed'] = len(companies)
        
        for company in companies:
            if company.phone:
                original_phone = company.phone
                formatted_phone = format_phone_number(company.phone)
                
                if original_phone != formatted_phone:
                    company.phone = formatted_phone
                    stats['companies_updated'] += 1
                    logger.debug(f"Company '{company.name}': '{original_phone}' -> '{formatted_phone}'")
        
        # Process Contacts
        logger.info("Processing contacts...")
        contacts = db.query(Contact).filter(Contact.phone.isnot(None)).all()
        stats['contacts_processed'] = len(contacts)
        
        for contact in contacts:
            if contact.phone:
                original_phone = contact.phone
                formatted_phone = format_phone_number(contact.phone)
                
                if original_phone != formatted_phone:
                    contact.phone = formatted_phone
                    stats['contacts_updated'] += 1
                    logger.debug(f"Contact '{contact.first_name} {contact.last_name}': '{original_phone}' -> '{formatted_phone}'")
        
        # Process Email Signatures
        logger.info("Processing email signatures...")
        signatures = db.query(EmailSignature).filter(EmailSignature.phone.isnot(None)).all()
        stats['email_signatures_processed'] = len(signatures)
        
        for signature in signatures:
            if signature.phone:
                original_phone = signature.phone
                formatted_phone = format_phone_number(signature.phone)
                
                if original_phone != formatted_phone:
                    signature.phone = formatted_phone
                    stats['email_signatures_updated'] += 1
                    logger.debug(f"Email signature '{signature.name}': '{original_phone}' -> '{formatted_phone}'")
        
        # Commit all changes
        db.commit()
        
        # Log summary
        logger.info("Phone number standardization completed successfully!")
        logger.info(f"Companies: {stats['companies_updated']}/{stats['companies_processed']} updated")
        logger.info(f"Contacts: {stats['contacts_updated']}/{stats['contacts_processed']} updated")
        logger.info(f"Email signatures: {stats['email_signatures_updated']}/{stats['email_signatures_processed']} updated")
        logger.info(f"Total updates: {stats['companies_updated'] + stats['contacts_updated'] + stats['email_signatures_updated']}")
        
        return stats
        
    except Exception as e:
        logger.error(f"Error during phone standardization: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


def dry_run():
    """
    Preview what changes would be made without actually updating the database.
    """
    db = next(get_db())
    
    try:
        logger.info("Running in DRY RUN mode - no changes will be made")
        
        # Check Companies
        logger.info("\n=== Companies that would be updated ===")
        companies = db.query(Company).filter(Company.phone.isnot(None)).all()
        company_changes = 0
        
        for company in companies:
            if company.phone:
                formatted_phone = format_phone_number(company.phone)
                if company.phone != formatted_phone:
                    logger.info(f"Company '{company.name}': '{company.phone}' -> '{formatted_phone}'")
                    company_changes += 1
        
        # Check Contacts
        logger.info("\n=== Contacts that would be updated ===")
        contacts = db.query(Contact).filter(Contact.phone.isnot(None)).all()
        contact_changes = 0
        
        for contact in contacts:
            if contact.phone:
                formatted_phone = format_phone_number(contact.phone)
                if contact.phone != formatted_phone:
                    logger.info(f"Contact '{contact.first_name} {contact.last_name}': '{contact.phone}' -> '{formatted_phone}'")
                    contact_changes += 1
        
        # Check Email Signatures
        logger.info("\n=== Email Signatures that would be updated ===")
        signatures = db.query(EmailSignature).filter(EmailSignature.phone.isnot(None)).all()
        signature_changes = 0
        
        for signature in signatures:
            if signature.phone:
                formatted_phone = format_phone_number(signature.phone)
                if signature.phone != formatted_phone:
                    logger.info(f"Email signature '{signature.name}': '{signature.phone}' -> '{formatted_phone}'")
                    signature_changes += 1
        
        logger.info(f"\n=== DRY RUN Summary ===")
        logger.info(f"Companies that would be updated: {company_changes}")
        logger.info(f"Contacts that would be updated: {contact_changes}")
        logger.info(f"Email signatures that would be updated: {signature_changes}")
        logger.info(f"Total changes that would be made: {company_changes + contact_changes + signature_changes}")
        
    except Exception as e:
        logger.error(f"Error during dry run: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Standardize phone numbers in the database")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without updating database")
    args = parser.parse_args()
    
    if args.dry_run:
        dry_run()
    else:
        standardize_phone_numbers()