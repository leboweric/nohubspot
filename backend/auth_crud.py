"""
CRUD operations for authentication-related models
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional, List
from datetime import datetime, timedelta

from models import Tenant, User, UserInvite
from schemas import TenantCreate, UserCreate, UserRegister, UserInviteCreate, UserInviteAccept
from auth import get_password_hash, create_tenant_slug, generate_invite_code


# Tenant CRUD operations
def create_tenant(db: Session, tenant: TenantCreate, created_by_id: Optional[int] = None) -> Tenant:
    """Create a new tenant/organization"""
    slug = create_tenant_slug(tenant.name)
    
    db_tenant = Tenant(
        name=tenant.name,
        slug=slug,
        created_by=created_by_id,
        plan="free",
        is_active=True
    )
    
    db.add(db_tenant)
    db.commit()
    db.refresh(db_tenant)
    return db_tenant

def get_tenant_by_slug(db: Session, slug: str) -> Optional[Tenant]:
    """Get tenant by slug"""
    return db.query(Tenant).filter(
        Tenant.slug == slug,
        Tenant.is_active == True
    ).first()

def get_tenant_by_id(db: Session, tenant_id: int) -> Optional[Tenant]:
    """Get tenant by ID"""
    return db.query(Tenant).filter(
        Tenant.id == tenant_id,
        Tenant.is_active == True
    ).first()


# User CRUD operations
def create_user(db: Session, user: UserCreate, tenant_id: int) -> User:
    """Create a new user"""
    hashed_password = get_password_hash(user.password)
    
    db_user = User(
        email=user.email,
        password_hash=hashed_password,
        first_name=user.first_name,
        last_name=user.last_name,
        tenant_id=tenant_id,
        role=user.role,
        is_active=True,
        email_verified=False
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def register_user_with_tenant(db: Session, user_data: UserRegister) -> tuple[User, Tenant]:
    """Register a new user and create their tenant"""
    # Create tenant first
    tenant_create = TenantCreate(name=user_data.company_name)
    tenant = create_tenant(db, tenant_create)
    
    # Create user as owner of the tenant
    user_create = UserCreate(
        email=user_data.email,
        password=user_data.password,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role="owner"
    )
    
    user = create_user(db, user_create, tenant.id)
    
    # Update tenant created_by
    tenant.created_by = user.id
    db.commit()
    
    return user, tenant

def get_user_by_email(db: Session, email: str, tenant_id: Optional[int] = None) -> Optional[User]:
    """Get user by email, optionally within a specific tenant"""
    query = db.query(User).filter(User.email == email, User.is_active == True)
    
    if tenant_id:
        query = query.filter(User.tenant_id == tenant_id)
    
    return query.first()

def get_user_by_id(db: Session, user_id: int, tenant_id: Optional[int] = None) -> Optional[User]:
    """Get user by ID, optionally within a specific tenant"""
    query = db.query(User).filter(User.id == user_id, User.is_active == True)
    
    if tenant_id:
        query = query.filter(User.tenant_id == tenant_id)
    
    return query.first()

def get_users_by_tenant(db: Session, tenant_id: int, skip: int = 0, limit: int = 100) -> List[User]:
    """Get all users for a tenant"""
    return db.query(User).filter(
        User.tenant_id == tenant_id,
        User.is_active == True
    ).offset(skip).limit(limit).all()


# User invite CRUD operations
def create_user_invite(db: Session, invite: UserInviteCreate, tenant_id: int, invited_by_id: int) -> UserInvite:
    """Create a new user invitation"""
    invite_code = generate_invite_code()
    expires_at = datetime.utcnow() + timedelta(days=7)  # 7 day expiry
    
    db_invite = UserInvite(
        tenant_id=tenant_id,
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
    existing_user = get_user_by_email(db, invite.email, invite.tenant_id)
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
    
    user = create_user(db, user_create, invite.tenant_id)
    
    # Mark invite as accepted
    invite.status = "accepted"
    invite.accepted_at = datetime.utcnow()
    
    db.commit()
    
    return user, invite

def get_tenant_invites(db: Session, tenant_id: int, skip: int = 0, limit: int = 100) -> List[UserInvite]:
    """Get all invites for a tenant"""
    return db.query(UserInvite).filter(
        UserInvite.tenant_id == tenant_id
    ).order_by(UserInvite.created_at.desc()).offset(skip).limit(limit).all()

def revoke_invite(db: Session, invite_id: int, tenant_id: int) -> bool:
    """Revoke (cancel) a pending invite"""
    invite = db.query(UserInvite).filter(
        UserInvite.id == invite_id,
        UserInvite.tenant_id == tenant_id,
        UserInvite.status == "pending"
    ).first()
    
    if invite:
        invite.status = "expired"
        db.commit()
        return True
    
    return False