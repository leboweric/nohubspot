"""
Temporary cleanup routes for data maintenance
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date
from typing import List, Dict
from database import get_db
from models import User, Contact, Organization, EmailThread
from auth import get_current_admin_user

router = APIRouter(prefix="/api/cleanup", tags=["cleanup"])


@router.get("/contacts/today")
async def get_todays_contacts(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
) -> Dict:
    """Get list of contacts created today (admin only)"""
    # Get today's date
    today = date.today()
    
    # Find contacts created today in user's organization
    contacts = db.query(Contact).filter(
        Contact.organization_id == current_user.organization_id,
        Contact.created_at >= today
    ).all()
    
    result = []
    for contact in contacts:
        # Count related email threads
        thread_count = db.query(EmailThread).filter(
            EmailThread.contact_id == contact.id
        ).count()
        
        result.append({
            "id": contact.id,
            "name": f"{contact.first_name} {contact.last_name}",
            "email": contact.email,
            "created_at": contact.created_at.isoformat(),
            "email_thread_count": thread_count
        })
    
    return {
        "count": len(contacts),
        "contacts": result
    }


@router.delete("/contacts/today")
async def delete_todays_contacts(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
) -> Dict:
    """Delete all contacts created today (admin only)"""
    # Get today's date
    today = date.today()
    
    # Find contacts created today in user's organization
    contacts = db.query(Contact).filter(
        Contact.organization_id == current_user.organization_id,
        Contact.created_at >= today
    ).all()
    
    deleted_count = 0
    errors = []
    
    for contact in contacts:
        try:
            db.delete(contact)
            deleted_count += 1
        except Exception as e:
            errors.append({
                "contact": f"{contact.first_name} {contact.last_name} ({contact.email})",
                "error": str(e)
            })
            db.rollback()
    
    db.commit()
    
    return {
        "deleted": deleted_count,
        "errors": errors,
        "message": f"Successfully deleted {deleted_count} contacts created today"
    }


@router.delete("/contacts/by-email-pattern")
async def delete_contacts_by_pattern(
    pattern: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
) -> Dict:
    """Delete contacts whose email matches a pattern (admin only)"""
    # Find contacts with emails matching the pattern
    contacts = db.query(Contact).filter(
        Contact.organization_id == current_user.organization_id,
        Contact.email.ilike(f"%{pattern}%")
    ).all()
    
    if not contacts:
        return {"message": "No contacts found matching the pattern", "deleted": 0}
    
    # Show what would be deleted
    contact_list = [
        {
            "id": c.id,
            "name": f"{c.first_name} {c.last_name}",
            "email": c.email
        } for c in contacts
    ]
    
    # Delete the contacts
    deleted_count = 0
    for contact in contacts:
        try:
            db.delete(contact)
            deleted_count += 1
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Error deleting contact {contact.email}: {str(e)}"
            )
    
    db.commit()
    
    return {
        "deleted": deleted_count,
        "contacts": contact_list,
        "message": f"Successfully deleted {deleted_count} contacts"
    }