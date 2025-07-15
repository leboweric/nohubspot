import pandas as pd
import json
import re

# Read the Excel file
file_path = '/Users/ericlebow/Library/CloudStorage/OneDrive-PBN/Software Projects/nohubspot/cleaned_customer_list.xlsx'
df = pd.read_excel(file_path, sheet_name=0)

# Clean up the data
def clean_string(value):
    """Clean string values"""
    if pd.isna(value):
        return None
    return str(value).strip()

def parse_contacts(contact_str, email_str):
    """Parse contact names and email"""
    contacts = []
    
    if pd.notna(contact_str) and str(contact_str).strip():
        # Split by common delimiters
        contact_names = re.split(r'[,;&]|and', str(contact_str))
        
        for name in contact_names:
            name = name.strip()
            if name and not name.isdigit():  # Skip if it's just a number
                # Try to split into first and last name
                parts = name.split()
                if len(parts) >= 2:
                    first_name = parts[0]
                    last_name = ' '.join(parts[1:])
                else:
                    first_name = name
                    last_name = ''
                
                contact = {
                    'first_name': first_name,
                    'last_name': last_name,
                    'email': clean_string(email_str) if pd.notna(email_str) else None
                }
                contacts.append(contact)
    
    return contacts

# Prepare companies and contacts
companies = []
all_contacts = []
company_id_counter = 1

for idx, row in df.iterrows():
    # Skip rows without organization name
    if pd.isna(row['Organization Name']):
        continue
    
    # Prepare company data
    company = {
        'id': company_id_counter,  # Temporary ID for linking contacts
        'name': clean_string(row['Organization Name']),
        'street_address': clean_string(row['Address']),
        'city': clean_string(row['City ']),  # Note: Column has trailing space
        'state': clean_string(row['State']),
        'postal_code': str(int(row['Zip'])) if pd.notna(row['Zip']) else None,
        'website': clean_string(row['Website']) if pd.notna(row['Website']) and str(row['Website']) != '0' else None,
        'description': clean_string(row['Notes']),
        'status': 'Active'
    }
    
    # Clean up state abbreviation
    if company['state']:
        company['state'] = company['state'].strip().upper()
    
    companies.append(company)
    
    # Parse contacts
    contacts = parse_contacts(row['Primary Organization Contact(s)'], row['Primary Email Contact'])
    
    # Add company_id to each contact
    for contact in contacts:
        contact['company_id'] = company_id_counter
        contact['company_name'] = company['name']
        all_contacts.append(contact)
    
    company_id_counter += 1

# Print summary
print(f"\nSummary:")
print(f"Total companies to upload: {len(companies)}")
print(f"Total contacts to upload: {len(all_contacts)}")

# Show sample data
print(f"\nSample company:")
if companies:
    print(json.dumps(companies[0], indent=2))

print(f"\nSample contacts:")
if all_contacts:
    for contact in all_contacts[:3]:
        print(json.dumps(contact, indent=2))

# Save to JSON files for upload
with open('companies_to_upload.json', 'w') as f:
    json.dump(companies, f, indent=2)

with open('contacts_to_upload.json', 'w') as f:
    json.dump(all_contacts, f, indent=2)

print(f"\nData saved to:")
print("- companies_to_upload.json")
print("- contacts_to_upload.json")

# Show companies with no contacts
companies_with_contacts = set(c['company_id'] for c in all_contacts)
companies_without_contacts = [c for c in companies if c['id'] not in companies_with_contacts]
print(f"\nCompanies without contacts: {len(companies_without_contacts)}")
if companies_without_contacts[:5]:
    print("First 5:")
    for c in companies_without_contacts[:5]:
        print(f"  - {c['name']}")