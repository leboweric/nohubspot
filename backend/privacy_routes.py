"""
Email privacy and sharing API routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import User, Contact, EmailThread, EmailSharingPermission, O365UserConnection
from schemas import (
    ContactPrivacyUpdate, EmailThreadSharingUpdate, 
    EmailSharingPermissionCreate, EmailSharingPermissionResponse,
    EmailPrivacySettings, EmailPrivacySettingsUpdate
)
from auth import get_current_active_user

router = APIRouter(prefix="/api/privacy", tags=["privacy"])


@router.patch("/contacts/{contact_id}/privacy")
async def update_contact_privacy(
    contact_id: int,
    privacy_update: ContactPrivacyUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update contact privacy settings (owner only)"""
    # Get contact
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.organization_id == current_user.organization_id
    ).first()
    
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    # Only owner can update privacy settings
    if contact.owner_id != current_user.id and current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only contact owner can update privacy settings")
    
    # Update privacy settings
    if privacy_update.shared_with_team is not None:
        contact.shared_with_team = privacy_update.shared_with_team
    
    if privacy_update.owner_id is not None:
        # Verify new owner is in same organization
        new_owner = db.query(User).filter(
            User.id == privacy_update.owner_id,
            User.organization_id == current_user.organization_id
        ).first()
        if not new_owner:
            raise HTTPException(status_code=400, detail="Invalid owner ID")
        contact.owner_id = privacy_update.owner_id
    
    db.commit()
    return {"message": "Contact privacy settings updated"}


@router.patch("/email-threads/{thread_id}/privacy")
async def update_email_thread_privacy(
    thread_id: int,
    privacy_update: EmailThreadSharingUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update email thread privacy settings (owner only)"""
    # Get email thread
    thread = db.query(EmailThread).filter(
        EmailThread.id == thread_id,
        EmailThread.organization_id == current_user.organization_id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")
    
    # Only owner can update privacy settings
    if thread.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only thread owner can update privacy settings")
    
    # Update privacy settings
    if privacy_update.is_private is not None:
        thread.is_private = privacy_update.is_private
    
    if privacy_update.shared_with is not None:
        # Verify all users are in same organization
        users = db.query(User).filter(
            User.id.in_(privacy_update.shared_with),
            User.organization_id == current_user.organization_id
        ).all()
        
        if len(users) != len(privacy_update.shared_with):
            raise HTTPException(status_code=400, detail="Some user IDs are invalid")
        
        thread.shared_with = privacy_update.shared_with
    
    db.commit()
    return {"message": "Email thread privacy settings updated"}


@router.post("/email-threads/{thread_id}/share")
async def share_email_thread(
    thread_id: int,
    permission: EmailSharingPermissionCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Share an email thread with another user"""
    # Get email thread
    thread = db.query(EmailThread).filter(
        EmailThread.id == thread_id,
        EmailThread.organization_id == current_user.organization_id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")
    
    # Only owner can share
    if thread.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only thread owner can share")
    
    # Verify target user
    target_user = db.query(User).filter(
        User.id == permission.user_id,
        User.organization_id == current_user.organization_id
    ).first()
    
    if not target_user:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    # Create or update permission
    existing = db.query(EmailSharingPermission).filter(
        EmailSharingPermission.email_thread_id == thread_id,
        EmailSharingPermission.user_id == permission.user_id
    ).first()
    
    if existing:
        existing.permission_level = permission.permission_level
        existing.granted_by = current_user.id
    else:
        sharing = EmailSharingPermission(
            email_thread_id=thread_id,
            user_id=permission.user_id,
            permission_level=permission.permission_level,
            granted_by=current_user.id
        )
        db.add(sharing)
    
    db.commit()
    return {"message": "Email thread shared successfully"}


@router.delete("/email-threads/{thread_id}/share/{user_id}")
async def unshare_email_thread(
    thread_id: int,
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove sharing permission for an email thread"""
    # Get email thread
    thread = db.query(EmailThread).filter(
        EmailThread.id == thread_id,
        EmailThread.organization_id == current_user.organization_id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")
    
    # Only owner can unshare
    if thread.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only thread owner can unshare")
    
    # Remove permission
    permission = db.query(EmailSharingPermission).filter(
        EmailSharingPermission.email_thread_id == thread_id,
        EmailSharingPermission.user_id == user_id
    ).first()
    
    if permission:
        db.delete(permission)
        db.commit()
    
    return {"message": "Sharing permission removed"}


@router.get("/email-privacy-settings", response_model=EmailPrivacySettings)
async def get_email_privacy_settings(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's email privacy settings"""
    connection = db.query(O365UserConnection).filter(
        O365UserConnection.user_id == current_user.id
    ).first()
    
    if not connection:
        # Return defaults if no connection exists
        return EmailPrivacySettings()
    
    return EmailPrivacySettings(
        sync_only_crm_contacts=connection.sync_only_crm_contacts,
        excluded_domains=connection.excluded_domains or [],
        excluded_keywords=connection.excluded_keywords or [],
        auto_create_contacts=connection.auto_create_contacts
    )


@router.patch("/email-privacy-settings")
async def update_email_privacy_settings(
    settings: EmailPrivacySettingsUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update current user's email privacy settings"""
    connection = db.query(O365UserConnection).filter(
        O365UserConnection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="O365 connection not found")
    
    # Update settings
    if settings.sync_only_crm_contacts is not None:
        connection.sync_only_crm_contacts = settings.sync_only_crm_contacts
    
    if settings.excluded_domains is not None:
        connection.excluded_domains = settings.excluded_domains
    
    if settings.excluded_keywords is not None:
        connection.excluded_keywords = settings.excluded_keywords
    
    if settings.auto_create_contacts is not None:
        connection.auto_create_contacts = settings.auto_create_contacts
    
    db.commit()
    return {"message": "Email privacy settings updated"}