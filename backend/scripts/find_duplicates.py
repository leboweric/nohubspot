"""
Script to find duplicate companies and contacts in the database.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from database import get_db
from models import Company, Contact
from phone_utils import format_phone_number
import logging
from datetime import datetime
from collections import defaultdict
import re

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def normalize_string(s):
    """Normalize a string for comparison (lowercase, strip, remove extra spaces)"""
    if not s:
        return ""
    return re.sub(r'\s+', ' ', s.strip().lower())


def normalize_email(email):
    """Normalize email for comparison"""
    if not email:
        return ""
    return email.strip().lower()


def normalize_phone(phone):
    """Normalize phone for comparison"""
    if not phone:
        return ""
    # Format phone number if possible
    formatted = format_phone_number(phone)
    # Remove all non-numeric characters for comparison
    return re.sub(r'\D', '', formatted or phone)


def find_duplicate_companies(organization_id: int):
    """
    Find duplicate companies based on:
    1. Exact name match (case-insensitive)
    2. Same domain
    3. Same phone number
    """
    db = next(get_db())
    
    try:
        duplicates = {
            'by_name': [],
            'by_domain': [],
            'by_phone': [],
            'summary': {
                'total_companies': 0,
                'duplicate_groups': 0,
                'total_duplicates': 0
            }
        }
        
        # Get all companies for the organization
        companies = db.query(Company).filter(
            Company.organization_id == organization_id,
            Company.is_active == True
        ).all()
        
        duplicates['summary']['total_companies'] = len(companies)
        
        # Find duplicates by name
        name_groups = defaultdict(list)
        for company in companies:
            normalized_name = normalize_string(company.name)
            if normalized_name:
                name_groups[normalized_name].append(company)
        
        for name, group in name_groups.items():
            if len(group) > 1:
                duplicates['by_name'].append({
                    'match_value': name,
                    'companies': [{
                        'id': c.id,
                        'name': c.name,
                        'domain': c.domain,
                        'phone': c.phone,
                        'created_at': c.created_at.isoformat() if c.created_at else None,
                        'updated_at': c.updated_at.isoformat() if c.updated_at else None,
                        'deal_count': len([d for d in c.deals if d.is_active]),
                        'contact_count': len([ct for ct in c.contacts if ct.is_active])
                    } for c in sorted(group, key=lambda x: x.created_at or datetime.min)]
                })
        
        # Find duplicates by domain
        domain_groups = defaultdict(list)
        for company in companies:
            if company.domain:
                normalized_domain = normalize_string(company.domain)
                if normalized_domain:
                    domain_groups[normalized_domain].append(company)
        
        for domain, group in domain_groups.items():
            if len(group) > 1:
                duplicates['by_domain'].append({
                    'match_value': domain,
                    'companies': [{
                        'id': c.id,
                        'name': c.name,
                        'domain': c.domain,
                        'phone': c.phone,
                        'created_at': c.created_at.isoformat() if c.created_at else None,
                        'updated_at': c.updated_at.isoformat() if c.updated_at else None,
                        'deal_count': len([d for d in c.deals if d.is_active]),
                        'contact_count': len([ct for ct in c.contacts if ct.is_active])
                    } for c in sorted(group, key=lambda x: x.created_at or datetime.min)]
                })
        
        # Find duplicates by phone
        phone_groups = defaultdict(list)
        for company in companies:
            if company.phone:
                normalized_phone = normalize_phone(company.phone)
                if normalized_phone and len(normalized_phone) >= 10:  # Valid phone
                    phone_groups[normalized_phone].append(company)
        
        for phone, group in phone_groups.items():
            if len(group) > 1:
                duplicates['by_phone'].append({
                    'match_value': phone,
                    'companies': [{
                        'id': c.id,
                        'name': c.name,
                        'domain': c.domain,
                        'phone': c.phone,
                        'created_at': c.created_at.isoformat() if c.created_at else None,
                        'updated_at': c.updated_at.isoformat() if c.updated_at else None,
                        'deal_count': len([d for d in c.deals if d.is_active]),
                        'contact_count': len([ct for ct in c.contacts if ct.is_active])
                    } for c in sorted(group, key=lambda x: x.created_at or datetime.min)]
                })
        
        # Calculate summary
        all_duplicate_ids = set()
        for dup_list in [duplicates['by_name'], duplicates['by_domain'], duplicates['by_phone']]:
            for group in dup_list:
                duplicates['summary']['duplicate_groups'] += 1
                for company in group['companies']:
                    all_duplicate_ids.add(company['id'])
        
        duplicates['summary']['total_duplicates'] = len(all_duplicate_ids)
        
        return duplicates
        
    except Exception as e:
        logger.error(f"Error finding duplicate companies: {str(e)}")
        raise
    finally:
        db.close()


def find_duplicate_contacts(organization_id: int):
    """
    Find duplicate contacts based on:
    1. Same email address
    2. Same first + last name (case-insensitive)
    3. Same phone number
    """
    db = next(get_db())
    
    try:
        duplicates = {
            'by_email': [],
            'by_name': [],
            'by_phone': [],
            'summary': {
                'total_contacts': 0,
                'duplicate_groups': 0,
                'total_duplicates': 0
            }
        }
        
        # Get all contacts for the organization
        contacts = db.query(Contact).filter(
            Contact.organization_id == organization_id,
            Contact.is_active == True
        ).all()
        
        duplicates['summary']['total_contacts'] = len(contacts)
        
        # Find duplicates by email
        email_groups = defaultdict(list)
        for contact in contacts:
            if contact.email:
                normalized_email = normalize_email(contact.email)
                if normalized_email:
                    email_groups[normalized_email].append(contact)
        
        for email, group in email_groups.items():
            if len(group) > 1:
                duplicates['by_email'].append({
                    'match_value': email,
                    'contacts': [{
                        'id': c.id,
                        'first_name': c.first_name,
                        'last_name': c.last_name,
                        'email': c.email,
                        'phone': c.phone,
                        'company_id': c.company_id,
                        'company_name': c.company.name if c.company else None,
                        'created_at': c.created_at.isoformat() if c.created_at else None,
                        'updated_at': c.updated_at.isoformat() if c.updated_at else None,
                        'deal_count': len([d for d in c.deals if d.is_active]),
                        'email_count': len(c.email_threads)
                    } for c in sorted(group, key=lambda x: x.created_at or datetime.min)]
                })
        
        # Find duplicates by name
        name_groups = defaultdict(list)
        for contact in contacts:
            first_name = normalize_string(contact.first_name)
            last_name = normalize_string(contact.last_name)
            if first_name and last_name:
                full_name = f"{first_name} {last_name}"
                name_groups[full_name].append(contact)
        
        for name, group in name_groups.items():
            if len(group) > 1:
                duplicates['by_name'].append({
                    'match_value': name,
                    'contacts': [{
                        'id': c.id,
                        'first_name': c.first_name,
                        'last_name': c.last_name,
                        'email': c.email,
                        'phone': c.phone,
                        'company_id': c.company_id,
                        'company_name': c.company.name if c.company else None,
                        'created_at': c.created_at.isoformat() if c.created_at else None,
                        'updated_at': c.updated_at.isoformat() if c.updated_at else None,
                        'deal_count': len([d for d in c.deals if d.is_active]),
                        'email_count': len(c.email_threads)
                    } for c in sorted(group, key=lambda x: x.created_at or datetime.min)]
                })
        
        # Find duplicates by phone
        phone_groups = defaultdict(list)
        for contact in contacts:
            if contact.phone:
                normalized_phone = normalize_phone(contact.phone)
                if normalized_phone and len(normalized_phone) >= 10:  # Valid phone
                    phone_groups[normalized_phone].append(contact)
        
        for phone, group in phone_groups.items():
            if len(group) > 1:
                duplicates['by_phone'].append({
                    'match_value': phone,
                    'contacts': [{
                        'id': c.id,
                        'first_name': c.first_name,
                        'last_name': c.last_name,
                        'email': c.email,
                        'phone': c.phone,
                        'company_id': c.company_id,
                        'company_name': c.company.name if c.company else None,
                        'created_at': c.created_at.isoformat() if c.created_at else None,
                        'updated_at': c.updated_at.isoformat() if c.updated_at else None,
                        'deal_count': len([d for d in c.deals if d.is_active]),
                        'email_count': len(c.email_threads)
                    } for c in sorted(group, key=lambda x: x.created_at or datetime.min)]
                })
        
        # Calculate summary
        all_duplicate_ids = set()
        for dup_list in [duplicates['by_email'], duplicates['by_name'], duplicates['by_phone']]:
            for group in dup_list:
                duplicates['summary']['duplicate_groups'] += 1
                for contact in group['contacts']:
                    all_duplicate_ids.add(contact['id'])
        
        duplicates['summary']['total_duplicates'] = len(all_duplicate_ids)
        
        return duplicates
        
    except Exception as e:
        logger.error(f"Error finding duplicate contacts: {str(e)}")
        raise
    finally:
        db.close()


def delete_duplicate_records(record_type: str, record_ids: list, organization_id: int):
    """
    Delete specified duplicate records (soft delete by setting is_active=False)
    """
    db = next(get_db())
    
    try:
        deleted_count = 0
        
        if record_type == 'companies':
            records = db.query(Company).filter(
                Company.id.in_(record_ids),
                Company.organization_id == organization_id,
                Company.is_active == True
            ).all()
            
            for record in records:
                record.is_active = False
                deleted_count += 1
                logger.info(f"Soft-deleted company: {record.name} (ID: {record.id})")
                
        elif record_type == 'contacts':
            records = db.query(Contact).filter(
                Contact.id.in_(record_ids),
                Contact.organization_id == organization_id,
                Contact.is_active == True
            ).all()
            
            for record in records:
                record.is_active = False
                deleted_count += 1
                logger.info(f"Soft-deleted contact: {record.first_name} {record.last_name} (ID: {record.id})")
        
        db.commit()
        
        return {
            'success': True,
            'deleted_count': deleted_count,
            'message': f"Successfully deleted {deleted_count} {record_type}"
        }
        
    except Exception as e:
        logger.error(f"Error deleting duplicate records: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Find duplicate companies and contacts")
    parser.add_argument("--organization-id", type=int, required=True, help="Organization ID to check")
    parser.add_argument("--type", choices=["companies", "contacts", "both"], default="both", 
                       help="Type of duplicates to find")
    args = parser.parse_args()
    
    if args.type in ["companies", "both"]:
        print("\n=== DUPLICATE COMPANIES ===")
        company_duplicates = find_duplicate_companies(args.organization_id)
        print(f"Total companies: {company_duplicates['summary']['total_companies']}")
        print(f"Duplicate groups: {company_duplicates['summary']['duplicate_groups']}")
        print(f"Total duplicates: {company_duplicates['summary']['total_duplicates']}")
        
    if args.type in ["contacts", "both"]:
        print("\n=== DUPLICATE CONTACTS ===")
        contact_duplicates = find_duplicate_contacts(args.organization_id)
        print(f"Total contacts: {contact_duplicates['summary']['total_contacts']}")
        print(f"Duplicate groups: {contact_duplicates['summary']['duplicate_groups']}")
        print(f"Total duplicates: {contact_duplicates['summary']['total_duplicates']}")