"""
CRUD operations for authentication-related models
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional, List
from datetime import datetime, timedelta

from models import Organization, User, UserInvite, PasswordResetToken
from schemas import OrganizationCreate, UserCreate, UserRegister, UserInviteCreate, UserInviteAccept
from auth import get_password_hash, create_organization_slug, generate_invite_code
import secrets


# Organization CRUD operations
def create_organization(db: Session, organization: OrganizationCreate, created_by_id: Optional[int] = None) -> Organization:
    """Create a new organization"""
    slug = create_organization_slug(organization.name)
    
    db_organization = Organization(
        name=organization.name,
        slug=slug,
        created_by=created_by_id,
        plan="free",
        is_active=True
    )
    
    db.add(db_organization)
    db.commit()
    db.refresh(db_organization)
    return db_organization

def get_organization_by_slug(db: Session, slug: str) -> Optional[Organization]:
    """Get organization by slug"""
    return db.query(Organization).filter(
        Organization.slug == slug,
        Organization.is_active == True
    ).first()

def get_organization_by_id(db: Session, organization_id: int) -> Optional[Organization]:
    """Get organization by ID"""
    return db.query(Organization).filter(
        Organization.id == organization_id,
        Organization.is_active == True
    ).first()


# User CRUD operations
def create_user(db: Session, user: UserCreate, organization_id: int) -> User:
    """Create a new user"""
    hashed_password = get_password_hash(user.password)
    
    db_user = User(
        email=user.email,
        password_hash=hashed_password,
        first_name=user.first_name,
        last_name=user.last_name,
        organization_id=organization_id,
        role=user.role,
        is_active=True,
        email_verified=False
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def register_user_with_organization(db: Session, user_data: UserRegister) -> tuple[User, Organization]:
    """Register a new user and create their organization"""
    # Create organization first
    organization_create = OrganizationCreate(name=user_data.company_name)
    organization = create_organization(db, organization_create)
    
    # Create user as owner of the organization
    user_create = UserCreate(
        email=user_data.email,
        password=user_data.password,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role="owner"
    )
    
    user = create_user(db, user_create, organization.id)
    
    # Update organization created_by
    organization.created_by = user.id
    db.commit()
    
    return user, organization

def get_user_by_email(db: Session, email: str, organization_id: Optional[int] = None) -> Optional[User]:
    """Get user by email, optionally within a specific organization"""
    query = db.query(User).filter(User.email == email, User.is_active == True)
    
    if organization_id:
        query = query.filter(User.organization_id == organization_id)
    
    return query.first()

def get_user_by_id(db: Session, user_id: int, organization_id: Optional[int] = None) -> Optional[User]:
    """Get user by ID, optionally within a specific tenant"""
    query = db.query(User).filter(User.id == user_id, User.is_active == True)
    
    if organization_id:
        query = query.filter(User.organization_id == organization_id)
    
    return query.first()

def get_users_by_organization(db: Session, organization_id: int, skip: int = 0, limit: int = 100) -> List[User]:
    """Get all users for an organization"""
    return db.query(User).filter(
        User.organization_id == organization_id,
        User.is_active == True
    ).offset(skip).limit(limit).all()


# User invite CRUD operations
def create_user_invite(db: Session, invite: UserInviteCreate, organization_id: int, invited_by_id: int) -> UserInvite:
    """Create a new user invitation"""
    invite_code = generate_invite_code()
    expires_at = datetime.utcnow() + timedelta(days=7)  # 7 day expiry
    
    db_invite = UserInvite(
        organization_id=organization_id,
        email=invite.email,
        role=invite.role,
        invite_code=invite_code,
        invited_by=invited_by_id,
        status="pending",
        expires_at=expires_at
    )
    
    db.add(db_invite)
    db.commit()
    db.refresh(db_invite)
    return db_invite

def get_invite_by_code(db: Session, invite_code: str) -> Optional[UserInvite]:
    """Get invite by code"""
    return db.query(UserInvite).filter(
        UserInvite.invite_code == invite_code,
        UserInvite.status == "pending",
        UserInvite.expires_at > datetime.utcnow()
    ).first()

def accept_user_invite(db: Session, invite_accept: UserInviteAccept) -> tuple[User, UserInvite]:
    """Accept a user invitation and create the user"""
    # Get the invite
    invite = get_invite_by_code(db, invite_accept.invite_code)
    if not invite:
        raise ValueError("Invalid or expired invite code")
    
    # Check if user already exists
    existing_user = get_user_by_email(db, invite.email, invite.organization_id)
    if existing_user:
        raise ValueError("User already exists")
    
    # Create the user
    user_create = UserCreate(
        email=invite.email,
        password=invite_accept.password,
        first_name=invite_accept.first_name,
        last_name=invite_accept.last_name,
        role=invite.role
    )
    
    user = create_user(db, user_create, invite.organization_id)
    
    # Mark invite as accepted
    invite.status = "accepted"
    invite.accepted_at = datetime.utcnow()
    
    db.commit()
    
    return user, invite

def get_organization_invites(db: Session, organization_id: int, skip: int = 0, limit: int = 100) -> List[UserInvite]:
    """Get all invites for an organization"""
    return db.query(UserInvite).filter(
        UserInvite.organization_id == organization_id
    ).order_by(UserInvite.created_at.desc()).offset(skip).limit(limit).all()

def revoke_invite(db: Session, invite_id: int, organization_id: int) -> bool:
    """Revoke (cancel) a pending invite"""
    invite = db.query(UserInvite).filter(
        UserInvite.id == invite_id,
        UserInvite.organization_id == organization_id,
        UserInvite.status == "pending"
    ).first()
    
    if invite:
        invite.status = "expired"
        db.commit()
        return True
    
    return False

# Password Reset CRUD operations
def create_password_reset_token(db: Session, user_id: int) -> PasswordResetToken:
    """Create a password reset token for a user"""
    # Invalidate any existing tokens for this user
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user_id,
        PasswordResetToken.is_used == False
    ).update({"is_used": True})
    
    # Generate a secure token
    token = secrets.token_urlsafe(32)
    
    # Create new token with 1 hour expiry
    db_token = PasswordResetToken(
        user_id=user_id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(hours=1),
        is_used=False
    )
    
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    return db_token

def get_password_reset_token(db: Session, token: str) -> Optional[PasswordResetToken]:
    """Get a password reset token by token string"""
    return db.query(PasswordResetToken).filter(
        PasswordResetToken.token == token,
        PasswordResetToken.is_used == False,
        PasswordResetToken.expires_at > datetime.utcnow()
    ).first()

def use_password_reset_token(db: Session, token: str, new_password: str) -> bool:
    """Use a password reset token to update user password"""
    reset_token = get_password_reset_token(db, token)
    if not reset_token:
        return False
    
    # Update user password
    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user:
        return False
    
    user.password_hash = get_password_hash(new_password)
    
    # Mark token as used
    reset_token.is_used = True
    
    db.commit()
    return True