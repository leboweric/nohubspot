"""
Email templates for NotHubSpot CRM
"""

def get_welcome_email_html(first_name: str, organization_name: str) -> str:
    """Generate welcome email HTML content"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to NotHubSpot</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f5f5f5;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }}
            .header {{
                background-color: #2563eb;
                color: white;
                padding: 30px;
                text-align: center;
            }}
            .header h1 {{
                margin: 0;
                font-size: 28px;
                font-weight: 600;
            }}
            .content {{
                padding: 40px 30px;
            }}
            .button {{
                display: inline-block;
                background-color: #2563eb;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 500;
                margin: 20px 0;
            }}
            .feature-list {{
                background-color: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
            }}
            .feature-list ul {{
                margin: 10px 0;
                padding-left: 20px;
            }}
            .feature-list li {{
                margin: 8px 0;
            }}
            .footer {{
                background-color: #f8f9fa;
                padding: 30px;
                text-align: center;
                font-size: 14px;
                color: #666;
            }}
            .footer a {{
                color: #2563eb;
                text-decoration: none;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome to NotHubSpot! 🎉</h1>
            </div>
            
            <div class="content">
                <h2>Hi {first_name},</h2>
                
                <p>Congratulations on creating your <strong>{organization_name}</strong> account! We're excited to have you on board.</p>
                
                <p>NotHubSpot is your all-in-one CRM solution designed to help you manage your business relationships effectively. Here's what you can do:</p>
                
                <div class="feature-list">
                    <ul>
                        <li><strong>Manage Companies:</strong> Keep track of all your business relationships</li>
                        <li><strong>Organize Contacts:</strong> Store and manage contact information</li>
                        <li><strong>Track Tasks:</strong> Never miss a follow-up with our task management</li>
                        <li><strong>Send Emails:</strong> Communicate directly from the platform</li>
                        <li><strong>Invite Team Members:</strong> Collaborate with your team</li>
                    </ul>
                </div>
                
                <p>Ready to get started?</p>
                
                <center>
                    <a href="https://nothubspot.app/dashboard" class="button">Go to Your Dashboard</a>
                </center>
                
                <h3>Quick Start Tips:</h3>
                <ol>
                    <li><strong>Add your first company:</strong> Click "Add New Company" from your dashboard</li>
                    <li><strong>Import contacts:</strong> Use our bulk upload feature to import existing contacts</li>
                    <li><strong>Invite your team:</strong> Go to Settings → Team Members to invite colleagues</li>
                </ol>
                
                <p>If you have any questions or need assistance, we're here to help!</p>
                
                <p>Best regards,<br>
                The NotHubSpot Team</p>
            </div>
            
            <div class="footer">
                <p>This email was sent to you because you signed up for NotHubSpot.</p>
                <p>&copy; 2024 NotHubSpot. All rights reserved.</p>
                <p>
                    <a href="https://nothubspot.app">Visit our website</a> | 
                    <a href="https://nothubspot.app/settings">Manage settings</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    """

def get_welcome_email_text(first_name: str, organization_name: str) -> str:
    """Generate welcome email plain text content"""
    return f"""
Welcome to NotHubSpot!

Hi {first_name},

Congratulations on creating your {organization_name} account! We're excited to have you on board.

NotHubSpot is your all-in-one CRM solution designed to help you manage your business relationships effectively. Here's what you can do:

• Manage Companies: Keep track of all your business relationships
• Organize Contacts: Store and manage contact information
• Track Tasks: Never miss a follow-up with our task management
• Send Emails: Communicate directly from the platform
• Invite Team Members: Collaborate with your team

Ready to get started? Visit your dashboard at: https://nothubspot.app/dashboard

Quick Start Tips:
1. Add your first company: Click "Add New Company" from your dashboard
2. Import contacts: Use our bulk upload feature to import existing contacts
3. Invite your team: Go to Settings → Team Members to invite colleagues

If you have any questions or need assistance, we're here to help!

Best regards,
The NotHubSpot Team

---
This email was sent to you because you signed up for NotHubSpot.
© 2024 NotHubSpot. All rights reserved.
"""