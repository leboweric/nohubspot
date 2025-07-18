"""
Email service for NotHubSpot CRM
"""
import os
import base64
import json
from typing import Optional, List
from datetime import datetime
import uuid
import httpx
from email_templates import get_welcome_email_html, get_welcome_email_text, get_password_reset_email_html, get_password_reset_email_text, get_invite_email_html, get_invite_email_text

def generate_ics_content(
    event_title: str,
    event_description: str,
    start_time: datetime,
    end_time: datetime,
    location: str = "",
    organizer_email: str = "",
    organizer_name: str = "",
    attendee_emails: List[str] = None
) -> str:
    """Generate .ics calendar file content"""
    if attendee_emails is None:
        attendee_emails = []
    
    # Generate unique UID for the event
    event_uid = str(uuid.uuid4())
    
    # Format dates in UTC (iCalendar format)
    start_time_utc = start_time.strftime("%Y%m%dT%H%M%SZ")
    end_time_utc = end_time.strftime("%Y%m%dT%H%M%SZ")
    created_time = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    
    # Build attendees list
    attendee_lines = []
    for email in attendee_emails:
        attendee_lines.append(f"ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:MAILTO:{email}")
    
    # Build organizer line
    organizer_line = f"ORGANIZER;CN={organizer_name}:MAILTO:{organizer_email}" if organizer_email else ""
    
    # Clean and escape description and title
    def escape_ical_text(text: str) -> str:
        """Escape special characters for iCalendar format"""
        if not text:
            return ""
        return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")
    
    ics_content = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//NotHubSpot//NotHubSpot CRM//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:{event_uid}
