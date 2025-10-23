"""
Authentication utilities for NotHubSpot CRM
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import secrets
import string

from database import get_db
from models import User, Organization

# Configuration
import os
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "temporary-dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    import logging
    
    # Ensure we have strings
    if not isinstance(plain_password, str):
        plain_password = str(plain_password)
    if not isinstance(hashed_password, str):
        hashed_password = str(hashed_password)
    
    # Bcrypt has a 72-byte limit, ALWAYS truncate to be safe
    password_bytes = plain_password.encode('utf-8')
    if len(password_bytes) > 72:
        logging.warning(f"Password too long for bcrypt: {len(password_bytes)} bytes, truncating to 72 bytes")
        plain_password = password_bytes[:72].decode('utf-8', errors='ignore')
    
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        logging.error(f"Password verification error: {e}")
        # Try once more with aggressive truncation
        try:
            truncated = plain_password[:72] if len(plain_password) > 72 else plain_password
            return pwd_context.verify(truncated, hashed_password)
        except Exception as e2:
            logging.error(f"Password verification failed even with truncation: {e2}")
            return False

def get_password_hash(password: str) -> str:
    """Hash a password"""
    import logging
    
    # Ensure we have a string
    if not isinstance(password, str):
        password = str(password)
    
    # Bcrypt has a 72-byte limit, ALWAYS truncate to be safe
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        logging.warning(f"Password too long for hashing: {len(password_bytes)} bytes, truncating to 72 bytes")
        password = password_bytes[:72].decode('utf-8', errors='ignore')
    
    try:
        return pwd_context.hash(password)
    except Exception as e:
        logging.error(f"Password hashing error: {e}")
        # Try with aggressive character truncation
        truncated = password[:72] if len(password) > 72 else password
        return pwd_context.hash(truncated)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def generate_invite_code() -> str:
    """Generate a unique invite code"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for i in range(32))

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """Get the current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        organization_id = payload.get("organization_id")
        
        if user_id is None or organization_id is None:
            raise credentials_exception
        
        # Convert to int if needed (JWT stores as string)
        user_id = int(user_id) if isinstance(user_id, str) else user_id
        organization_id = int(organization_id) if isinstance(organization_id, str) else organization_id
    except (JWTError, ValueError) as e:
        print(f"JWT decode error: {e}")
        raise credentials_exception
    
    user = db.query(User).filter(
        User.id == user_id,
        User.organization_id == organization_id,
        User.is_active == True
    ).first()
    
    if user is None:
        raise credentials_exception
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Ensure the current user is active"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_current_admin_user(current_user: User = Depends(get_current_active_user)) -> User:
    """Ensure the current user is an admin"""
    if current_user.role not in ["owner", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

def create_organization_slug(name: str) -> str:
    """Create a URL-safe slug from organization name"""
    # Remove special characters and replace spaces with hyphens
    slug = "".join(c if c.isalnum() or c == " " else "" for c in name.lower())
    slug = "-".join(slug.split())
    
    # Add random suffix to ensure uniqueness
    suffix = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for i in range(4))
    return f"{slug}-{suffix}"