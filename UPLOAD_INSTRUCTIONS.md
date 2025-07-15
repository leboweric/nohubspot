# Data Upload Instructions for Strategic Consulting & Coaching

## Overview
I've prepared your customer data from `cleaned_customer_list.xlsx` for upload to NotHubSpot. The data includes:
- **167 companies** with addresses and notes
- **182 contacts** with email addresses

## Files Created
1. `companies_to_upload.json` - All company data ready for import
2. `contacts_to_upload.json` - All contact data linked to companies
3. `upload_via_api.py` - Script to upload data via NotHubSpot API

## How to Upload the Data

### Step 1: Get Your Access Token
1. Log into NotHubSpot at https://nothubspot.app
2. Open Chrome DevTools (F12 or right-click → Inspect)
3. Go to the 'Network' tab
4. Refresh the page or navigate to any page
5. Look for any API request (e.g., /api/companies)
6. Click on the request and go to 'Headers' tab
7. Find 'Authorization: Bearer YOUR_TOKEN_HERE'
8. Copy everything after 'Bearer ' (the token)

### Step 2: Run the Upload Script
```bash
python3 upload_via_api.py
```

The script will:
1. Ask for your access token
2. Verify you're logged into the correct organization
3. Show a summary of data to upload
4. Upload companies first, then contacts
5. Display progress and any errors

## Data Mapping
The Excel columns were mapped as follows:
- **Company Fields:**
  - Organization Name → name
  - Address → street_address
  - City → city
  - State → state
  - Zip → postal_code
  - Website → website
  - Notes → description

- **Contact Fields:**
  - Primary Organization Contact(s) → first_name, last_name
  - Primary Email Contact → email
  - Linked to respective company

## Notes
- 19 companies don't have associated contacts
- Some contacts have multiple names separated by commas/semicolons - these were split into separate contacts
- All companies are set to 'Active' status
- The upload includes rate limiting to avoid overwhelming the API

## After Upload
1. Verify the data in NotHubSpot
2. Check for any failed uploads in the script output
3. Manually review and update any missing information
4. Consider assigning Primary Account Owners to the uploaded companies