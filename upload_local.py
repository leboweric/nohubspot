#!/usr/bin/env python3
"""
Local upload script for importing companies and contacts to NotHubSpot
This script connects directly to the local database
"""

import json
import sys
import os
from datetime import datetime

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Company, Contact, Organization, User
import crud


def get_organization_and_user(org_slug: str):
    """Get organization and first admin user"""
    db = SessionLocal()
    try:
        # Get organization
        org = db.query(Organization).filter(
            Organization.slug == org_slug
        ).first()
        
        if not org:
            print(f"ERROR: Organization with slug '{org_slug}' not found")
            return None, None
        
        # Get first admin/owner user
        user = db.query(User).filter(
            User.organization_id == org.id,
            User.role.in_(['admin', 'owner'])
        ).first()
        
        if not user:
            print(f"ERROR: No admin user found for organization '{org.name}'")
            return None, None
            
        return org, user
    finally:
        db.close()


def upload_companies_local(companies: list, organization_id: int, user_id: int):
    """Upload companies directly to the database"""
    db = SessionLocal()
    id_mapping = {}
    errors = []
    
    print(f"\nUploading {len(companies)} companies...")
    
    try:
        for i, company_data in enumerate(companies):
            # Remove temporary id
            temp_id = company_data.pop('id')
            
            # Create company object
            company = Company(
                name=company_data['name'],
                street_address=company_data.get('street_address', ''),
                city=company_data.get('city', ''),
                state=company_data.get('state', ''),
                postal_code=company_data.get('postal_code', ''),
                website=company_data.get('website', ''),
                description=company_data.get('description', ''),
                status=company_data.get('status', 'Active'),
                organization_id=organization_id,
                created_by_id=user_id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            try:
                db.add(company)
                db.flush()  # Get the ID without committing
                id_mapping[temp_id] = company.id
                print(f"✓ Created company {i+1}/{len(companies)}: {company_data['name']}")
            except Exception as e:
                error_msg = f"Failed to create company '{company_data['name']}': {str(e)}"
                errors.append(error_msg)
                print(f"✗ {error_msg}")
                db.rollback()
        
        # Commit all companies
        db.commit()
        
    except Exception as e:
        db.rollback()
        print(f"ERROR during company upload: {str(e)}")
    finally:
        db.close()
    
    print(f"\nCompanies uploaded successfully: {len(id_mapping)}/{len(companies)}")
    if errors:
        print(f"Errors encountered: {len(errors)}")
        for error in errors[:5]:
            print(f"  - {error}")
    
    return id_mapping


def upload_contacts_local(contacts: list, company_id_mapping: dict, organization_id: int, user_id: int):
    """Upload contacts directly to the database"""
    db = SessionLocal()
    success_count = 0
    errors = []
    
    print(f"\nUploading {len(contacts)} contacts...")
    
    try:
        for i, contact_data in enumerate(contacts):
            # Get the actual company ID
            temp_company_id = contact_data.get('company_id')
            actual_company_id = company_id_mapping.get(temp_company_id) if temp_company_id else None
            
            # Skip if company not found
            if temp_company_id and not actual_company_id:
                errors.append(f"Skipping contact '{contact_data['first_name']} {contact_data['last_name']}' - company not found")
                continue
            
            # Create contact object
            contact = Contact(
                first_name=contact_data.get('first_name', ''),
                last_name=contact_data.get('last_name', ''),
                email=contact_data.get('email', ''),
                company_id=actual_company_id,
                organization_id=organization_id,
                created_by_id=user_id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            try:
                db.add(contact)
                db.flush()
                success_count += 1
                print(f"✓ Created contact {i+1}/{len(contacts)}: {contact_data['first_name']} {contact_data['last_name']}")
            except Exception as e:
                error_msg = f"Failed to create contact '{contact_data['first_name']} {contact_data['last_name']}': {str(e)}"
                errors.append(error_msg)
                print(f"✗ {error_msg}")
                db.rollback()
        
        # Commit all contacts
        db.commit()
        
    except Exception as e:
        db.rollback()
        print(f"ERROR during contact upload: {str(e)}")
    finally:
        db.close()
    
    print(f"\nContacts uploaded successfully: {success_count}/{len(contacts)}")
    if errors:
        print(f"Errors encountered: {len(errors)}")
        for error in errors[:5]:
            print(f"  - {error}")


def main():
    """Main upload function"""
    
    # Organization to upload to
    ORGANIZATION_SLUG = "strategic-consulting-coaching-llc-vo2w"
    
    # Load the data
    try:
        with open('companies_to_upload.json', 'r') as f:
            companies = json.load(f)
        
        with open('contacts_to_upload.json', 'r') as f:
            contacts = json.load(f)
    except FileNotFoundError:
        print("ERROR: Could not find data files. Make sure you run prepare_upload_data.py first.")
        return
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in data files: {e}")
        return
    
    # Get organization and user
    org, user = get_organization_and_user(ORGANIZATION_SLUG)
    if not org or not user:
        return
    
    print(f"\nReady to upload to:")
    print(f"- Organization: {org.name} (ID: {org.id})")
    print(f"- As user: {user.first_name} {user.last_name} ({user.email})")
    print(f"- Companies to upload: {len(companies)}")
    print(f"- Contacts to upload: {len(contacts)}")
    
    # Confirm
    confirm = input("\nProceed with upload? (yes/no): ")
    if confirm.lower() != 'yes':
        print("Upload cancelled.")
        return
    
    # Upload companies
    company_id_mapping = upload_companies_local(companies, org.id, user.id)
    
    if not company_id_mapping:
        print("\nNo companies were uploaded successfully. Skipping contact upload.")
        return
    
    # Upload contacts
    upload_contacts_local(contacts, company_id_mapping, org.id, user.id)
    
    print("\n✅ Upload process completed!")


if __name__ == "__main__":
    main()