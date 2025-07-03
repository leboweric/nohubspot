# SendGrid Email Setup

## Overview
This CRM uses SendGrid for sending emails directly from the application with a chat-like email threading interface.

## Setup Instructions

### 1. Create SendGrid Account
1. Go to [SendGrid](https://sendgrid.com) and create an account
2. Complete the account verification process

### 2. Create API Key
1. In SendGrid dashboard, go to Settings > API Keys
2. Click "Create API Key"
3. Choose "Restricted Access" and give it a name like "NoHubSpot CRM"
4. Grant the following permissions:
   - Mail Send: Full Access
   - Tracking: Read Access (optional, for email analytics)
5. Copy the generated API key

### 3. Verify Sender Identity
1. Go to Settings > Sender Authentication
2. Choose one of these options:
   - **Single Sender Verification**: Verify just one email address
   - **Domain Authentication**: Verify your entire domain (recommended for production)

### 4. Configure Environment Variables
1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Update the values in `.env.local`:
   ```env
   SENDGRID_API_KEY=your_actual_api_key_here
   SENDGRID_FROM_EMAIL=your-verified-sender@yourdomain.com
   SENDGRID_FROM_NAME=Your Company Name
   ```

### 5. Test Email Functionality
1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to a contact detail page
3. Click "Send Email" to test the functionality
4. Check SendGrid dashboard for delivery statistics

## Features

### Email Composition
- Clean modal interface for composing emails
- Pre-filled recipient information
- Subject and message validation
- Real-time sending status

### Email Threading
- Chat-like interface for email conversations
- Automatic reply subject handling
- Quick reply functionality
- Message history with timestamps

### SendGrid Integration
- Real email delivery via SendGrid
- Email tracking and analytics
- Error handling and user feedback
- Delivery status monitoring

## Production Considerations

### Domain Authentication
For production, set up domain authentication:
1. Add DNS records provided by SendGrid
2. This improves deliverability and removes "via sendgrid.net"
3. Allows using any email address from your domain

### Rate Limits
- SendGrid has rate limits based on your plan
- Free tier: 100 emails/day
- Consider upgrading for higher volume

### Error Handling
The system includes comprehensive error handling:
- Network errors
- SendGrid API errors
- Validation errors
- User-friendly error messages

### Security
- API key is stored securely in environment variables
- Input validation prevents injection attacks
- HTTPS required for production

## Troubleshooting

### Common Issues

1. **"SendGrid API key not configured"**
   - Check `.env.local` file exists
   - Verify `SENDGRID_API_KEY` is set correctly
   - Restart the development server

2. **"Unauthorized" error**
   - Verify API key has correct permissions
   - Check if API key was copied correctly

3. **"Sender not verified"**
   - Complete sender verification in SendGrid dashboard
   - Ensure `SENDGRID_FROM_EMAIL` matches verified sender

4. **Emails not being delivered**
   - Check SendGrid activity dashboard
   - Verify recipient email addresses
   - Check spam folders

### Support
- SendGrid Documentation: https://docs.sendgrid.com/
- SendGrid Support: Available through dashboard
- API Reference: https://docs.sendgrid.com/api-reference/