# Database Migrations

This folder contains database migration scripts for NotHubSpot CRM.

## Email Tracking Migration

To add email tracking functionality to your database, run:

```bash
cd backend/migrations
python3 add_email_tracking.py
```

This migration:
- ✅ **Safe to run multiple times** - checks if tables exist before creating
- ✅ **Works on existing databases** - only adds new tables, doesn't modify existing ones
- ✅ **Works on new databases** - creates tables if they don't exist

## What This Adds

- `email_tracking` table: Stores email sending records and engagement metrics
- `email_events` table: Stores individual email events (opens, clicks, etc.)

## Required For

- **Existing customers**: Must run to get email tracking functionality
- **New customers**: Optional (tables are created automatically in new installations)

## Post-Migration Setup

1. Configure SendGrid webhook in your SendGrid account:
   - Go to Settings → Mail Settings → Event Webhook
   - Set URL to: `https://your-domain.com/api/webhooks/sendgrid`
   - Enable events: Opened, Clicked, Bounced, Spam Reports

2. Restart your backend server to load the new API endpoints