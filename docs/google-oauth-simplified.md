# Simplified Google OAuth Integration

## Overview

NotHubSpot now uses a centralized Google OAuth approach, similar to how Zapier handles Google integrations. Users simply click "Connect Google Workspace" without needing to create their own Google Cloud Project.

## For Server Administrators

### Initial Setup (One-time)

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project for NotHubSpot

2. **Enable Required APIs**
   - Gmail API
   - Google Calendar API
   - Google People API
   - Google Drive API (optional)

3. **Configure OAuth Consent Screen**
   - Choose "External" for user type
   - Fill in app information
   - Add required scopes:
     - openid
     - email
     - profile
     - https://www.googleapis.com/auth/gmail.readonly
     - https://www.googleapis.com/auth/gmail.send
     - https://www.googleapis.com/auth/calendar.readonly
     - https://www.googleapis.com/auth/contacts.readonly

4. **Create OAuth 2.0 Credentials**
   - Go to Credentials → Create Credentials → OAuth client ID
   - Choose "Web application"
   - Add authorized redirect URI: `https://yourdomain.com/api/auth/google/callback`
   - Save the Client ID and Client Secret

5. **Configure Environment Variables**
   ```bash
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
   ```

## For End Users

### Connecting Google Workspace

1. Go to Settings → Google Workspace Integration
2. Click "Connect Google Workspace"
3. Sign in with your Google account
4. Authorize the requested permissions
5. You're connected!

### What This Enables

- **Automatic Gmail Threading**: All sent and received emails are automatically synced
- **Send via Gmail**: Emails sent from NotHubSpot appear in your Gmail sent folder
- **Email History**: Full conversation history for each contact
- **Calendar Sync** (coming soon)
- **Contact Import** (coming soon)

### Privacy & Security

- Your Google credentials are encrypted and stored securely
- You can disconnect at any time from Settings
- Only emails from/to CRM contacts are synced (configurable)
- You can exclude specific domains or keywords from syncing

## Migration from Organization-Level Config

If you previously had organization-level Google configurations:

1. The old configuration is no longer used
2. Each user needs to reconnect their Google account individually
3. The `google_organization_configs` table is deprecated but kept for rollback

## Troubleshooting

### "Google Workspace integration is not configured"
- Server admin needs to set up Google OAuth credentials in environment variables

### "Failed to connect Google Workspace"
- Check that redirect URI matches exactly in Google Console and environment variables
- Ensure all required APIs are enabled in Google Cloud Console

### Token refresh errors
- User may need to reconnect their Google account
- Check that refresh token is being properly stored