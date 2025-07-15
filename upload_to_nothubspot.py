import json
import requests
import time
from typing import Dict, List, Any

# Configuration
API_BASE_URL = "https://nothubspot.app/api"
# You'll need to provide your access token
ACCESS_TOKEN = ""  # Replace with your actual access token

# Organization details
ORGANIZATION_SLUG = "strategic-consulting-coaching-llc-vo2w"

def upload_companies(companies: List[Dict[str, Any]], token: str) -> Dict[int, int]:
    """
    Upload companies to NotHubSpot.
    Returns a mapping of temporary IDs to actual created IDs.
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    id_mapping = {}
    errors = []
    
    print(f"\nUploading {len(companies)} companies...")
    
    for i, company in enumerate(companies):
        # Remove temporary id from company data
        temp_id = company.pop('id')
        
        # Prepare company data for API
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
        
        # Remove None values
        company_data = {k: v for k, v in company_data.items() if v is not None}
        
        try:
            response = requests.post(
                f"{API_BASE_URL}/companies",
                headers=headers,
                json=company_data
            )
            
            if response.status_code == 200:
                created_company = response.json()
                id_mapping[temp_id] = created_company['id']
                print(f"✓ Created company {i+1}/{len(companies)}: {company['name']}")
            else:
                error_msg = f"Failed to create company '{company['name']}': {response.status_code} - {response.text}"
                errors.append(error_msg)
                print(f"✗ {error_msg}")
                
        except Exception as e:
            error_msg = f"Error creating company '{company['name']}': {str(e)}"
            errors.append(error_msg)
            print(f"✗ {error_msg}")
        
        # Add a small delay to avoid overwhelming the API
        if i % 10 == 0 and i > 0:
            time.sleep(1)
    
    print(f"\nCompanies uploaded successfully: {len(id_mapping)}/{len(companies)}")
    if errors:
        print(f"Errors encountered: {len(errors)}")
        for error in errors[:5]:  # Show first 5 errors
            print(f"  - {error}")
    
    return id_mapping


def upload_contacts(contacts: List[Dict[str, Any]], company_id_mapping: Dict[int, int], token: str):
    """
    Upload contacts to NotHubSpot using the company ID mapping.
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    success_count = 0
    errors = []
    
    print(f"\nUploading {len(contacts)} contacts...")
    
    for i, contact in enumerate(contacts):
        # Get the actual company ID from mapping
        temp_company_id = contact.get('company_id')
        actual_company_id = company_id_mapping.get(temp_company_id) if temp_company_id else None
        
        # Skip if we couldn't map the company
        if temp_company_id and not actual_company_id:
            errors.append(f"Skipping contact '{contact['first_name']} {contact['last_name']}' - company not found in mapping")
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
                print(f"✓ Created contact {i+1}/{len(contacts)}: {contact['first_name']} {contact['last_name']}")
            else:
                error_msg = f"Failed to create contact '{contact['first_name']} {contact['last_name']}': {response.status_code} - {response.text}"
                errors.append(error_msg)
                print(f"✗ {error_msg}")
                
        except Exception as e:
            error_msg = f"Error creating contact '{contact['first_name']} {contact['last_name']}': {str(e)}"
            errors.append(error_msg)
            print(f"✗ {error_msg}")
        
        # Add a small delay to avoid overwhelming the API
        if i % 10 == 0 and i > 0:
            time.sleep(1)
    
    print(f"\nContacts uploaded successfully: {success_count}/{len(contacts)}")
    if errors:
        print(f"Errors encountered: {len(errors)}")
        for error in errors[:5]:  # Show first 5 errors
            print(f"  - {error}")


def main():
    """Main upload function"""
    
    if not ACCESS_TOKEN:
        print("ERROR: Please set your ACCESS_TOKEN in the script")
        print("\nTo get your access token:")
        print("1. Log into NotHubSpot")
        print("2. Open Developer Tools (F12)")
        print("3. Go to Network tab")
        print("4. Make any API request (e.g., refresh the page)")
        print("5. Look for the Authorization header in any API request")
        print("6. Copy the token after 'Bearer '")
        return
    
    # Load the data
    try:
        with open('companies_to_upload.json', 'r') as f:
            companies = json.load(f)
        
        with open('contacts_to_upload.json', 'r') as f:
            contacts = json.load(f)
    except FileNotFoundError as e:
        print(f"ERROR: Could not find data files. Make sure you run prepare_upload_data.py first.")
        return
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in data files: {e}")
        return
    
    print(f"Ready to upload:")
    print(f"- {len(companies)} companies")
    print(f"- {len(contacts)} contacts")
    print(f"- To organization: {ORGANIZATION_SLUG}")
    print(f"\nAPI Base URL: {API_BASE_URL}")
    
    # Confirm before proceeding
    confirm = input("\nProceed with upload? (yes/no): ")
    if confirm.lower() != 'yes':
        print("Upload cancelled.")
        return
    
    # Upload companies first
    company_id_mapping = upload_companies(companies, ACCESS_TOKEN)
    
    if not company_id_mapping:
        print("\nNo companies were uploaded successfully. Skipping contact upload.")
        return
    
    # Upload contacts with mapped company IDs
    upload_contacts(contacts, company_id_mapping, ACCESS_TOKEN)
    
    print("\n✅ Upload process completed!")
    print(f"Successfully uploaded {len(company_id_mapping)} companies")


if __name__ == "__main__":
    main()