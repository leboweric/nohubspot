#!/usr/bin/env python3
"""
Upload companies and contacts to NotHubSpot via API
Run this script after logging into NotHubSpot in your browser
"""

import json
import time
import requests
from typing import Dict, List, Any

# Configuration - Update these values
API_BASE_URL = "https://nothubspot.app/api"  # Change to http://localhost:8000/api if testing locally

def get_auth_instructions():
    """Print instructions for getting auth token"""
    print("\n" + "="*60)
    print("HOW TO GET YOUR ACCESS TOKEN:")
    print("="*60)
    print("1. Log into NotHubSpot at https://nothubspot.app")
    print("2. Open Chrome DevTools (F12 or right-click → Inspect)")
    print("3. Go to the 'Network' tab")
    print("4. Refresh the page or navigate to any page")
    print("5. Look for any API request (e.g., /api/companies)")
    print("6. Click on the request and go to 'Headers' tab")
    print("7. Find 'Authorization: Bearer YOUR_TOKEN_HERE'")
    print("8. Copy everything after 'Bearer ' (the token)")
    print("="*60 + "\n")


def test_auth(token: str) -> bool:
    """Test if the authentication token works"""
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(f"{API_BASE_URL}/users/me", headers=headers)
        if response.status_code == 200:
            user = response.json()
            print(f"\n✅ Authentication successful!")
            print(f"Logged in as: {user['first_name']} {user['last_name']} ({user['email']})")
            print(f"Organization: {user['organization']['name']}")
            return True
        else:
            print(f"\n❌ Authentication failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"\n❌ Error testing authentication: {str(e)}")
        return False


def upload_companies(companies: List[Dict[str, Any]], token: str) -> Dict[int, int]:
    """Upload companies to NotHubSpot"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    id_mapping = {}
    errors = []
    
    print(f"\n📤 Uploading {len(companies)} companies...")
    
    for i, company in enumerate(companies):
        # Remove temporary id
        temp_id = company.pop('id', None)
        
        # Clean up data
        company_data = {
            "name": company['name'],
            "street_address": company.get('street_address', ''),
            "city": company.get('city', ''),
            "state": company.get('state', ''),
            "postal_code": company.get('postal_code', ''),
            "website": company.get('website', ''),
            "description": company.get('description', ''),
            "status": company.get('status', 'Active')
        }
        
        # Remove None/empty values
        company_data = {k: v for k, v in company_data.items() if v}
        
        try:
            response = requests.post(
                f"{API_BASE_URL}/companies",
                headers=headers,
                json=company_data
            )
            
            if response.status_code == 200:
                created_company = response.json()
                if temp_id:
                    id_mapping[temp_id] = created_company['id']
                print(f"  ✓ {i+1}/{len(companies)}: {company['name']}")
            else:
                error_msg = f"{company['name']}: {response.status_code} - {response.text[:100]}"
                errors.append(error_msg)
                print(f"  ✗ {i+1}/{len(companies)}: {error_msg}")
                
        except Exception as e:
            error_msg = f"{company['name']}: {str(e)}"
            errors.append(error_msg)
            print(f"  ✗ {i+1}/{len(companies)}: {error_msg}")
        
        # Rate limiting
        if i > 0 and i % 10 == 0:
            time.sleep(1)
    
    print(f"\n📊 Companies Summary:")
    print(f"  - Successfully uploaded: {len(id_mapping)}/{len(companies)}")
    if errors:
        print(f"  - Errors: {len(errors)}")
        for error in errors[:3]:
            print(f"    • {error}")
    
    return id_mapping


def upload_contacts(contacts: List[Dict[str, Any]], company_id_mapping: Dict[int, int], token: str):
    """Upload contacts to NotHubSpot"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    success_count = 0
    errors = []
    skipped = 0
    
    print(f"\n📤 Uploading {len(contacts)} contacts...")
    
    for i, contact in enumerate(contacts):
        # Map company ID
        temp_company_id = contact.get('company_id')
        actual_company_id = company_id_mapping.get(temp_company_id) if temp_company_id else None
        
        # Skip if company wasn't uploaded
        if temp_company_id and not actual_company_id:
            skipped += 1
            continue
        
        # Prepare contact data
        contact_data = {
            "first_name": contact.get('first_name', ''),
            "last_name": contact.get('last_name', ''),
            "email": contact.get('email', ''),
            "company_id": actual_company_id
        }
        
        # Remove empty values
        contact_data = {k: v for k, v in contact_data.items() if v}
        
        try:
            response = requests.post(
                f"{API_BASE_URL}/contacts",
                headers=headers,
                json=contact_data
            )
            
            if response.status_code == 200:
                success_count += 1
                print(f"  ✓ {i+1}/{len(contacts)}: {contact['first_name']} {contact['last_name']}")
            else:
                error_msg = f"{contact['first_name']} {contact['last_name']}: {response.status_code}"
                errors.append(error_msg)
                print(f"  ✗ {i+1}/{len(contacts)}: {error_msg}")
                
        except Exception as e:
            error_msg = f"{contact['first_name']} {contact['last_name']}: {str(e)}"
            errors.append(error_msg)
            print(f"  ✗ {i+1}/{len(contacts)}: {error_msg}")
        
        # Rate limiting
        if i > 0 and i % 10 == 0:
            time.sleep(1)
    
    print(f"\n📊 Contacts Summary:")
    print(f"  - Successfully uploaded: {success_count}/{len(contacts)}")
    if skipped:
        print(f"  - Skipped (no company): {skipped}")
    if errors:
        print(f"  - Errors: {len(errors)}")
        for error in errors[:3]:
            print(f"    • {error}")


def main():
    """Main upload function"""
    
    # Load data files
    try:
        with open('companies_to_upload.json', 'r') as f:
            companies = json.load(f)
        
        with open('contacts_to_upload.json', 'r') as f:
            contacts = json.load(f)
    except FileNotFoundError:
        print("❌ ERROR: Could not find data files.")
        print("Make sure you run prepare_upload_data.py first!")
        return
    except json.JSONDecodeError as e:
        print(f"❌ ERROR: Invalid JSON in data files: {e}")
        return
    
    print("\n🎯 NotHubSpot Data Upload Tool")
    print(f"\nData ready to upload:")
    print(f"  - Companies: {len(companies)}")
    print(f"  - Contacts: {len(contacts)}")
    
    # Get auth token
    get_auth_instructions()
    
    token = input("Enter your access token: ").strip()
    
    if not token:
        print("❌ No token provided. Exiting.")
        return
    
    # Test authentication
    if not test_auth(token):
        print("\nPlease check your token and try again.")
        return
    
    # Confirm upload
    print(f"\n⚠️  Ready to upload {len(companies)} companies and {len(contacts)} contacts")
    confirm = input("\nProceed with upload? (yes/no): ")
    
    if confirm.lower() != 'yes':
        print("Upload cancelled.")
        return
    
    # Upload companies
    start_time = time.time()
    company_id_mapping = upload_companies(companies, token)
    
    if not company_id_mapping:
        print("\n⚠️  No companies were uploaded. Skipping contacts.")
        return
    
    # Upload contacts
    upload_contacts(contacts, company_id_mapping, token)
    
    # Summary
    elapsed = time.time() - start_time
    print(f"\n✅ Upload completed in {elapsed:.1f} seconds!")
    print(f"\nNext steps:")
    print("1. Go to NotHubSpot and verify the uploaded data")
    print("2. Check any companies/contacts that failed to upload")
    print("3. Manually add any missing information")


if __name__ == "__main__":
    main()