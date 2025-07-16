# Google Workspace Integration Setup Guide

This guide will walk you through setting up Google Workspace integration with NotHubSpot CRM.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step 1: Create a Google Cloud Project](#step-1-create-a-google-cloud-project)
3. [Step 2: Enable Required APIs](#step-2-enable-required-apis)
4. [Step 3: Configure OAuth Consent Screen](#step-3-configure-oauth-consent-screen)
5. [Step 4: Create OAuth 2.0 Credentials](#step-4-create-oauth-20-credentials)
6. [Step 5: Set Environment Variables](#step-5-set-environment-variables)
7. [Step 6: Connect Your Google Account](#step-6-connect-your-google-account)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

- Admin access to your Google Workspace domain
- Access to Google Cloud Console
- NotHubSpot CRM admin privileges

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top of the page
3. Click "New Project"
4. Enter a project name (e.g., "NotHubSpot CRM Integration")
5. Click "Create"

## Step 2: Enable Required APIs

1. In your Google Cloud Project, go to "APIs & Services" > "Library"
2. Search for and enable these APIs:
   - **Gmail API** - For email sync
   - **Google Calendar API** - For calendar integration (future feature)
   - **Google People API** - For contacts sync (future feature)
   - **Google Drive API** - For document management (future feature)

Click on each API and press the "Enable" button.

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose user type:
   - **Internal** - If you only want users in your Google Workspace to use this
   - **External** - If you want any Google account to connect
3. Click "Create"
4. Fill in the required information:
   - **App name**: NotHubSpot CRM
   - **User support email**: Your support email
   - **App logo**: Optional
   - **Application home page**: Your NotHubSpot URL
   - **Authorized domains**: Add your domain (e.g., `yourdomain.com`)
   - **Developer contact information**: Your email
5. Click "Save and Continue"
6. Add scopes:
   - Click "Add or Remove Scopes"
   - Select these scopes:
     - `openid`
     - `email`
     - `profile`
     - `.../auth/gmail.readonly`
     - `.../auth/gmail.send`
     - `.../auth/calendar.readonly`
     - `.../auth/contacts.readonly`
   - Click "Update"
7. Click "Save and Continue"
8. Add test users (if External app type):
   - Add email addresses of users who can test during development
9. Review and click "Back to Dashboard"

## Step 4: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Web application" as the application type
4. Fill in:
   - **Name**: NotHubSpot CRM Web Client
   - **Authorized JavaScript origins**: 
     - `https://your-nothubspot-domain.com`
     - `http://localhost:3000` (for development)
   - **Authorized redirect URIs**:
     - `https://your-nothubspot-domain.com/auth/google/callback`
     - `http://localhost:3000/auth/google/callback` (for development)
5. Click "Create"
6. **IMPORTANT**: Save the Client ID and Client Secret

## Step 5: Set Environment Variables

Add these to your NotHubSpot environment variables:

```bash
# Google OAuth Settings
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=https://your-domain.com/auth/google/callback

# Optional: Set default project ID
GOOGLE_PROJECT_ID=your-project-id
```

For Railway deployment, add these in your Railway project settings under "Variables".

## Step 6: Connect Your Google Account

### For Organization Admins:
1. Log in to NotHubSpot CRM
2. Go to Settings
3. Find the "Google Workspace Integration" section
4. Click "Connect Google Workspace"
5. You'll be redirected to Google to authorize the connection
6. Grant the requested permissions
7. You'll be redirected back to NotHubSpot with your account connected

### Privacy Settings:
After connecting, you can configure:
- **Sync only CRM contacts**: Only sync emails from/to existing CRM contacts
- **Excluded domains**: Domains to never sync (e.g., personal emails)
- **Excluded keywords**: Email subjects containing these keywords won't sync

## Troubleshooting

### "Access blocked" error
- Make sure your OAuth consent screen is properly configured
- If using "External" type, ensure the user is added as a test user
- Verify all required APIs are enabled

### "Invalid redirect URI" error
- Double-check the redirect URI in Google Cloud Console matches exactly
- Include both http://localhost and your production URL during development
- Ensure no trailing slashes in the URIs

### "Insufficient permissions" error
- Verify all required scopes are added in OAuth consent screen
- User may need to disconnect and reconnect to grant new permissions

### Connection successful but no emails syncing
- Check privacy settings - you may have restrictive filters
- Ensure you have emails in your Gmail account
- Check the sync status in Settings for any error messages

## Security Best Practices

1. **Never share your Client Secret** - Keep it secure and encrypted
2. **Use environment variables** - Don't hardcode credentials
3. **Limit scopes** - Only request permissions you actually use
4. **Regular audits** - Review connected accounts periodically
5. **Secure your Google Cloud Project** - Use 2FA and limit admin access

## Support

If you encounter issues not covered in this guide:
1. Check the application logs for detailed error messages
2. Contact NotHubSpot support with:
   - Screenshot of the error
   - Steps to reproduce
   - Your organization ID

---

**Note**: Google may update their interface. If you notice discrepancies in this guide, please notify support.