DTSTART:{start_time_utc}
DTEND:{end_time_utc}
DTSTAMP:{created_time}
CREATED:{created_time}
LAST-MODIFIED:{created_time}
SUMMARY:{escape_ical_text(event_title)}
DESCRIPTION:{escape_ical_text(event_description)}
LOCATION:{escape_ical_text(location)}
STATUS:CONFIRMED
TRANSP:OPAQUE
SEQUENCE:0
{organizer_line}
{chr(10).join(attendee_lines)}
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Reminder
END:VALARM
END:VEVENT
END:VCALENDAR"""
    
    return ics_content

async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    from_email: Optional[str] = None,
    from_name: Optional[str] = None,
    attachments: Optional[List[dict]] = None,
    cc_emails: Optional[List[str]] = None,
    disable_tracking: bool = False
) -> bool:
    """Send email via SendGrid"""
    # Load environment variables at runtime instead of module import time
    SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
    SENDGRID_FROM_EMAIL = os.environ.get("SENDGRID_FROM_EMAIL", "noreply@nothubspot.app")
    SENDGRID_FROM_NAME = os.environ.get("SENDGRID_FROM_NAME", "NotHubSpot")
    
    print(f"DEBUG: SENDGRID_API_KEY exists: {bool(SENDGRID_API_KEY)}")
    print(f"DEBUG: SENDGRID_API_KEY length: {len(SENDGRID_API_KEY)}")
    print(f"DEBUG: SENDGRID_FROM_EMAIL: {SENDGRID_FROM_EMAIL}")
    print(f"DEBUG: SENDGRID_FROM_NAME: {SENDGRID_FROM_NAME}")
    
    if not SENDGRID_API_KEY:
        print("ERROR: SENDGRID_API_KEY not configured, cannot send email")
        print(f"Attempted to send to: {to_email}")
        print(f"Subject: {subject}")
        return False
    
    url = "https://api.sendgrid.com/v3/mail/send"
    headers = {
        "Authorization": f"Bearer {SENDGRID_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Build personalizations with CC if provided
    personalization = {"to": [{"email": to_email}]}
    if cc_emails:
        personalization["cc"] = [{"email": email} for email in cc_emails]
    
    data = {
        "personalizations": [personalization],
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
    
    # Add attachments if provided
    if attachments:
        data["attachments"] = attachments
    
    # Disable click tracking if requested (important for invitation links)
    if disable_tracking:
        data["tracking_settings"] = {
            "click_tracking": {
                "enable": False
            },
            "open_tracking": {
                "enable": False
            }
        }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=data, headers=headers)
            
            if response.status_code in [200, 201, 202]:
                cc_msg = f" (CC: {', '.join(cc_emails)})" if cc_emails else ""
                print(f"Email sent successfully to {to_email}{cc_msg}")
                return True
            else:
                print(f"ERROR: Failed to send email to {to_email}")
                print(f"Status Code: {response.status_code}")
                print(f"Response: {response.text}")
                print(f"Request Data: {json.dumps(data, indent=2)}")
                return False
    except Exception as e:
        print(f"ERROR: Exception while sending email to {to_email}")
        print(f"Exception Type: {type(e).__name__}")
        print(f"Exception Details: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def send_welcome_email(
    to_email: str,
    user_name: str,
    organization_name: str,
    temporary_password: str = None,
    added_by: str = None
) -> bool:
    """Send welcome email to new user"""
    if temporary_password:
        # New user added directly
        subject = f"Welcome to {organization_name} on NotHubSpot"
        from email_templates import get_user_added_email_html, get_user_added_email_text
        html_content = get_user_added_email_html(
            user_name=user_name,
            organization_name=organization_name,
            user_email=to_email,
            temporary_password=temporary_password,
            added_by=added_by
        )
        text_content = get_user_added_email_text(
            user_name=user_name,
            organization_name=organization_name,
            user_email=to_email,
            temporary_password=temporary_password,
            added_by=added_by
        )
    else:
        # Regular welcome email (for self-registration)
        subject = f"Welcome to NotHubSpot, {user_name.split()[0]}! 🎉"
        from email_templates import get_welcome_email_html, get_welcome_email_text
        html_content = get_welcome_email_html(user_name.split()[0], organization_name)
        text_content = get_welcome_email_text(user_name.split()[0], organization_name)
    
    return await send_email(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        text_content=text_content
    )

async def send_password_reset_email(
    user_email: str,
    first_name: str,
    reset_url: str
) -> bool:
    """Send password reset email to user"""
    subject = "Reset Your Password - NotHubSpot"
    html_content = get_password_reset_email_html(first_name, reset_url)
    text_content = get_password_reset_email_text(first_name, reset_url)
    
    return await send_email(
        to_email=user_email,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        disable_tracking=True  # Disable tracking for password reset links
    )

async def send_invite_email(
    user_email: str,
    organization_name: str,
    inviter_name: str,
    invite_url: str,
    role: str = "user",
    cc_owner_email: Optional[str] = None
) -> bool:
    """Send invitation email to new user"""
    # Extract first name from email (best guess)
    recipient_name = user_email.split('@')[0].split('.')[0].capitalize()
    
    subject = f"You're invited to join {organization_name} on NotHubSpot"
    html_content = get_invite_email_html(organization_name, inviter_name, invite_url, role, recipient_name)
    text_content = get_invite_email_text(organization_name, inviter_name, invite_url, role, recipient_name)
    
    # Include CC if owner email is provided
    cc_list = [cc_owner_email] if cc_owner_email else None
    
    return await send_email(
        to_email=user_email,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        cc_emails=cc_list,
        disable_tracking=True  # Disable link tracking to prevent SSL certificate errors
    )

async def send_calendar_invite(
    event_title: str,
    event_description: str,
    start_time: datetime,
    end_time: datetime,
    location: str,
    attendee_emails: List[str],
    organizer_email: str,
    organizer_name: str
) -> bool:
    """Send calendar invite to attendees with .ics attachment"""
    if not attendee_emails:
        return True
    
    # Generate .ics file content
    ics_content = generate_ics_content(
        event_title=event_title,
        event_description=event_description,
        start_time=start_time,
        end_time=end_time,
        location=location,
        organizer_email=organizer_email,
        organizer_name=organizer_name,
        attendee_emails=attendee_emails
    )
    
    # Encode .ics content as base64 for attachment
    ics_base64 = base64.b64encode(ics_content.encode('utf-8')).decode('utf-8')
    
    # Create attachment
    attachments = [{
        "content": ics_base64,
        "filename": f"{event_title.replace(' ', '_')}.ics",
        "type": "text/calendar",
        "disposition": "attachment"
    }]
    
    # Format start time for display
    start_time_formatted = start_time.strftime("%A, %B %d, %Y at %I:%M %p")
    
    # Create email content
    subject = f"Calendar Invite: {event_title}"
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">📅 You're Invited to: {event_title}</h2>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1e40af;">Event Details</h3>
            <p><strong>📅 When:</strong> {start_time_formatted}</p>
            <p><strong>📍 Where:</strong> {location or 'Not specified'}</p>
            <p><strong>👤 Organizer:</strong> {organizer_name} ({organizer_email})</p>
        </div>
        
        {f'<div style="margin: 20px 0;"><h4>Description:</h4><p>{event_description}</p></div>' if event_description else ''}
        
        <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>📎 Calendar file attached</strong> - Open the attached .ics file to add this event to your calendar.</p>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
            This invitation was sent from NotHubSpot CRM. If you have any questions, please contact the organizer directly.
        </p>
    </div>
    """
    
    text_content = f"""
Calendar Invite: {event_title}

Event Details:
When: {start_time_formatted}
Where: {location or 'Not specified'}
Organizer: {organizer_name} ({organizer_email})

{f'Description: {event_description}' if event_description else ''}

A calendar file (.ics) is attached to this email. Open it to add this event to your calendar.

This invitation was sent from NotHubSpot CRM.
    """
    
    # Send email to each attendee
    success_count = 0
    for email in attendee_emails:
        try:
            success = await send_email(
                to_email=email,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
                from_email=organizer_email,
                from_name=organizer_name,
                attachments=attachments
            )
            if success:
                success_count += 1
        except Exception as e:
            print(f"Failed to send calendar invite to {email}: {str(e)}")
            continue
    
    return success_count == len(attendee_emails)