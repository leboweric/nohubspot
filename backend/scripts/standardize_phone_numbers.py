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


def standardize_phone_numbers(organization_id: int = None):
    """
    Standardize all phone numbers in the database to format: (XXX) XXX-XXXX
    If organization_id is provided, only process that organization's data.
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
        query = db.query(Company).filter(Company.phone.isnot(None))
        if organization_id:
            query = query.filter(Company.organization_id == organization_id)
        companies = query.all()
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
        query = db.query(Contact).filter(Contact.phone.isnot(None))
        if organization_id:
            query = query.filter(Contact.organization_id == organization_id)
        contacts = query.all()
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
        query = db.query(EmailSignature).filter(EmailSignature.phone.isnot(None))
        if organization_id:
            query = query.filter(EmailSignature.organization_id == organization_id)
        signatures = query.all()
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


def dry_run(organization_id: int = None):
    """
    Preview what changes would be made without actually updating the database.
    Returns a dictionary with preview data.
    """
    db = next(get_db())
    
    try:
        logger.info("Running in DRY RUN mode - no changes will be made")
        
        preview_data = {
            'companies': [],
            'contacts': [],
            'email_signatures': [],
            'summary': {
                'companies_to_update': 0,
                'contacts_to_update': 0,
                'email_signatures_to_update': 0,
                'total_changes': 0
            }
        }
        
        # Check Companies
        query = db.query(Company).filter(Company.phone.isnot(None))
        if organization_id:
            query = query.filter(Company.organization_id == organization_id)
        companies = query.all()
        
        for company in companies:
            if company.phone:
                formatted_phone = format_phone_number(company.phone)
                if company.phone != formatted_phone:
                    preview_data['companies'].append({
                        'name': company.name,
                        'current': company.phone,
                        'formatted': formatted_phone
                    })
                    preview_data['summary']['companies_to_update'] += 1
        
        # Check Contacts
        query = db.query(Contact).filter(Contact.phone.isnot(None))
        if organization_id:
            query = query.filter(Contact.organization_id == organization_id)
        contacts = query.all()
        
        for contact in contacts:
            if contact.phone:
                formatted_phone = format_phone_number(contact.phone)
                if contact.phone != formatted_phone:
                    preview_data['contacts'].append({
                        'name': f"{contact.first_name} {contact.last_name}",
                        'current': contact.phone,
                        'formatted': formatted_phone
                    })
                    preview_data['summary']['contacts_to_update'] += 1
        
        # Check Email Signatures
        query = db.query(EmailSignature).filter(EmailSignature.phone.isnot(None))
        if organization_id:
            query = query.filter(EmailSignature.organization_id == organization_id)
        signatures = query.all()
        
        for signature in signatures:
            if signature.phone:
                formatted_phone = format_phone_number(signature.phone)
                if signature.phone != formatted_phone:
                    preview_data['email_signatures'].append({
                        'name': signature.name,
                        'current': signature.phone,
                        'formatted': formatted_phone
                    })
                    preview_data['summary']['email_signatures_to_update'] += 1
        
        preview_data['summary']['total_changes'] = (
            preview_data['summary']['companies_to_update'] + 
            preview_data['summary']['contacts_to_update'] + 
            preview_data['summary']['email_signatures_to_update']
        )
        
        return preview_data
        
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