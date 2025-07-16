# Office 365 Integration Setup Guide

This guide will walk you through setting up Office 365 integration with NotHubSpot CRM.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step 1: Register an Application in Azure AD](#step-1-register-an-application-in-azure-ad)
3. [Step 2: Configure API Permissions](#step-2-configure-api-permissions)
4. [Step 3: Create a Client Secret](#step-3-create-a-client-secret)
5. [Step 4: Configure NotHubSpot](#step-4-configure-nothubspot)
6. [Step 5: Connect Your Office 365 Account](#step-5-connect-your-office-365-account)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

- Admin access to your Azure Active Directory
- NotHubSpot CRM organization owner privileges
- Office 365 Business or Enterprise subscription

## Step 1: Register an Application in Azure AD

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **"New registration"**
4. Fill in the application details:
   - **Name**: NotHubSpot CRM Integration
   - **Supported account types**: Choose based on your needs:
     - "Single tenant" - Only users in your organization
     - "Multitenant" - Users from any organization
   - **Redirect URI**: 
     - Platform: **Web**
     - URI: `https://your-domain.com/api/auth/microsoft/callback`
5. Click **"Register"**
6. **Save these values** from the Overview page:
   - Application (client) ID
   - Directory (tenant) ID

## Step 2: Configure API Permissions

1. In your app registration, go to **"API permissions"**
2. Click **"Add a permission"**
3. Choose **"Microsoft Graph"**
4. Select **"Delegated permissions"**
5. Add these permissions:
   - **User.Read** - Sign in and read user profile
   - **Mail.Read** - Read user mail
   - **Mail.ReadWrite** - Read and write user mail
   - **Mail.Send** - Send mail as the user
   - **Calendars.ReadWrite** - Have full access to user calendars
   - **Contacts.ReadWrite** - Have full access to user contacts
   - **offline_access** - Maintain access to data
6. Click **"Add permissions"**
7. **Important**: Click **"Grant admin consent"** if you're an admin

## Step 3: Create a Client Secret

1. Go to **"Certificates & secrets"**
2. Click **"New client secret"**
3. Add a description (e.g., "NotHubSpot Integration")
4. Choose expiration period (recommended: 24 months)
5. Click **"Add"**
6. **IMPORTANT**: Copy the secret value immediately - you won't see it again!

## Step 4: Configure NotHubSpot

### For Organization Owners:
1. Log in to NotHubSpot CRM
2. Go to **Settings**
3. Find **"Office 365 Configuration"** section
4. Click **"Configure Office 365"**
5. Enter your Azure AD details:
   - **Client ID**: The Application ID from Step 1
   - **Client Secret**: The secret from Step 3
   - **Tenant ID**: The Directory ID from Step 1
6. Configure features:
   - ✓ Calendar Sync
   - ✓ Email Sending
   - ✓ Contact Sync
7. Click **"Save Configuration"**

## Step 5: Connect Your Office 365 Account

### For All Users:
1. Go to **Settings** in NotHubSpot
2. Find **"Office 365 Integration"** section
3. Click **"Connect Office 365"**
4. You'll be redirected to Microsoft login
5. Sign in with your Office 365 account
6. Review and accept the permissions
7. You'll be redirected back to NotHubSpot

### Privacy Settings:
After connecting, configure your privacy preferences:
- **Sync only CRM contacts**: Only sync emails from existing contacts
- **Excluded domains**: Never sync emails from these domains
- **Excluded keywords**: Skip emails with these keywords in subject

## Troubleshooting

### "AADSTS50011: Reply URL mismatch" error
- Verify the redirect URI in Azure exactly matches your NotHubSpot URL
- Check for trailing slashes - they must match exactly
- Ensure you're using HTTPS in production

### "Insufficient privileges" error
- Ensure admin consent was granted for all permissions
- Check that all required permissions are added
- Try disconnecting and reconnecting

### "Invalid client secret" error
- Client secrets expire - check expiration in Azure
- Ensure no extra spaces when copying the secret
- Try creating a new client secret

### Emails not syncing
- Check privacy settings aren't too restrictive
- Verify Mail.Read permission is granted
- Check Office 365 connection status in Settings

### Calendar events missing
- Ensure Calendars.ReadWrite permission is granted
- Check that calendar sync is enabled in configuration
- Verify events exist in the sync time range

## Security Best Practices

1. **Rotate client secrets** regularly (before expiration)
2. **Limit permissions** to only what's needed
3. **Use conditional access** in Azure AD if available
4. **Monitor sign-in logs** in Azure AD
5. **Enable MFA** for all Office 365 accounts

## Common Configuration Patterns

### Single Organization Setup
- Account type: Single tenant
- Users: Only from your organization
- Best for: Internal company CRM

### Multi-Organization Setup
- Account type: Multitenant
- Users: From any Office 365 organization
- Best for: CRM used by multiple companies

### Restricted Access
- Use Azure AD groups to limit who can connect
- Configure conditional access policies
- Set up approval workflows if needed

## Support

If you encounter issues not covered in this guide:
1. Check Azure AD sign-in logs for detailed errors
2. Verify all permissions and configuration
3. Contact NotHubSpot support with:
   - Screenshot of the error
   - Your Azure AD app registration ID
   - Organization details

---

**Note**: Microsoft may update their interface. If you notice discrepancies, please notify support.