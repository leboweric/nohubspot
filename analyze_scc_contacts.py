#!/usr/bin/env python3
import pandas as pd
import re

# Read the Excel file
file_path = '/Users/ericlebow/Library/CloudStorage/OneDrive-PBN/Software Projects/nohubspot/cleaned_customer_list.xlsx'

# Target users to match
target_users = {
    'Cheryl Jensen': 'cjensen@strategic-cc.com',
    'Renae Oswald-Anderson': 'roanderson@strategic-cc.com', 
    'Imogen Davis': 'idavis@strategic-cc.com',
    'Christopher Taykalo': 'ctaykalo@strategic-cc.com',
    'Susan Marschalk': 'smarschalk@strategic-cc.com'
}

# Alternative name patterns to match
name_patterns = {
    'Cheryl Jensen': ['cheryl', 'jensen'],
    'Renae Oswald-Anderson': ['renae', 'oswald', 'anderson'],
    'Imogen Davis': ['imogen', 'davis'],
    'Christopher Taykalo': ['christopher', 'chris', 'taykalo'],
    'Susan Marschalk': ['susan', 'marschalk']
}

try:
    # Read the Excel file
    df = pd.read_excel(file_path)
    
    print("=== SCC Contact Analysis ===")
    print(f"Total organizations: {len(df)}")
    print(f"Organizations with Primary SCC Contact: {df['Primary SCC Contact'].notna().sum()}")
    print()
    
    # Get all unique SCC contacts (non-null)
    scc_contacts = df['Primary SCC Contact'].dropna().unique()
    print(f"=== All Unique Primary SCC Contacts ({len(scc_contacts)}) ===")
    for contact in sorted(scc_contacts):
        print(f"- {contact}")
    print()
    
    # Dictionary to store assignments
    assignments = {}
    unmatched_organizations = []
    
    # Analyze each organization
    for idx, row in df.iterrows():
        org_name = row['Organization Name']
        scc_contact = row['Primary SCC Contact']
        
        if pd.isna(scc_contact):
            unmatched_organizations.append(org_name)
            continue
            
        scc_contact_lower = str(scc_contact).lower()
        matched = False
        
        # Check for exact name matches or pattern matches
        for user_name, email in target_users.items():
            patterns = name_patterns[user_name]
            
            # Check if any of the name patterns appear in the SCC contact
            if any(pattern.lower() in scc_contact_lower for pattern in patterns):
                if user_name not in assignments:
                    assignments[user_name] = []
                assignments[user_name].append({
                    'organization': org_name,
                    'scc_contact': scc_contact,
                    'email': row.get('Primary Email Contact', 'N/A')
                })
                matched = True
                break
        
        if not matched:
            # Add to unmatched list with the SCC contact for manual review
            unmatched_organizations.append(f"{org_name} (SCC: {scc_contact})")
    
    # Display results
    print("=== ASSIGNMENT RECOMMENDATIONS ===")
    print()
    
    for user_name, email in target_users.items():
        print(f"👤 {user_name} ({email})")
        if user_name in assignments:
            print(f"   Assigned Organizations: {len(assignments[user_name])}")
            for org in assignments[user_name]:
                print(f"   • {org['organization']}")
                print(f"     SCC Contact: {org['scc_contact']}")
                print(f"     Email: {org['email']}")
                print()
        else:
            print("   No organizations assigned")
            print()
    
    # Summary statistics
    total_assigned = sum(len(orgs) for orgs in assignments.values())
    print("=== SUMMARY ===")
    print(f"Total organizations: {len(df)}")
    print(f"Organizations with SCC contacts: {df['Primary SCC Contact'].notna().sum()}")
    print(f"Organizations assigned to target users: {total_assigned}")
    print(f"Organizations without SCC contacts: {df['Primary SCC Contact'].isna().sum()}")
    print()
    
    # Show organizations that couldn't be matched to target users
    unmatched_with_contacts = [org for org in unmatched_organizations if 'SCC:' in org]
    if unmatched_with_contacts:
        print(f"=== ORGANIZATIONS WITH SCC CONTACTS NOT MATCHED TO TARGET USERS ({len(unmatched_with_contacts)}) ===")
        for org in unmatched_with_contacts:
            print(f"- {org}")
        print()
    
    # Save results to a text file
    with open('scc_contact_assignments.txt', 'w') as f:
        f.write("SCC CONTACT ASSIGNMENT REPORT\n")
        f.write("=" * 50 + "\n\n")
        
        for user_name, email in target_users.items():
            f.write(f"{user_name} ({email})\n")
            f.write("-" * 50 + "\n")
            if user_name in assignments:
                for org in assignments[user_name]:
                    f.write(f"• {org['organization']}\n")
                    f.write(f"  SCC Contact: {org['scc_contact']}\n")
                    f.write(f"  Email: {org['email']}\n\n")
            else:
                f.write("No organizations assigned\n\n")
        
        f.write("\nUNMATCHED ORGANIZATIONS WITH SCC CONTACTS:\n")
        f.write("-" * 50 + "\n")
        for org in unmatched_with_contacts:
            f.write(f"• {org}\n")
    
    print("Results saved to 'scc_contact_assignments.txt'")

except Exception as e:
    print(f"Error: {e}")