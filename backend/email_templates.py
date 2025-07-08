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

def get_password_reset_email_html(first_name: str, reset_url: str) -> str:
    """Generate password reset email HTML content"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - NotHubSpot</title>
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
                background-color: #dc2626;
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
                background-color: #dc2626;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 500;
                margin: 20px 0;
            }}
            .warning-box {{
                background-color: #fef2f2;
                border-left: 4px solid #dc2626;
                padding: 15px 20px;
                margin: 20px 0;
                border-radius: 4px;
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
                <h1>🔒 Password Reset Request</h1>
            </div>
            
            <div class="content">
                <h2>Hi {first_name},</h2>
                
                <p>We received a request to reset your password for your NotHubSpot account. If you made this request, click the button below to set a new password.</p>
                
                <center>
                    <a href="{reset_url}" class="button">Reset My Password</a>
                </center>
                
                <div class="warning-box">
                    <strong>⚠️ Important Security Information:</strong>
                    <ul style="margin: 10px 0;">
                        <li>This link will expire in <strong>1 hour</strong></li>
                        <li>For security reasons, you can only use this link once</li>
                        <li>If you didn't request this reset, please ignore this email</li>
                    </ul>
                </div>
                
                <p>If you can't click the button above, you can copy and paste this link into your browser:</p>
                <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace;">
                    {reset_url}
                </p>
                
                <h3>Didn't request this?</h3>
                <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged, and no further action is required.</p>
                
                <p>For security questions or concerns, please contact our support team.</p>
                
                <p>Best regards,<br>
                The NotHubSpot Security Team</p>
            </div>
            
            <div class="footer">
                <p>This email was sent because a password reset was requested for your NotHubSpot account.</p>
                <p>&copy; 2024 NotHubSpot. All rights reserved.</p>
                <p>
                    <a href="https://nothubspot.app">Visit our website</a> | 
                    <a href="https://nothubspot.app/support">Contact Support</a>
                </p>
            </div>
        </div>
    </body>
    </html>
    """

def get_password_reset_email_text(first_name: str, reset_url: str) -> str:
    """Generate password reset email plain text content"""
    return f"""
Password Reset Request - NotHubSpot

Hi {first_name},

We received a request to reset your password for your NotHubSpot account. If you made this request, click the link below to set a new password.

Reset your password: {reset_url}

IMPORTANT SECURITY INFORMATION:
• This link will expire in 1 hour
• For security reasons, you can only use this link once
• If you didn't request this reset, please ignore this email

Didn't request this?
If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged, and no further action is required.

For security questions or concerns, please contact our support team.

Best regards,
The NotHubSpot Security Team

---
This email was sent because a password reset was requested for your NotHubSpot account.
© 2024 NotHubSpot. All rights reserved.
"""

def get_invite_email_html(organization_name: str, inviter_name: str, invite_url: str, role: str) -> str:
    """Generate invitation email HTML content"""
    role_display = "Administrator" if role == "admin" else "Team Member"
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invitation to Join {organization_name}</title>
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
            .info-box {{
                background-color: #eff6ff;
                border-left: 4px solid #2563eb;
                padding: 15px 20px;
                margin: 20px 0;
                border-radius: 4px;
            }}
            .footer {{
                background-color: #f8f9fa;
                padding: 30px;
                text-align: center;
                font-size: 14px;
                color: #666;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>You're Invited to Join {organization_name}!</h1>
            </div>
            <div class="content">
                <p>Hi there,</p>
                
                <p><strong>{inviter_name}</strong> has invited you to join <strong>{organization_name}</strong> on NotHubSpot CRM as a <strong>{role_display}</strong>.</p>
                
                <p>NotHubSpot is a powerful CRM platform that helps teams manage contacts, companies, and communications all in one place.</p>
                
                <div class="info-box">
                    <p><strong>Your role: {role_display}</strong></p>
                    <p>As a {role_display}, you'll be able to:
                    {"<br>• Manage users and organization settings<br>• Full access to all CRM features" if role == "admin" else "<br>• Access and manage contacts and companies<br>• Send emails and track communications<br>• Create tasks and activities"}
                    </p>
                </div>
                
                <p style="text-align: center;">
                    <a href="{invite_url}" class="button">Accept Invitation</a>
                </p>
                
                <p style="color: #666; font-size: 14px;">
                    <strong>Note:</strong> This invitation will expire in 7 days. If you need a new invitation, please ask {inviter_name} to send another one.
                </p>
            </div>
            <div class="footer">
                <p>This invitation was sent to you by {inviter_name} from {organization_name}.</p>
                <p>© 2024 NotHubSpot. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """

def get_invite_email_text(organization_name: str, inviter_name: str, invite_url: str, role: str) -> str:
    """Generate invitation email text content"""
    role_display = "Administrator" if role == "admin" else "Team Member"
    
    return f"""
You're Invited to Join {organization_name}!

Hi there,

{inviter_name} has invited you to join {organization_name} on NotHubSpot CRM as a {role_display}.

NotHubSpot is a powerful CRM platform that helps teams manage contacts, companies, and communications all in one place.

Your role: {role_display}
{"• Manage users and organization settings" if role == "admin" else "• Access and manage contacts and companies"}
{"• Full access to all CRM features" if role == "admin" else "• Send emails and track communications"}
{'' if role == "admin" else "• Create tasks and activities"}

Accept your invitation:
{invite_url}

Note: This invitation will expire in 7 days. If you need a new invitation, please ask {inviter_name} to send another one.

---
This invitation was sent to you by {inviter_name} from {organization_name}.
© 2024 NotHubSpot. All rights reserved.
"""