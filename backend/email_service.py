"""
Email service for NotHubSpot CRM
"""
import os
from typing import Optional
import httpx
from email_templates import get_welcome_email_html, get_welcome_email_text

SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
SENDGRID_FROM_EMAIL = os.environ.get("SENDGRID_FROM_EMAIL", "noreply@nothubspot.app")
SENDGRID_FROM_NAME = os.environ.get("SENDGRID_FROM_NAME", "NotHubSpot")

async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    from_email: Optional[str] = None,
    from_name: Optional[str] = None
) -> bool:
    """Send email via SendGrid"""
    print(f"DEBUG: SENDGRID_API_KEY exists: {bool(SENDGRID_API_KEY)}")
    print(f"DEBUG: SENDGRID_API_KEY length: {len(SENDGRID_API_KEY)}")
    print(f"DEBUG: SENDGRID_FROM_EMAIL: {SENDGRID_FROM_EMAIL}")
    print(f"DEBUG: SENDGRID_FROM_NAME: {SENDGRID_FROM_NAME}")
    
    if not SENDGRID_API_KEY:
        print("Warning: SENDGRID_API_KEY not configured, skipping email send")
        return False
    
    url = "https://api.sendgrid.com/v3/mail/send"
    headers = {
        "Authorization": f"Bearer {SENDGRID_API_KEY}",
        "Content-Type": "application/json"
    }
    
    data = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {
            "email": from_email or SENDGRID_FROM_EMAIL,
            "name": from_name or SENDGRID_FROM_NAME
        },
        "subject": subject,
        "content": []
    }
    
    if text_content:
        data["content"].append({"type": "text/plain", "value": text_content})
    
    data["content"].append({"type": "text/html", "value": html_content})
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=data, headers=headers)
            
            if response.status_code in [200, 201, 202]:
                print(f"Email sent successfully to {to_email}")
                return True
            else:
                print(f"Failed to send email: {response.status_code} - {response.text}")
                return False
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False

async def send_welcome_email(
    user_email: str,
    first_name: str,
    organization_name: str
) -> bool:
    """Send welcome email to new user"""
    subject = f"Welcome to NotHubSpot, {first_name}! 🎉"
    html_content = get_welcome_email_html(first_name, organization_name)
    text_content = get_welcome_email_text(first_name, organization_name)
    
    return await send_email(
        to_email=user_email,
        subject=subject,
        html_content=html_content,
        text_content=text_content
    )