"""
Bulk email service for NotHubSpot CRM
Handles sending emails to multiple contacts with throttling and tracking
"""
import asyncio
import os
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from models import Contact, EmailTracking, User
from email_service import send_email


async def send_bulk_email(
    db: Session,
    organization_id: int,
    sender_user_id: int,
    contact_ids: List[int],
    subject: str,
    html_content: str,
    from_email: Optional[str] = None,
    from_name: Optional[str] = None,
    text_content: Optional[str] = None,
) -> dict:
    """
    Send an email to multiple contacts with throttling.
    
    Returns a dict with success_count, error_count, and errors list.
    """
    # Get contacts
    contacts = db.query(Contact).filter(
        Contact.id.in_(contact_ids),
        Contact.organization_id == organization_id
    ).all()
    
    if not contacts:
        return {
            "success_count": 0,
            "error_count": 0,
            "total": 0,
            "errors": [],
            "message": "No contacts found"
        }
    
    # Filter out placeholder emails and contacts without valid emails
    valid_contacts = []
    skipped = []
    for contact in contacts:
        if not contact.email:
            skipped.append({"contact": f"{contact.first_name} {contact.last_name}", "reason": "No email address"})
        elif "@placeholder.com" in contact.email:
            skipped.append({"contact": f"{contact.first_name} {contact.last_name}", "reason": "Placeholder email"})
        elif hasattr(contact, 'unsubscribed') and contact.unsubscribed:
            skipped.append({"contact": f"{contact.first_name} {contact.last_name}", "reason": "Unsubscribed"})
        else:
            valid_contacts.append(contact)
    
    success_count = 0
    error_count = 0
    errors = []
    
    # Load default sender settings
    SENDGRID_FROM_EMAIL = os.environ.get("SENDGRID_FROM_EMAIL", "noreply@nothubspot.app")
    SENDGRID_FROM_NAME = os.environ.get("SENDGRID_FROM_NAME", "NotHubSpot")
    
    actual_from_email = from_email or SENDGRID_FROM_EMAIL
    actual_from_name = from_name or SENDGRID_FROM_NAME
    
    for i, contact in enumerate(valid_contacts):
        try:
            # Personalize the HTML content with contact variables
            personalized_html = personalize_content(html_content, contact)
            personalized_subject = personalize_content(subject, contact)
            personalized_text = personalize_content(text_content, contact) if text_content else None
            
            success = await send_email(
                to_email=contact.email,
                subject=personalized_subject,
                html_content=personalized_html,
                text_content=personalized_text,
                from_email=actual_from_email,
                from_name=actual_from_name,
            )
            
            if success:
                success_count += 1
                
                # Create tracking record
                try:
                    tracking = EmailTracking(
                        organization_id=organization_id,
                        message_id=f"bulk_{datetime.utcnow().timestamp()}_{contact.id}",
                        to_email=contact.email,
                        from_email=actual_from_email,
                        subject=personalized_subject,
                        contact_id=contact.id,
                        sent_by=sender_user_id,
                        sent_at=datetime.utcnow(),
                    )
                    db.add(tracking)
                except Exception as track_err:
                    print(f"Warning: Failed to create tracking record for {contact.email}: {track_err}")
            else:
                error_count += 1
                errors.append({
                    "contact": f"{contact.first_name} {contact.last_name}",
                    "email": contact.email,
                    "reason": "SendGrid delivery failed"
                })
            
            # Throttle: wait 100ms between sends to avoid rate limits
            if i < len(valid_contacts) - 1:
                await asyncio.sleep(0.1)
                
        except Exception as e:
            error_count += 1
            errors.append({
                "contact": f"{contact.first_name} {contact.last_name}",
                "email": contact.email,
                "reason": str(e)
            })
    
    # Commit tracking records
    try:
        db.commit()
    except Exception as e:
        print(f"Warning: Failed to commit tracking records: {e}")
        db.rollback()
    
    return {
        "success_count": success_count,
        "error_count": error_count,
        "skipped_count": len(skipped),
        "total": len(contacts),
        "skipped": skipped[:20],  # Limit to first 20
        "errors": errors[:20],  # Limit to first 20
        "message": f"Sent {success_count} of {len(valid_contacts)} emails ({len(skipped)} skipped)"
    }


def personalize_content(content: str, contact: Contact) -> str:
    """Replace template variables with contact data"""
    if not content:
        return content
    
    replacements = {
        "{{contact.first_name}}": contact.first_name or "",
        "{{contact.last_name}}": contact.last_name or "",
        "{{contact.email}}": contact.email or "",
        "{{contact.company_name}}": contact.company_name or "",
        "{{contact.title}}": contact.title or "",
        "{{contact.phone}}": contact.phone or "",
        "{{first_name}}": contact.first_name or "",
        "{{last_name}}": contact.last_name or "",
        "{{email}}": contact.email or "",
        "{{company_name}}": contact.company_name or "",
    }
    
    result = content
    for key, value in replacements.items():
        result = result.replace(key, value)
    
    return result
