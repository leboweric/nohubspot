from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, status, Request
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
import os
import uvicorn
from datetime import datetime, timedelta
from dotenv import load_dotenv
from collections import defaultdict
import time

# Load environment variables from .env file
load_dotenv()

# Simple rate limiter to prevent API overwhelm
request_counts = defaultdict(list)

def rate_limit_check(client_ip: str, endpoint: str, max_requests: int = 30, window: int = 60):
    """Check if request is within rate limit"""
    now = time.time()
    key = f"{client_ip}:{endpoint}"
    
    # Clean old requests
    request_counts[key] = [req_time for req_time in request_counts[key] if now - req_time < window]
    
    # Check limit
    if len(request_counts[key]) >= max_requests:
        return False
    
    # Add current request
    request_counts[key].append(now)
    return True

from database import get_db, SessionLocal, engine
from models import Base, Company, Contact, Task, EmailThread, EmailMessage, Attachment, Activity, EmailSignature, Organization, User, UserInvite, PasswordResetToken, CalendarEvent, EventAttendee, O365OrganizationConfig, O365UserConnection, PipelineStage, Deal, EmailTracking, EmailEvent
from schemas import (
    CompanyCreate, CompanyResponse, CompanyUpdate,
    ContactCreate, ContactResponse, ContactUpdate,
    TaskCreate, TaskResponse, TaskUpdate,
    EmailThreadCreate, EmailThreadResponse,
    EmailMessageCreate, EmailMessageResponse, AttachmentResponse,
    EmailSignatureCreate, EmailSignatureResponse, EmailSignatureUpdate,
    ActivityResponse, DashboardStats, BulkUploadResult,
    OrganizationCreate, OrganizationResponse, UserRegister, UserLogin, UserResponse,
    UserInviteCreate, UserInviteResponse, UserInviteAccept, Token,
    EmailTemplateCreate, EmailTemplateResponse, EmailTemplateUpdate,
    CalendarEventCreate, CalendarEventResponse, CalendarEventUpdate,
    EventAttendeeCreate, EventAttendeeResponse,
    PasswordResetRequest, PasswordResetConfirm, PasswordResetResponse,
    O365OrganizationConfigCreate, O365OrganizationConfigUpdate, O365OrganizationConfigResponse,
    O365UserConnectionUpdate, O365UserConnectionResponse,
    O365TestConnectionRequest, O365TestConnectionResponse,
    PipelineStageCreate, PipelineStageResponse, PipelineStageUpdate,
    DealCreate, DealResponse, DealUpdate,
    EmailTrackingCreate, EmailTrackingResponse, EmailEventCreate, EmailEventResponse, SendGridEvent
)
from crud import (
    create_company, get_companies, get_company, update_company, delete_company,
    create_contact, get_contacts, get_contact, update_contact, delete_contact,
    create_task, get_tasks, get_task, update_task, delete_task,
    create_email_thread, get_email_threads, add_email_message,
    create_attachment, get_attachments,
    get_email_signature, create_or_update_email_signature,
    bulk_create_companies, bulk_create_contacts,
    create_activity, get_recent_activities,
    get_dashboard_stats,
    create_calendar_event, get_calendar_events, get_calendar_event, 
    update_calendar_event, delete_calendar_event, get_upcoming_events, get_today_events,
    is_org_owner, get_o365_org_config, create_o365_org_config, update_o365_org_config, delete_o365_org_config,
    get_o365_user_connection, get_o365_user_connections_by_org, update_o365_user_connection, delete_o365_user_connection,
    create_pipeline_stage, get_pipeline_stages, get_pipeline_stage, update_pipeline_stage, delete_pipeline_stage, create_default_pipeline_stages,
    create_deal, get_deals, get_deal, update_deal, delete_deal
)
from auth_crud import (
    create_organization, get_organization_by_slug, get_organization_by_id,
    create_user, register_user_with_organization, get_user_by_email,
    create_user_invite, get_invite_by_code, accept_user_invite,
    get_organization_invites, revoke_invite, get_users_by_organization,
    create_password_reset_token, get_password_reset_token, use_password_reset_token
)
from auth import (
    verify_password, create_access_token, get_current_user, 
    get_current_active_user, get_current_admin_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from email_service import send_welcome_email, send_password_reset_email, send_calendar_invite, send_invite_email
from email_template_crud import (
    get_email_templates, get_email_template, create_email_template,
    update_email_template, delete_email_template, increment_template_usage,
    get_template_categories, replace_template_variables
)
from ai_service import generate_daily_summary
from ai_chat import process_ai_chat
from o365_service import O365Service, get_oauth_url, exchange_code_for_tokens
from o365_encryption import encrypt_access_token, encrypt_refresh_token, decrypt_client_secret, encrypt_client_secret

# Create database tables with error handling
print("🔨 Starting database initialization...")

# Database migration function
def migrate_tenant_to_organization(db_engine):
    """Migrate from tenant_id to organization_id columns"""
    print("🔄 Checking for database migrations...")
    
    with db_engine.connect() as conn:
        try:
            # Check if we need to migrate from tenants to organizations table
            result = conn.execute(text("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'tenants'
            """))
            
            if result.fetchone():
                print("🔄 Migrating tenants table to organizations...")
                # Rename tenants table to organizations
                conn.execute(text("ALTER TABLE tenants RENAME TO organizations"))
                print("  ✅ Renamed tenants table to organizations")
            
            # Check and migrate tenant_id columns to organization_id
            tables_to_migrate = ['users', 'companies', 'contacts', 'email_threads', 'tasks', 'activities', 'email_signatures', 'user_invites']
            
            for table_name in tables_to_migrate:
                # Check if table exists and has tenant_id column
                result = conn.execute(text(f"""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = '{table_name}' AND column_name = 'tenant_id'
                """))
                
                if result.fetchone():
                    print(f"🔄 Migrating {table_name}.tenant_id to organization_id...")
                    conn.execute(text(f"ALTER TABLE {table_name} RENAME COLUMN tenant_id TO organization_id"))
                    print(f"  ✅ Migrated {table_name}.tenant_id to organization_id")
            
            # Update foreign key constraints that still reference tenants table
            print("🔄 Updating foreign key constraints...")
            try:
                # Get all foreign key constraints that reference the old tenants table
                fk_result = conn.execute(text("""
                    SELECT tc.table_name, tc.constraint_name, kcu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
                    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'tenants'
                """))
                
                for row in fk_result:
                    table_name, constraint_name, column_name = row
                    print(f"🔄 Updating FK constraint {constraint_name} in {table_name}...")
                    # Drop old constraint and create new one
                    conn.execute(text(f"ALTER TABLE {table_name} DROP CONSTRAINT IF EXISTS {constraint_name}"))
                    conn.execute(text(f"ALTER TABLE {table_name} ADD CONSTRAINT {constraint_name} FOREIGN KEY ({column_name}) REFERENCES organizations(id)"))
                    print(f"  ✅ Updated FK constraint {constraint_name}")
                    
            except Exception as fk_error:
                print(f"  ⚠️  FK constraint update info: {fk_error}")
            
            conn.commit()
            print("✅ Database migration completed successfully")
            
        except Exception as e:
            print(f"⚠️  Migration error: {e}")
            conn.rollback()

# TEMPORARY: Force recreate tables to fix schema issues
FORCE_RECREATE = False  # Set to True only when you need to reset the database

try:
    # Run migration first
    migrate_tenant_to_organization(engine)
    
    if FORCE_RECREATE:
        print("⚠️  FORCE RECREATE MODE - Dropping all tables...")
        from sqlalchemy import text
        
        # Drop all tables with CASCADE to handle foreign keys
        with engine.connect() as conn:
            try:
                # More aggressive approach: drop all tables at once
                conn.execute(text("DROP SCHEMA public CASCADE"))
                conn.execute(text("CREATE SCHEMA public"))
                conn.execute(text("GRANT ALL ON SCHEMA public TO postgres"))
                conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
                print("  ✅ Dropped and recreated public schema")
            except Exception as e:
                print(f"  Schema drop failed, trying table-by-table: {e}")
                # Fallback to individual table drops
                result = conn.execute(text("""
                    SELECT tablename FROM pg_tables 
                    WHERE schemaname = 'public'
                """))
                tables = [row[0] for row in result]
                
                # Drop each table with CASCADE
                for table in tables:
                    try:
                        conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
                        print(f"  Dropped table: {table}")
                    except Exception as table_error:
                        print(f"  Failed to drop {table}: {table_error}")
            
            conn.commit()
        
        print("✅ All tables dropped")
    
    # Create all tables
    print("🔨 Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully")
    
    # Run company fields migration
    print("🔄 Checking for new company fields...")
    from sqlalchemy import inspect
    inspector = inspect(engine)
    
    if 'companies' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('companies')]
        fields_to_add = []
        
        if 'street_address' not in columns:
            fields_to_add.append(('street_address', 'VARCHAR(255)'))
        if 'city' not in columns:
            fields_to_add.append(('city', 'VARCHAR(100)'))
        if 'state' not in columns:
            fields_to_add.append(('state', 'VARCHAR(100)'))
        if 'postal_code' not in columns:
            fields_to_add.append(('postal_code', 'VARCHAR(20)'))
        if 'phone' not in columns:
            fields_to_add.append(('phone', 'VARCHAR(50)'))
        if 'annual_revenue' not in columns:
            fields_to_add.append(('annual_revenue', 'FLOAT'))
        
        if fields_to_add:
            print(f"📦 Adding new company fields: {', '.join([f[0] for f in fields_to_add])}")
            with engine.connect() as conn:
                for field_name, field_type in fields_to_add:
                    try:
                        conn.execute(text(f"ALTER TABLE companies ADD COLUMN {field_name} {field_type}"))
                        conn.commit()
                        print(f"  ✓ Added {field_name}")
                    except Exception as e:
                        print(f"  ⚠️ Failed to add {field_name}: {e}")
            print("✅ Company fields migration completed")
    
    # Check if we need to seed data
    db = next(get_db())
    try:
        company_count = db.query(Company).count()
        print(f"📊 Found {company_count} companies in database")
        
        if company_count == 0:
            print("📊 Skipping sample data seeding for now...")
            # from init_db import seed_sample_data
            # seed_sample_data()
    except Exception as query_error:
        print(f"⚠️  Query failed: {query_error}")
        print("📊 Skipping seeding due to query error...")
        # try:
        #     from init_db import seed_sample_data
        #     seed_sample_data()
        # except Exception as seed_error:
        #     print(f"❌ Seeding failed: {seed_error}")
    finally:
        db.close()
        
except Exception as e:
    print(f"❌ Database initialization failed: {e}")
    print("⚠️  The application will continue but database operations may fail")

app = FastAPI(
    title="NotHubSpot CRM API",
    description="Backend API for NotHubSpot CRM - The HubSpot Alternative",
    version="1.0.0"
)

# CORS middleware configured for your deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        "https://*.netlify.app",  # Netlify deployments
        "https://nohubspot.netlify.app",  # Your production domain
        "https://nohubspot-production.up.railway.app",  # Your Railway domain
        "*"  # Allow all origins for now - you can restrict this later
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoints
@app.get("/")
async def root():
    return {"message": "NotHubSpot CRM API is running!", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    try:
        # ✅ Use dependency injection instead of manual session
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
            return {"status": "healthy", "timestamp": datetime.utcnow(), "database": "connected"}
        finally:
            db.close()  # ✅ Always close in finally block
    except Exception as e:
        return {"status": "unhealthy", "timestamp": datetime.utcnow(), "error": str(e)}

@app.get("/api/users")  # Railway healthcheck endpoint
async def users_health():
    return {"status": "ok", "message": "NotHubSpot CRM API is running"}

@app.get("/api/debug/db-pool")
async def db_pool_status():
    """Monitor database connection pool status"""
    try:
        pool = engine.pool
        return {
            "pool_size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "invalid": pool.invalid()
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/debug/env")
async def debug_env():
    """Debug endpoint to check environment variables"""
    import os
    return {
        "sendgrid_api_key_exists": bool(os.environ.get("SENDGRID_API_KEY")),
        "sendgrid_api_key_length": len(os.environ.get("SENDGRID_API_KEY", "")),
        "sendgrid_from_email": os.environ.get("SENDGRID_FROM_EMAIL", "not set"),
        "sendgrid_from_name": os.environ.get("SENDGRID_FROM_NAME", "not set"),
        "database_url_exists": bool(os.environ.get("DATABASE_URL")),
        "railway_environment": os.environ.get("RAILWAY_ENVIRONMENT_NAME", "not set"),
        "all_env_vars": list(os.environ.keys())
    }

@app.post("/api/debug/test-email")
async def test_email():
    """Test endpoint to send a simple email"""
    from email_service import send_email
    
    try:
        result = await send_email(
            to_email="test@example.com",
            subject="Test Email from NotHubSpot",
            html_content="<h1>Test Email</h1><p>This is a test email to verify SendGrid configuration.</p>",
            text_content="Test Email\n\nThis is a test email to verify SendGrid configuration."
        )
        return {
            "success": result,
            "message": "Email sent successfully" if result else "Email failed to send"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error sending email: {str(e)}"
        }

@app.post("/api/debug/test-ai")
async def test_ai():
    """Test endpoint to check AI configuration"""
    import os
    from openai import OpenAI
    
    openai_key = os.environ.get("OPENAI_API_KEY")
    
    return {
        "openai_key_exists": bool(openai_key),
        "openai_key_length": len(openai_key) if openai_key else 0,
        "openai_key_starts_with": openai_key[:10] + "..." if openai_key else None,
        "environment_vars": {
            "OPENAI_API_KEY": bool(os.environ.get("OPENAI_API_KEY")),
            "OPENAI_KEY": bool(os.environ.get("OPENAI_KEY")),
            "OPEN_AI_KEY": bool(os.environ.get("OPEN_AI_KEY")),
            "OPENAI": bool(os.environ.get("OPENAI"))
        }
    }

@app.get("/api/debug/company-status")
async def debug_company_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Debug endpoint to check company status values"""
    companies = db.query(Company).filter(Company.organization_id == current_user.organization_id).all()
    
    return {
        "total_companies": len(companies),
        "companies": [
            {
                "id": company.id,
                "name": company.name,
                "status": company.status,
                "status_repr": repr(company.status)  # Shows exact string with quotes
            }
            for company in companies
        ],
        "status_counts": {},
        "active_count_query": db.query(Company).filter(
            Company.organization_id == current_user.organization_id,
            Company.status == "Active"
        ).count()
    }

# Authentication endpoints
@app.post("/api/auth/register", response_model=Token)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user and create their organization"""
    # Check if user already exists
    existing_user = get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    try:
        # Create user and organization
        user, organization = register_user_with_organization(db, user_data)
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id), "organization_id": str(organization.id)}, 
            expires_delta=access_token_expires
        )
        
        # Send welcome email (don't wait for it)
        import asyncio
        asyncio.create_task(send_welcome_email(
            user_email=user.email,
            first_name=user.first_name or user.email.split('@')[0],
            organization_name=organization.name
        ))
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user,
            "organization": organization
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )

@app.post("/api/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login user"""
    # Get user by email
    user = get_user_by_email(db, form_data.username)
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get organization
    organization = get_organization_by_id(db, user.organization_id)
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "organization_id": str(user.organization_id)}, 
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
        "organization": organization
    }

@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information"""
    return current_user

# Password reset endpoints
@app.post("/api/auth/forgot-password", response_model=PasswordResetResponse)
async def forgot_password(request: PasswordResetRequest, db: Session = Depends(get_db)):
    """Request a password reset"""
    # Check if user exists
    user = get_user_by_email(db, request.email)
    if not user:
        # Don't reveal if user exists or not for security
        return PasswordResetResponse(message="If your email is registered, you will receive a password reset link.")
    
    try:
        # Create password reset token
        reset_token = create_password_reset_token(db, user.id)
        
        # Generate reset URL
        reset_url = f"https://nothubspot.app/auth/reset-password?token={reset_token.token}"
        
        # Send password reset email
        import asyncio
        asyncio.create_task(send_password_reset_email(
            user_email=user.email,
            first_name=user.first_name or user.email.split('@')[0],
            reset_url=reset_url
        ))
        
        return PasswordResetResponse(message="If your email is registered, you will receive a password reset link.")
        
    except Exception as e:
        print(f"Password reset error: {str(e)}")
        return PasswordResetResponse(message="If your email is registered, you will receive a password reset link.")

@app.post("/api/auth/reset-password", response_model=PasswordResetResponse)
async def reset_password(request: PasswordResetConfirm, db: Session = Depends(get_db)):
    """Reset password using token"""
    try:
        success = use_password_reset_token(db, request.token, request.new_password)
        
        if success:
            return PasswordResetResponse(message="Your password has been successfully reset. You can now log in with your new password.")
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )
            
    except Exception as e:
        print(f"Password reset confirmation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password"
        )

# User invitation endpoints
@app.post("/api/invites", response_model=UserInviteResponse)
async def create_invite(
    invite: UserInviteCreate, 
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a user invitation (admin only)"""
    # Check if user already exists in the organization
    existing_user = get_user_by_email(db, invite.email, current_user.organization_id)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists in this organization"
        )
    
    # Create the invite in database
    db_invite = create_user_invite(db, invite, current_user.organization_id, current_user.id)
    
    # Get organization details
    organization = get_organization_by_id(db, current_user.organization_id)
    
    # Build the invite URL - using frontend URL for accept page
    frontend_url = os.environ.get("NEXT_PUBLIC_API_URL", "https://nothubspot.app")
    invite_url = f"{frontend_url}/auth/accept-invite?code={db_invite.invite_code}"
    
    # Send the invitation email
    inviter_name = f"{current_user.first_name} {current_user.last_name}"
    email_sent = await send_invite_email(
        user_email=invite.email,
        organization_name=organization.name,
        inviter_name=inviter_name,
        invite_url=invite_url,
        role=invite.role
    )
    
    if not email_sent:
        print(f"Warning: Failed to send invitation email to {invite.email}")
    
    return db_invite

@app.get("/api/invites", response_model=List[UserInviteResponse])
async def get_invites(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get all invitations for the organization (admin only)"""
    return get_organization_invites(db, current_user.organization_id, skip, limit)

@app.post("/api/invites/accept", response_model=Token)
async def accept_invite(invite_accept: UserInviteAccept, db: Session = Depends(get_db)):
    """Accept a user invitation"""
    try:
        user, invite = accept_user_invite(db, invite_accept)
        
        # Get organization
        organization = get_organization_by_id(db, user.organization_id)
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id), "organization_id": str(user.organization_id)}, 
            expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user,
            "organization": organization
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@app.delete("/api/invites/{invite_id}")
async def revoke_user_invite(
    invite_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Revoke a pending invitation (admin only)"""
    success = revoke_invite(db, invite_id, current_user.organization_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found or already processed"
        )
    return {"message": "Invitation revoked successfully"}

# Organization users endpoint
@app.get("/api/users", response_model=List[UserResponse])
async def get_organization_users(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all users in the organization"""
    # Rate limiting to prevent API overwhelm
    if not rate_limit_check(request.client.host, "/api/users", max_requests=10, window=60):
        raise HTTPException(status_code=429, detail="Rate limit exceeded - too many requests")
    
    return get_users_by_organization(db, current_user.organization_id, skip, limit)

# TEMPORARY: Cleanup endpoint for development
@app.delete("/api/admin/cleanup/organization/{org_name}")
async def cleanup_organization(
    org_name: str,
    db: Session = Depends(get_db)
):
    """Delete organization and all associated data (TEMPORARY CLEANUP)"""
    try:
        # Find the organization
        organization = db.query(Organization).filter(
            Organization.name.ilike(f"%{org_name}%")
        ).first()
        
        if not organization:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Organization containing '{org_name}' not found"
            )
        
        org_id = organization.id
        org_full_name = organization.name
        
        # Delete all associated data (cascade should handle this, but being explicit)
        db.query(Company).filter(Company.organization_id == org_id).delete()
        db.query(Contact).filter(Contact.organization_id == org_id).delete()
        db.query(Task).filter(Task.organization_id == org_id).delete()
        db.query(EmailThread).filter(EmailThread.organization_id == org_id).delete()
        db.query(Activity).filter(Activity.organization_id == org_id).delete()
        db.query(EmailSignature).filter(EmailSignature.organization_id == org_id).delete()
        db.query(UserInvite).filter(UserInvite.organization_id == org_id).delete()
        
        # Clear the created_by foreign key reference first
        organization.created_by = None
        db.commit()
        
        # Now delete users
        users_deleted = db.query(User).filter(User.organization_id == org_id).delete()
        
        # Delete the organization
        db.delete(organization)
        db.commit()
        
        return {
            "message": f"Successfully deleted organization '{org_full_name}' and {users_deleted} associated users",
            "organization_id": org_id,
            "users_deleted": users_deleted
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cleanup failed: {str(e)}"
        )

# Dashboard endpoints
@app.get("/api/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_statistics(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return get_dashboard_stats(db, current_user.organization_id)

@app.get("/api/dashboard/daily-summary")
async def get_daily_summary(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate AI-powered daily summary for the user"""
    try:
        summary = generate_daily_summary(
            db=db,
            user_id=current_user.id,
            organization_id=current_user.organization_id
        )
        return summary
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate daily summary: {str(e)}"
        )

# Calendar endpoints
@app.post("/api/calendar/events", response_model=CalendarEventResponse)
async def create_new_calendar_event(
    event: CalendarEventCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_event = create_calendar_event(db, event, current_user.organization_id, current_user.id)
    
    # Create activity log
    create_activity(
        db,
        title="Calendar Event Created",
        description=f"Created event: {event.title}",
        type="calendar",
        entity_id=str(db_event.id),
        organization_id=current_user.organization_id
    )
    
    return db_event

@app.get("/api/calendar/events", response_model=List[CalendarEventResponse])
async def read_calendar_events(
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    contact_id: Optional[int] = None,
    company_id: Optional[int] = None,
    event_type: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    from datetime import datetime
    
    # Parse date strings
    start_datetime = None
    end_datetime = None
    if start_date:
        start_datetime = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
    if end_date:
        end_datetime = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    
    events = get_calendar_events(
        db, current_user.organization_id, skip, limit,
        start_datetime, end_datetime, contact_id, company_id, event_type
    )
    
    # Populate related names
    for event in events:
        if event.contact_id:
            contact = get_contact(db, event.contact_id, current_user.organization_id)
            if contact:
                event.contact_name = f"{contact.first_name} {contact.last_name}"
        if event.company_id:
            company = get_company(db, event.company_id, current_user.organization_id)
            if company:
                event.company_name = company.name
    
    return events

@app.get("/api/calendar/events/{event_id}", response_model=CalendarEventResponse)
async def read_calendar_event(
    event_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    event = get_calendar_event(db, event_id, current_user.organization_id)
    if not event:
        raise HTTPException(status_code=404, detail="Calendar event not found")
    
    # Populate related names
    if event.contact_id:
        contact = get_contact(db, event.contact_id, current_user.organization_id)
        if contact:
            event.contact_name = f"{contact.first_name} {contact.last_name}"
    if event.company_id:
        company = get_company(db, event.company_id, current_user.organization_id)
        if company:
            event.company_name = company.name
    
    return event

@app.put("/api/calendar/events/{event_id}", response_model=CalendarEventResponse)
async def update_existing_calendar_event(
    event_id: int,
    event_update: CalendarEventUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    event = update_calendar_event(db, event_id, event_update, current_user.organization_id)
    if not event:
        raise HTTPException(status_code=404, detail="Calendar event not found")
    
    create_activity(
        db,
        title="Calendar Event Updated",
        description=f"Updated event: {event.title}",
        type="calendar",
        entity_id=str(event.id),
        organization_id=current_user.organization_id
    )
    
    return event

@app.delete("/api/calendar/events/{event_id}")
async def delete_existing_calendar_event(
    event_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    success = delete_calendar_event(db, event_id, current_user.organization_id)
    if not success:
        raise HTTPException(status_code=404, detail="Calendar event not found")
    
    create_activity(
        db,
        title="Calendar Event Deleted",
        description=f"Deleted calendar event",
        type="calendar",
        entity_id=str(event_id),
        organization_id=current_user.organization_id
    )
    
    return {"message": "Calendar event deleted successfully"}

@app.get("/api/calendar/upcoming", response_model=List[CalendarEventResponse])
async def read_upcoming_events(
    limit: int = 10,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get upcoming events for dashboard"""
    events = get_upcoming_events(db, current_user.organization_id, limit)
    
    # Populate related names
    for event in events:
        if event.contact_id:
            contact = get_contact(db, event.contact_id, current_user.organization_id)
            if contact:
                event.contact_name = f"{contact.first_name} {contact.last_name}"
        if event.company_id:
            company = get_company(db, event.company_id, current_user.organization_id)
            if company:
                event.company_name = company.name
    
    return events

@app.post("/api/calendar/events/{event_id}/send-invite")
async def send_calendar_event_invite(
    event_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Send calendar invites to all attendees of an event"""
    # Get the event with attendees
    event = get_calendar_event(db, event_id, current_user.organization_id)
    if not event:
        raise HTTPException(status_code=404, detail="Calendar event not found")
    
    # Get attendee contact information
    attendee_emails = []
    attendee_names = []
    
    for attendee in event.attendees:
        contact = db.query(Contact).filter(Contact.id == attendee.contact_id).first()
        if contact and contact.email:
            attendee_emails.append(contact.email)
            attendee_names.append(f"{contact.first_name} {contact.last_name}")
    
    if not attendee_emails:
        raise HTTPException(status_code=400, detail="No attendees with email addresses found")
    
    # Get organizer information
    organizer = db.query(User).filter(User.id == event.created_by).first()
    organizer_email = organizer.email if organizer else "noreply@nothubspot.app"
    organizer_name = f"{organizer.first_name} {organizer.last_name}" if organizer and organizer.first_name else "NotHubSpot"
    
    try:
        # Send calendar invites
        success = await send_calendar_invite(
            event_title=event.title,
            event_description=event.description or "",
            start_time=event.start_time,
            end_time=event.end_time,
            location=event.location or "",
            attendee_emails=attendee_emails,
            organizer_email=organizer_email,
            organizer_name=organizer_name
        )
        
        if success:
            # Update attendee records to mark invites as sent
            from datetime import datetime
            for attendee in event.attendees:
                attendee.invite_sent = True
                attendee.invite_sent_at = datetime.utcnow()
            
            db.commit()
            
            # Create activity log
            create_activity(
                db,
                title="Calendar Invites Sent",
                description=f"Sent calendar invites for '{event.title}' to {len(attendee_emails)} attendees",
                type="calendar",
                entity_id=str(event.id),
                organization_id=current_user.organization_id
            )
            
            return {
                "success": True,
                "message": f"Calendar invites sent to {len(attendee_emails)} attendees",
                "attendees_notified": attendee_names
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to send calendar invites")
            
    except Exception as e:
        print(f"Error sending calendar invites: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send calendar invites: {str(e)}")

# Office 365 Integration endpoints
@app.get("/api/settings/o365/organization", response_model=O365OrganizationConfigResponse)
async def get_organization_o365_config(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get Office 365 organization configuration (Owner only)"""
    if not is_org_owner(current_user):
        raise HTTPException(
            status_code=403, 
            detail="Only organization owners can view Office 365 settings"
        )
    
    config = get_o365_org_config(db, current_user.organization_id)
    if not config:
        # Return default empty config
        return O365OrganizationConfigResponse(
            id=0,
            organization_id=current_user.organization_id,
            client_id=None,
            tenant_id=None,
            calendar_sync_enabled=True,
            email_sending_enabled=True,
            contact_sync_enabled=True,
            is_configured=False,
            last_test_success=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
    
    return config

@app.post("/api/settings/o365/organization", response_model=O365OrganizationConfigResponse)
async def create_organization_o365_config(
    config: O365OrganizationConfigCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create Office 365 organization configuration (Owner only)"""
    if not is_org_owner(current_user):
        raise HTTPException(
            status_code=403, 
            detail="Only organization owners can configure Office 365 settings"
        )
    
    # Check if config already exists
    existing_config = get_o365_org_config(db, current_user.organization_id)
    if existing_config:
        raise HTTPException(
            status_code=400,
            detail="Office 365 configuration already exists. Use PUT to update."
        )
    
    try:
        db_config = create_o365_org_config(db, config, current_user.organization_id)
        
        # Create activity log
        create_activity(
            db,
            title="Office 365 Configuration Created",
            description=f"Office 365 integration configured for organization",
            type="settings",
            entity_id=str(current_user.organization_id),
            organization_id=current_user.organization_id
        )
        
        return db_config
    except Exception as e:
        print(f"Error creating O365 config: {e}")
        raise HTTPException(status_code=500, detail="Failed to create Office 365 configuration")

@app.put("/api/settings/o365/organization", response_model=O365OrganizationConfigResponse)
async def update_organization_o365_config(
    config_update: O365OrganizationConfigUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update Office 365 organization configuration (Owner only)"""
    if not is_org_owner(current_user):
        raise HTTPException(
            status_code=403, 
            detail="Only organization owners can configure Office 365 settings"
        )
    
    try:
        db_config = update_o365_org_config(db, current_user.organization_id, config_update)
        if not db_config:
            # Create new config if it doesn't exist
            create_config = O365OrganizationConfigCreate(**config_update.dict(exclude_unset=True))
            db_config = create_o365_org_config(db, create_config, current_user.organization_id)
        
        # Create activity log
        create_activity(
            db,
            title="Office 365 Configuration Updated",
            description=f"Office 365 integration settings updated",
            type="settings",
            entity_id=str(current_user.organization_id),
            organization_id=current_user.organization_id
        )
        
        return db_config
    except Exception as e:
        print(f"Error updating O365 config: {e}")
        raise HTTPException(status_code=500, detail="Failed to update Office 365 configuration")

@app.delete("/api/settings/o365/organization")
async def delete_organization_o365_config(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete Office 365 organization configuration (Owner only)"""
    if not is_org_owner(current_user):
        raise HTTPException(
            status_code=403, 
            detail="Only organization owners can configure Office 365 settings"
        )
    
    success = delete_o365_org_config(db, current_user.organization_id)
    if not success:
        raise HTTPException(status_code=404, detail="Office 365 configuration not found")
    
    # Create activity log
    create_activity(
        db,
        title="Office 365 Configuration Deleted",
        description=f"Office 365 integration disabled for organization",
        type="settings",
        entity_id=str(current_user.organization_id),
        organization_id=current_user.organization_id
    )
    
    return {"message": "Office 365 configuration deleted successfully"}

@app.get("/api/settings/o365/user", response_model=O365UserConnectionResponse)
async def get_user_o365_connection(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's Office 365 connection"""
    connection = get_o365_user_connection(db, current_user.id)
    if not connection:
        raise HTTPException(status_code=404, detail="Office 365 connection not found")
    
    return connection

@app.put("/api/settings/o365/user", response_model=O365UserConnectionResponse)
async def update_user_o365_connection(
    connection_update: O365UserConnectionUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update current user's Office 365 connection preferences"""
    connection = update_o365_user_connection(db, current_user.id, connection_update)
    if not connection:
        raise HTTPException(status_code=404, detail="Office 365 connection not found")
    
    return connection

@app.delete("/api/settings/o365/user")
async def disconnect_user_o365_connection(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Disconnect current user's Office 365 connection"""
    success = delete_o365_user_connection(db, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Office 365 connection not found")
    
    return {"message": "Office 365 connection disconnected successfully"}

@app.post("/api/ai/chat")
async def ai_chat(
    request: dict,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Interactive AI chat for CRM questions"""
    try:
        print(f"AI Chat request received: {request}")
        
        message = request.get("message", "")
        context = request.get("context", "general")
        summary_data = request.get("summary_data")
        
        print(f"AI Chat - User: {current_user.id}, Org: {current_user.organization_id}, Message: {message}")
        
        if not message.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Message cannot be empty"
            )
        
        response = process_ai_chat(
            db=db,
            user_id=current_user.id,
            organization_id=current_user.organization_id,
            message=message,
            context=context,
            summary_data=summary_data
        )
        
        print(f"AI Chat response: {response}")
        
        return {"response": response}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"AI Chat error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process AI chat: {str(e)}"
        )

@app.get("/api/activities", response_model=List[ActivityResponse])
async def get_activities(
    limit: int = 10, 
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return get_recent_activities(db, current_user.organization_id, limit=limit)

# Company endpoints
@app.post("/api/companies", response_model=CompanyResponse)
async def create_new_company(
    company: CompanyCreate, 
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    try:
        print(f"Creating company: {company.dict()}")
        print(f"User org_id: {current_user.organization_id}")
        
        db_company = create_company(db, company, current_user.organization_id)
        print(f"Company created with ID: {db_company.id}")
        
        # Create activity log
        create_activity(
            db, 
            title="Company Added",
            description=f"Added {company.name} as a new company",
            type="company",
            entity_id=str(db_company.id),
            organization_id=current_user.organization_id
        )
        
        return db_company
        
    except Exception as e:
        print(f"Error creating company: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create company: {str(e)}"
        )

@app.get("/api/companies", response_model=List[CompanyResponse])
async def read_companies(
    skip: int = 0, 
    limit: int = 100, 
    search: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return get_companies(db, current_user.organization_id, skip=skip, limit=limit, search=search, status=status)

@app.get("/api/companies/{company_id}", response_model=CompanyResponse)
async def read_company(
    company_id: int, 
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    company = get_company(db, company_id, current_user.organization_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company

@app.put("/api/companies/{company_id}", response_model=CompanyResponse)
async def update_existing_company(
    company_id: int, 
    company_update: CompanyUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    company = update_company(db, company_id, company_update, current_user.organization_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    create_activity(
        db,
        title="Company Updated", 
        description=f"Updated {company.name}",
        type="company",
        entity_id=str(company.id),
        organization_id=current_user.organization_id
    )
    
    return company

@app.delete("/api/companies/{company_id}")
async def delete_existing_company(
    company_id: int, 
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    success = delete_company(db, company_id, current_user.organization_id)
    if not success:
        raise HTTPException(status_code=404, detail="Company not found")
    
    create_activity(
        db,
        title="Company Deleted",
        description=f"Deleted company",
        type="company",
        entity_id=str(company_id),
        organization_id=current_user.organization_id
    )
    
    return {"message": "Company deleted successfully"}

# Contact endpoints
@app.post("/api/contacts", response_model=ContactResponse)
async def create_new_contact(
    contact: ContactCreate, 
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    try:
        print(f"Creating contact: {contact.dict()}")
        print(f"User org_id: {current_user.organization_id}")
        
        db_contact = create_contact(db, contact, current_user.organization_id)
        print(f"Contact created with ID: {db_contact.id}")
        
        create_activity(
            db,
            title="Contact Added",
            description=f"Added {contact.first_name} {contact.last_name} as a new contact",
            type="contact", 
            entity_id=str(db_contact.id),
            organization_id=current_user.organization_id
        )
        
        return db_contact
        
    except Exception as e:
        print(f"Error creating contact: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create contact: {str(e)}"
        )

@app.get("/api/contacts", response_model=List[ContactResponse])
async def read_contacts(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    company_id: Optional[int] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return get_contacts(
        db, 
        current_user.organization_id,
        skip=skip, 
        limit=limit, 
        search=search, 
        company_id=company_id, 
        status=status
    )

@app.get("/api/contacts/{contact_id}", response_model=ContactResponse)
async def read_contact(
    contact_id: int, 
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    contact = get_contact(db, contact_id, current_user.organization_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact

@app.put("/api/contacts/{contact_id}", response_model=ContactResponse)
async def update_existing_contact(
    contact_id: int,
    contact_update: ContactUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    contact = update_contact(db, contact_id, contact_update, current_user.organization_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    create_activity(
        db,
        title="Contact Updated",
        description=f"Updated {contact.first_name} {contact.last_name}",
        type="contact",
        entity_id=str(contact.id),
        organization_id=current_user.organization_id
    )
    
    return contact

@app.delete("/api/contacts/{contact_id}")
async def delete_existing_contact(
    contact_id: int, 
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    success = delete_contact(db, contact_id, current_user.organization_id)
    if not success:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Contact deleted successfully"}

# Task endpoints
@app.post("/api/tasks", response_model=TaskResponse)
async def create_new_task(
    task: TaskCreate, 
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_task = create_task(db, task, current_user.organization_id)
    
    create_activity(
        db,
        title="Task Created",
        description=f"Created task: {task.title}",
        type="task",
        entity_id=str(db_task.id),
        organization_id=current_user.organization_id
    )
    
    return db_task

@app.get("/api/tasks", response_model=List[TaskResponse])
async def read_tasks(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    contact_id: Optional[int] = None,
    company_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return get_tasks(
        db, 
        current_user.organization_id,
        skip=skip, 
        limit=limit, 
        search=search, 
        status=status, 
        priority=priority,
        contact_id=contact_id,
        company_id=company_id
    )

@app.get("/api/tasks/{task_id}", response_model=TaskResponse)
async def read_task(
    task_id: int, 
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    task = get_task(db, task_id, current_user.organization_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.put("/api/tasks/{task_id}", response_model=TaskResponse)
async def update_existing_task(
    task_id: int,
    task_update: TaskUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    task = update_task(db, task_id, task_update, current_user.organization_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    create_activity(
        db,
        title="Task Updated",
        description=f"Updated task: {task.title}",
        type="task",
        entity_id=str(task.id),
        organization_id=current_user.organization_id
    )
    
    return task

@app.delete("/api/tasks/{task_id}")
async def delete_existing_task(
    task_id: int, 
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    success = delete_task(db, task_id, current_user.organization_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    
    create_activity(
        db,
        title="Task Deleted",
        description=f"Deleted task",
        type="task",
        entity_id=str(task_id),
        organization_id=current_user.organization_id
    )
    
    return {"message": "Task deleted successfully"}

# Email Signature endpoints - FIXED
@app.get("/api/signature", response_model=Optional[EmailSignatureResponse])
async def get_user_signature(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    try:
        # Use actual user ID and organization ID
        org_id = getattr(current_user, 'organization_id', 4)  # Fallback to org 4
        result = get_email_signature(db, str(current_user.id), org_id)
        
        # Ensure user_id is string for response validation
        if result and hasattr(result, 'user_id') and isinstance(result.user_id, int):
            result.user_id = str(result.user_id)
            
        return result
    except Exception as e:
        print(f"Signature get error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get signature: {str(e)}")

@app.post("/api/signature", response_model=EmailSignatureResponse)
async def create_or_update_signature(
    signature: EmailSignatureCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    try:
        # Use actual user ID and organization ID
        org_id = getattr(current_user, 'organization_id', 4)  # Fallback to org 4
        result = create_or_update_email_signature(db, signature, str(current_user.id), org_id)
        
        # Ensure user_id is string for response validation
        if hasattr(result, 'user_id') and isinstance(result.user_id, int):
            result.user_id = str(result.user_id)
            
        return result
    except Exception as e:
        print(f"Signature save error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save signature: {str(e)}")

# Email Template endpoints
@app.get("/api/email-templates", response_model=List[EmailTemplateResponse])
async def get_templates(
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    search: Optional[str] = None,
    include_personal: bool = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get email templates for the organization"""
    templates = get_email_templates(
        db, current_user.organization_id, current_user.id,
        skip=skip, limit=limit, category=category, search=search,
        include_personal=include_personal
    )
    
    # Add creator names
    for template in templates:
        if template.created_by:
            creator = db.query(User).filter(User.id == template.created_by).first()
            template.creator_name = f"{creator.first_name} {creator.last_name}".strip() if creator else None
    
    return templates

@app.get("/api/email-templates/categories")
async def get_categories(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all template categories for the organization"""
    categories = get_template_categories(db, current_user.organization_id)
    return {"categories": categories}

@app.get("/api/email-templates/{template_id}", response_model=EmailTemplateResponse)
async def get_template(
    template_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific email template"""
    template = get_email_template(db, template_id, current_user.organization_id, current_user.id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Add creator name
    if template.created_by:
        creator = db.query(User).filter(User.id == template.created_by).first()
        template.creator_name = f"{creator.first_name} {creator.last_name}".strip() if creator else None
    
    return template

@app.post("/api/email-templates", response_model=EmailTemplateResponse)
async def create_template(
    template: EmailTemplateCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new email template"""
    db_template = create_email_template(db, template, current_user.organization_id, current_user.id)
    
    # Add creator name
    creator = db.query(User).filter(User.id == current_user.id).first()
    db_template.creator_name = f"{creator.first_name} {creator.last_name}".strip() if creator else None
    
    return db_template

@app.put("/api/email-templates/{template_id}", response_model=EmailTemplateResponse)
async def update_template(
    template_id: int,
    template_update: EmailTemplateUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update an email template"""
    db_template = update_email_template(
        db, template_id, template_update, current_user.organization_id, current_user.id
    )
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found or access denied")
    
    # Add creator name
    if db_template.created_by:
        creator = db.query(User).filter(User.id == db_template.created_by).first()
        db_template.creator_name = f"{creator.first_name} {creator.last_name}".strip() if creator else None
    
    return db_template

@app.delete("/api/email-templates/{template_id}")
async def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete an email template"""
    success = delete_email_template(db, template_id, current_user.organization_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found or access denied")
    return {"message": "Template deleted successfully"}

@app.post("/api/email-templates/{template_id}/use")
async def use_template(
    template_id: int,
    contact_id: Optional[int] = None,
    company_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get template with variables replaced and increment usage count"""
    template = get_email_template(db, template_id, current_user.organization_id, current_user.id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get contact and company data for variable replacement
    contact_data = None
    company_data = None
    
    if contact_id:
        contact = get_contact(db, contact_id, current_user.organization_id)
        if contact:
            contact_data = {
                "first_name": contact.first_name,
                "last_name": contact.last_name,
                "email": contact.email,
                "phone": contact.phone,
                "title": contact.title,
                "company_name": contact.company_name
            }
    
    if company_id:
        company = get_company(db, company_id, current_user.organization_id)
        if company:
            company_data = {
                "name": company.name,
                "industry": company.industry,
                "website": company.website,
                "address": company.address
            }
    
    # User data for variable replacement
    user_data = {
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email
    }
    
    # Replace variables in subject and body
    processed_subject = replace_template_variables(template.subject, contact_data, company_data, user_data)
    processed_body = replace_template_variables(template.body, contact_data, company_data, user_data)
    
    # Increment usage count
    increment_template_usage(db, template_id, current_user.organization_id, current_user.id)
    
    return {
        "id": template.id,
        "name": template.name,
        "subject": processed_subject,
        "body": processed_body,
        "category": template.category
    }

# Bulk upload endpoints
@app.post("/api/companies/bulk", response_model=BulkUploadResult)
async def bulk_upload_companies(
    companies: List[CompanyCreate], 
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Validate input
    if not companies:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No companies provided for upload"
        )
    
    # Process companies in batches with individual error handling
    success_count = 0
    errors = []
    db_companies = []
    
    for i, company_data in enumerate(companies):
        try:
            # Validate required fields
            if not company_data.name:
                errors.append(f"Row {i+1}: Company name is required")
                continue
                
            # Create company
            db_company = Company(**company_data.dict(), organization_id=current_user.organization_id)
            db.add(db_company)
            db_companies.append(db_company)
            success_count += 1
            
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
    
    # Commit all successful companies
    if db_companies:
        try:
            db.commit()
            for company in db_companies:
                db.refresh(company)
                
            # Create activity for bulk upload
            create_activity(
                db,
                title="Bulk Companies Upload",
                description=f"Uploaded {success_count} companies",
                type="company",
                organization_id=current_user.organization_id
            )
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error during bulk upload: {str(e)}"
            )
    
    return BulkUploadResult(
        success_count=success_count,
        error_count=len(companies) - success_count,
        total_count=len(companies),
        errors=errors[:10]  # Limit errors to first 10 to avoid huge responses
    )

@app.post("/api/contacts/bulk", response_model=BulkUploadResult)
async def bulk_upload_contacts(
    contacts: List[ContactCreate], 
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    try:
        db_contacts = bulk_create_contacts(db, contacts, current_user.organization_id)
        
        # Create activity for bulk upload
        create_activity(
            db,
            title="Bulk Contacts Upload",
            description=f"Uploaded {len(db_contacts)} contacts",
            type="contact",
            organization_id=current_user.organization_id
        )
        
        return BulkUploadResult(
            success_count=len(db_contacts),
            error_count=0,
            total_count=len(contacts),
            errors=[]
        )
    except Exception as e:
        return BulkUploadResult(
            success_count=0,
            error_count=len(contacts),
            total_count=len(contacts),
            errors=[str(e)]
        )

# Development/Admin endpoints
@app.delete("/api/admin/cleanup/tenant/{tenant_slug}")
async def cleanup_tenant(tenant_slug: str, db: Session = Depends(get_db)):
    """
    Clean up a specific tenant and all associated data
    WARNING: This permanently deletes all data for the tenant
    """
    try:
        # Get the tenant
        tenant = get_tenant_by_slug(db, tenant_slug)
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant with slug '{tenant_slug}' not found"
            )
        
        tenant_id = tenant.id
        
        # Delete all associated data in correct order (foreign key constraints)
        # Count records before deletion for reporting
        counts = {
            "activities": db.query(Activity).filter(Activity.tenant_id == tenant_id).count(),
            "user_invites": db.query(UserInvite).filter(UserInvite.tenant_id == tenant_id).count(),
            "email_signatures": db.query(EmailSignature).filter(EmailSignature.tenant_id == tenant_id).count(),
            "email_threads": db.query(EmailThread).filter(EmailThread.tenant_id == tenant_id).count(),
            "tasks": db.query(Task).filter(Task.tenant_id == tenant_id).count(),
            "contacts": db.query(Contact).filter(Contact.tenant_id == tenant_id).count(),
            "companies": db.query(Company).filter(Company.tenant_id == tenant_id).count(),
            "users": db.query(User).filter(User.tenant_id == tenant_id).count(),
        }
        
        # Delete email messages (via email threads)
        email_thread_ids = [t.id for t in db.query(EmailThread).filter(EmailThread.tenant_id == tenant_id).all()]
        if email_thread_ids:
            counts["email_messages"] = db.query(EmailMessage).filter(EmailMessage.thread_id.in_(email_thread_ids)).count()
            db.query(EmailMessage).filter(EmailMessage.thread_id.in_(email_thread_ids)).delete(synchronize_session=False)
        else:
            counts["email_messages"] = 0
        
        # Delete attachments (via companies)
        company_ids = [c.id for c in db.query(Company).filter(Company.tenant_id == tenant_id).all()]
        if company_ids:
            counts["attachments"] = db.query(Attachment).filter(Attachment.company_id.in_(company_ids)).count()
            db.query(Attachment).filter(Attachment.company_id.in_(company_ids)).delete(synchronize_session=False)
        else:
            counts["attachments"] = 0
        
        # Delete in order, handling foreign key constraints
        db.query(Activity).filter(Activity.tenant_id == tenant_id).delete()
        db.query(UserInvite).filter(UserInvite.tenant_id == tenant_id).delete()
        db.query(EmailSignature).filter(EmailSignature.tenant_id == tenant_id).delete()
        db.query(EmailThread).filter(EmailThread.tenant_id == tenant_id).delete()
        db.query(Task).filter(Task.tenant_id == tenant_id).delete()
        db.query(Contact).filter(Contact.tenant_id == tenant_id).delete()
        db.query(Company).filter(Company.tenant_id == tenant_id).delete()
        
        # Handle the circular reference: clear created_by before deleting users
        db.query(Tenant).filter(Tenant.id == tenant_id).update({"created_by": None})
        db.commit()  # Commit this change first
        
        # Now we can delete users
        db.query(User).filter(User.tenant_id == tenant_id).delete()
        
        # Finally delete the tenant
        db.query(Tenant).filter(Tenant.id == tenant_id).delete()
        
        # Commit all changes
        db.commit()
        
        return {
            "message": f"Tenant '{tenant_slug}' and all associated data deleted successfully",
            "tenant_id": tenant_id,
            "deleted_records": counts
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete tenant: {str(e)}"
        )

@app.delete("/api/admin/cleanup/all")
async def cleanup_all_data(confirm: str = None, db: Session = Depends(get_db)):
    """
    Nuclear option: Delete ALL data from ALL tenants
    WARNING: This permanently deletes everything
    You must pass confirm=DELETE_EVERYTHING as a query parameter
    """
    if confirm != "DELETE_EVERYTHING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must pass confirm=DELETE_EVERYTHING as a query parameter to confirm this destructive action"
        )
    
    try:
        # Count all records before deletion
        counts = {
            "activities": db.query(Activity).count(),
            "user_invites": db.query(UserInvite).count(),
            "email_signatures": db.query(EmailSignature).count(),
            "email_messages": db.query(EmailMessage).count(),
            "email_threads": db.query(EmailThread).count(),
            "attachments": db.query(Attachment).count(),
            "tasks": db.query(Task).count(),
            "contacts": db.query(Contact).count(),
            "companies": db.query(Company).count(),
            "users": db.query(User).count(),
            "tenants": db.query(Tenant).count(),
        }
        
        # Delete everything
        db.query(Activity).delete()
        db.query(UserInvite).delete()
        db.query(EmailSignature).delete()
        db.query(EmailMessage).delete()
        db.query(EmailThread).delete()
        db.query(Attachment).delete()
        db.query(Task).delete()
        db.query(Contact).delete()
        db.query(Company).delete()
        db.query(User).delete()
        db.query(Tenant).delete()
        
        # Commit all changes
        db.commit()
        
        return {
            "message": "ALL data deleted successfully",
            "deleted_records": counts
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete all data: {str(e)}"
        )

@app.get("/api/admin/tenants")
async def list_all_tenants(db: Session = Depends(get_db)):
    """List all tenants for admin purposes"""
    tenants = db.query(Tenant).all()
    return [
        {
            "id": t.id,
            "slug": t.slug,
            "name": t.name,
            "created_at": t.created_at,
            "user_count": db.query(User).filter(User.tenant_id == t.id).count(),
            "company_count": db.query(Company).filter(Company.tenant_id == t.id).count(),
            "contact_count": db.query(Contact).filter(Contact.tenant_id == t.id).count(),
        }
        for t in tenants
    ]

# Pipeline Stage endpoints
@app.get("/api/pipeline/stages", response_model=List[PipelineStageResponse])
async def get_stages(
    include_inactive: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all pipeline stages for the organization"""
    stages = get_pipeline_stages(db, current_user.organization_id, include_inactive)
    
    # Add deal counts
    for stage in stages:
        stage.deal_count = db.query(Deal).filter(
            Deal.stage_id == stage.id,
            Deal.is_active == True
        ).count()
    
    return stages

@app.post("/api/pipeline/stages", response_model=PipelineStageResponse)
async def create_stage(
    stage: PipelineStageCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new pipeline stage"""
    db_stage = create_pipeline_stage(db, stage, current_user.organization_id)
    
    # Create activity log
    create_activity(
        db,
        title="Pipeline Stage Created",
        description=f"Created pipeline stage: {stage.name}",
        type="pipeline",
        organization_id=current_user.organization_id
    )
    
    return db_stage

@app.get("/api/pipeline/stages/{stage_id}", response_model=PipelineStageResponse)
async def get_stage(
    stage_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific pipeline stage"""
    stage = get_pipeline_stage(db, stage_id, current_user.organization_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Pipeline stage not found")
    
    # Add deal count
    stage.deal_count = db.query(Deal).filter(
        Deal.stage_id == stage.id,
        Deal.is_active == True
    ).count()
    
    return stage

@app.put("/api/pipeline/stages/{stage_id}", response_model=PipelineStageResponse)
async def update_stage(
    stage_id: int,
    stage_update: PipelineStageUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a pipeline stage"""
    db_stage = update_pipeline_stage(db, stage_id, stage_update, current_user.organization_id)
    if not db_stage:
        raise HTTPException(status_code=404, detail="Pipeline stage not found")
    
    return db_stage

@app.delete("/api/pipeline/stages/{stage_id}")
async def delete_stage(
    stage_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a pipeline stage"""
    success = delete_pipeline_stage(db, stage_id, current_user.organization_id)
    if not success:
        raise HTTPException(status_code=404, detail="Pipeline stage not found")
    
    return {"message": "Pipeline stage deleted successfully"}

@app.post("/api/pipeline/stages/initialize")
async def initialize_default_stages(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create default pipeline stages for the organization"""
    # Check if stages already exist
    existing_stages = get_pipeline_stages(db, current_user.organization_id)
    if existing_stages:
        raise HTTPException(status_code=400, detail="Pipeline stages already exist")
    
    stages = create_default_pipeline_stages(db, current_user.organization_id)
    return {"message": f"Created {len(stages)} default pipeline stages", "stages": stages}

# Deal endpoints
@app.get("/api/deals", response_model=List[DealResponse])
async def get_organization_deals(
    skip: int = 0,
    limit: int = 100,
    stage_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    company_id: Optional[int] = None,
    assigned_to: Optional[int] = None,
    include_inactive: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all deals for the organization"""
    deals = get_deals(
        db, current_user.organization_id, skip, limit,
        stage_id, contact_id, company_id, assigned_to, include_inactive
    )
    
    # Populate related names
    for deal in deals:
        # Stage info
        if deal.stage:
            deal.stage_name = deal.stage.name
            deal.stage_color = deal.stage.color
        
        # Contact info
        if deal.contact:
            deal.contact_name = f"{deal.contact.first_name} {deal.contact.last_name}".strip()
        
        # Company info
        if deal.company:
            deal.company_name = deal.company.name
        
        # Creator info
        if deal.creator:
            deal.creator_name = f"{deal.creator.first_name} {deal.creator.last_name}".strip()
        
        # Assignee info
        if deal.assignee:
            deal.assignee_name = f"{deal.assignee.first_name} {deal.assignee.last_name}".strip()
    
    return deals

@app.post("/api/deals", response_model=DealResponse)
async def create_new_deal(
    deal: DealCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new deal"""
    # Verify stage exists
    stage = get_pipeline_stage(db, deal.stage_id, current_user.organization_id)
    if not stage:
        raise HTTPException(status_code=400, detail="Invalid stage_id")
    
    db_deal = create_deal(db, deal, current_user.organization_id, current_user.id)
    return db_deal

@app.get("/api/deals/{deal_id}", response_model=DealResponse)
async def get_deal_by_id(
    deal_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific deal"""
    deal = get_deal(db, deal_id, current_user.organization_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Populate related names (same as above)
    if deal.stage:
        deal.stage_name = deal.stage.name
        deal.stage_color = deal.stage.color
    if deal.contact:
        deal.contact_name = f"{deal.contact.first_name} {deal.contact.last_name}".strip()
    if deal.company:
        deal.company_name = deal.company.name
    if deal.creator:
        deal.creator_name = f"{deal.creator.first_name} {deal.creator.last_name}".strip()
    if deal.assignee:
        deal.assignee_name = f"{deal.assignee.first_name} {deal.assignee.last_name}".strip()
    
    return deal

@app.put("/api/deals/{deal_id}", response_model=DealResponse)
async def update_deal_by_id(
    deal_id: int,
    deal_update: DealUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a deal"""
    # Verify stage exists if being updated
    if deal_update.stage_id:
        stage = get_pipeline_stage(db, deal_update.stage_id, current_user.organization_id)
        if not stage:
            raise HTTPException(status_code=400, detail="Invalid stage_id")
    
    db_deal = update_deal(db, deal_id, deal_update, current_user.organization_id)
    if not db_deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    return db_deal

@app.delete("/api/deals/{deal_id}")
async def delete_deal_by_id(
    deal_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a deal"""
    success = delete_deal(db, deal_id, current_user.organization_id)
    if not success:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    return {"message": "Deal deleted successfully"}


# Email Tracking endpoints
@app.post("/api/email-tracking/webhook")
async def process_sendgrid_webhook(
    event: SendGridEvent,
    db: Session = Depends(get_db)
):
    """Process SendGrid webhook events"""
    try:
        # Find the email tracking record by message ID
        tracking = db.query(EmailTracking).filter(
            EmailTracking.message_id == event.sg_message_id
        ).first()
        
        if not tracking:
            # Create a new tracking record if it doesn't exist
            # This might happen if the webhook arrives before our tracking record is created
            print(f"Email tracking not found for message ID: {event.sg_message_id}")
            return {"status": "skipped", "reason": "tracking_not_found"}
        
        # Create event record
        email_event = EmailEvent(
            tracking_id=tracking.id,
            event_type=event.event,
            timestamp=datetime.fromtimestamp(event.timestamp),
            ip_address=event.ip,
            user_agent=event.useragent,
            url=event.url,
            raw_data=event.dict()
        )
        db.add(email_event)
        
        # Update tracking metrics based on event type
        if event.event == "open":
            tracking.open_count += 1
            if not tracking.opened_at:
                tracking.opened_at = datetime.fromtimestamp(event.timestamp)
                
        elif event.event == "click":
            tracking.click_count += 1
            if not tracking.first_clicked_at:
                tracking.first_clicked_at = datetime.fromtimestamp(event.timestamp)
        
        db.commit()
        
        return {"status": "processed", "event_type": event.event}
        
    except Exception as e:
        print(f"Error processing SendGrid webhook: {str(e)}")
        db.rollback()
        # Return success to prevent SendGrid from retrying
        return {"status": "error", "message": str(e)}


@app.post("/api/email-tracking", response_model=EmailTrackingResponse)
async def create_email_tracking(
    tracking: EmailTrackingCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create email tracking record when sending an email"""
    db_tracking = EmailTracking(
        organization_id=current_user.organization_id,
        **tracking.dict()
    )
    db.add(db_tracking)
    db.commit()
    db.refresh(db_tracking)
    
    # Populate response fields
    db_tracking.sender_name = f"{current_user.first_name} {current_user.last_name}"
    if db_tracking.contact_id:
        contact = db.query(Contact).filter(Contact.id == db_tracking.contact_id).first()
        if contact:
            db_tracking.contact_name = f"{contact.first_name} {contact.last_name}"
    
    return db_tracking


@app.get("/api/email-tracking", response_model=List[EmailTrackingResponse])
async def get_email_tracking_list(
    skip: int = 0,
    limit: int = 100,
    contact_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get email tracking records for the organization"""
    query = db.query(EmailTracking).filter(
        EmailTracking.organization_id == current_user.organization_id
    )
    
    if contact_id:
        query = query.filter(EmailTracking.contact_id == contact_id)
    
    trackings = query.order_by(EmailTracking.sent_at.desc()).offset(skip).limit(limit).all()
    
    # Populate response fields
    for tracking in trackings:
        sender = db.query(User).filter(User.id == tracking.sent_by).first()
        if sender:
            tracking.sender_name = f"{sender.first_name} {sender.last_name}"
        
        if tracking.contact_id:
            contact = db.query(Contact).filter(Contact.id == tracking.contact_id).first()
            if contact:
                tracking.contact_name = f"{contact.first_name} {contact.last_name}"
    
    return trackings


@app.get("/api/email-tracking/{tracking_id}", response_model=EmailTrackingResponse)
async def get_email_tracking(
    tracking_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get specific email tracking record with events"""
    tracking = db.query(EmailTracking).filter(
        EmailTracking.id == tracking_id,
        EmailTracking.organization_id == current_user.organization_id
    ).first()
    
    if not tracking:
        raise HTTPException(status_code=404, detail="Email tracking not found")
    
    # Populate response fields
    sender = db.query(User).filter(User.id == tracking.sent_by).first()
    if sender:
        tracking.sender_name = f"{sender.first_name} {sender.last_name}"
    
    if tracking.contact_id:
        contact = db.query(Contact).filter(Contact.id == tracking.contact_id).first()
        if contact:
            tracking.contact_name = f"{contact.first_name} {contact.last_name}"
    
    return tracking


@app.get("/api/email-tracking/{tracking_id}/events", response_model=List[EmailEventResponse])
async def get_email_events(
    tracking_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all events for a specific email"""
    # Verify the tracking record belongs to the user's organization
    tracking = db.query(EmailTracking).filter(
        EmailTracking.id == tracking_id,
        EmailTracking.organization_id == current_user.organization_id
    ).first()
    
    if not tracking:
        raise HTTPException(status_code=404, detail="Email tracking not found")
    
    events = db.query(EmailEvent).filter(
        EmailEvent.tracking_id == tracking_id
    ).order_by(EmailEvent.timestamp.desc()).all()
    
    return events


# Email Thread endpoints
@app.get("/api/email-threads", response_model=List[EmailThreadResponse])
async def get_email_threads_list(
    skip: int = 0,
    limit: int = 100,
    contact_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get email threads for the organization"""
    threads = get_email_threads(
        db, 
        current_user.organization_id,
        skip=skip,
        limit=limit,
        contact_id=contact_id
    )
    return threads


@app.post("/api/email-threads", response_model=EmailThreadResponse)
async def create_email_thread_endpoint(
    thread: EmailThreadCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new email thread"""
    db_thread = create_email_thread(
        db=db,
        thread=thread,
        organization_id=current_user.organization_id
    )
    return db_thread


@app.post("/api/email-threads/{thread_id}/messages", response_model=EmailMessageResponse)
async def add_message_to_thread(
    thread_id: int,
    message: EmailMessageCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add a message to an email thread"""
    # Verify thread belongs to organization
    thread = db.query(EmailThread).filter(
        EmailThread.id == thread_id,
        EmailThread.organization_id == current_user.organization_id
    ).first()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Email thread not found")
    
    db_message = add_email_message(
        db,
        thread_id,
        message,
        current_user.organization_id
    )
    return db_message


@app.get("/api/contacts/{contact_id}/email-threads", response_model=List[EmailThreadResponse])
async def get_contact_email_threads(
    contact_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all email threads for a specific contact"""
    # Verify contact belongs to organization
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.organization_id == current_user.organization_id
    ).first()
    
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    threads = get_email_threads(
        db,
        current_user.organization_id,
        contact_id=contact_id
    )
    return threads


# Office 365 Integration Endpoints
@app.get("/api/o365/auth/url")
async def get_o365_auth_url(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get O365 OAuth URL for user authorization"""
    # Check if organization has O365 configured
    org_config = get_o365_org_config(db, current_user.organization_id)
    
    # Use environment variables as fallback if no org config
    if not org_config or not org_config.client_id:
        # Check for environment variables
        env_client_id = os.environ.get("O365_CLIENT_ID")
        env_tenant_id = os.environ.get("O365_TENANT_ID")
        
        if not env_client_id or not env_tenant_id:
            raise HTTPException(
                status_code=400, 
                detail="Office 365 integration not configured for your organization"
            )
        
        # Use environment variables
        client_id = env_client_id
        tenant_id = env_tenant_id
    else:
        # Use org config
        client_id = org_config.client_id
        tenant_id = org_config.tenant_id
    
    redirect_uri = os.environ.get("O365_REDIRECT_URI", "https://nohubspot-production.up.railway.app/api/auth/microsoft/callback")
    auth_url = await get_oauth_url(
        client_id,
        tenant_id,
        redirect_uri
    )
    
    return {"auth_url": auth_url}


@app.post("/api/o365/auth/callback")
async def o365_auth_callback(
    code: str,
    state: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Handle O365 OAuth callback"""
    # Get org config
    org_config = get_o365_org_config(db, current_user.organization_id)
    
    # Determine configuration source
    if not org_config or not org_config.client_id:
        # Use environment variables
        env_client_id = os.environ.get("O365_CLIENT_ID")
        env_tenant_id = os.environ.get("O365_TENANT_ID")
        env_client_secret = os.environ.get("O365_CLIENT_SECRET")
        
        if not all([env_client_id, env_tenant_id, env_client_secret]):
            raise HTTPException(status_code=400, detail="O365 not configured")
        
        client_id = env_client_id
        tenant_id = env_tenant_id
        client_secret = env_client_secret
        org_config_id = None
    else:
        # Use org config
        client_id = org_config.client_id
        tenant_id = org_config.tenant_id
        client_secret = decrypt_client_secret(org_config.client_secret_encrypted)
        org_config_id = org_config.id
    
    try:
        # Exchange code for tokens
        redirect_uri = os.environ.get("O365_REDIRECT_URI", "https://nohubspot-production.up.railway.app/api/auth/microsoft/callback")
        
        token_data = await exchange_code_for_tokens(
            code,
            client_id,
            client_secret,
            tenant_id,
            redirect_uri
        )
        
        # Create or update user connection
        existing = db.query(O365UserConnection).filter(
            O365UserConnection.user_id == current_user.id
        ).first()
        
        if existing:
            # Update existing connection
            existing.access_token_encrypted = encrypt_access_token(token_data["access_token"])
            existing.refresh_token_encrypted = encrypt_refresh_token(token_data["refresh_token"])
            existing.token_expires_at = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))
            existing.scopes_granted = token_data.get("scope", "").split(" ")
            existing.is_active = True
            connection = existing
        else:
            # Create new connection
            connection = O365UserConnection(
                user_id=current_user.id,
                organization_id=current_user.organization_id,
                org_config_id=org_config_id,  # Can be None if using env vars
                o365_user_id=token_data.get("user_id", ""),
                o365_email=current_user.email,  # Will be updated after getting user info
                o365_display_name=f"{current_user.first_name} {current_user.last_name}",
                access_token_encrypted=encrypt_access_token(token_data["access_token"]),
                refresh_token_encrypted=encrypt_refresh_token(token_data["refresh_token"]),
                token_expires_at=datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600)),
                scopes_granted=token_data.get("scope", "").split(" "),
                is_active=True
            )
            db.add(connection)
        
        db.commit()
        
        # Get user info from Microsoft Graph
        # Create a dummy org_config if using env vars
        if not org_config:
            from models import O365OrganizationConfig
            org_config = O365OrganizationConfig(
                id=0,
                organization_id=current_user.organization_id,
                client_id=client_id,
                tenant_id=tenant_id,
                client_secret_encrypted=encrypt_client_secret(client_secret)
            )
        
        async with O365Service(connection, org_config) as service:
            user_info = await service.get_user_info()
            connection.o365_user_id = user_info.get("id", "")
            connection.o365_email = user_info.get("mail") or user_info.get("userPrincipalName", "")
            connection.o365_display_name = user_info.get("displayName", "")
            db.commit()
        
        return {
            "success": True,
            "message": "Successfully connected to Office 365",
            "email": connection.o365_email
        }
        
    except Exception as e:
        print(f"O365 auth callback error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/auth/microsoft/callback")
async def microsoft_oauth_callback_redirect(
    request: Request,
    code: str = None,
    state: str = None,
    error: str = None,
    error_description: str = None
):
    """Handle O365 OAuth callback and redirect to frontend"""
    # Log the incoming request for debugging
    print(f"Microsoft OAuth callback received:")
    print(f"  Code: {code}")
    print(f"  State: {state}")
    print(f"  Error: {error}")
    print(f"  Query params: {dict(request.query_params)}")
    
    # Build the frontend URL with all parameters
    frontend_url = os.environ.get("FRONTEND_URL", "https://nothubspot.app")
    
    # If no code and no error, something went wrong
    if not code and not error:
        error = "missing_code"
        error_description = "No authorization code received from Microsoft"
    
    # Use urllib to properly encode parameters
    from urllib.parse import urlencode
    params = {}
    if code:
        params["code"] = code
    if state:
        params["state"] = state
    if error:
        params["error"] = error
    if error_description:
        params["error_description"] = error_description
    
    # Redirect to frontend callback page
    query_string = urlencode(params)
    redirect_url = f"{frontend_url}/auth/microsoft/callback{'?' + query_string if query_string else ''}"
    print(f"Redirecting to: {redirect_url}")
    
    return RedirectResponse(url=redirect_url)


@app.get("/api/o365/status")
async def get_o365_connection_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's O365 connection status"""
    connection = db.query(O365UserConnection).filter(
        O365UserConnection.user_id == current_user.id
    ).first()
    
    if not connection:
        return {
            "connected": False,
            "message": "No Office 365 connection found"
        }
    
    return {
        "connected": connection.is_active,
        "email": connection.o365_email,
        "display_name": connection.o365_display_name,
        "last_sync": connection.last_sync_at,
        "sync_enabled": connection.sync_email_enabled
    }


@app.post("/api/o365/sync")
async def sync_o365_emails(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Manually trigger O365 email sync"""
    connection = db.query(O365UserConnection).filter(
        O365UserConnection.user_id == current_user.id,
        O365UserConnection.is_active == True
    ).first()
    
    if not connection:
        raise HTTPException(status_code=400, detail="No active O365 connection")
    
    org_config = get_o365_org_config(db, current_user.organization_id)
    if not org_config:
        raise HTTPException(status_code=400, detail="O365 not configured")
    
    try:
        async with O365Service(connection, org_config) as service:
            synced_count = await service.sync_emails_to_crm(
                db, 
                current_user.organization_id,
                since=connection.last_sync_at
            )
            db.commit()
            
        return {
            "success": True,
            "synced_count": synced_count,
            "last_sync": connection.last_sync_at
        }
        
    except Exception as e:
        print(f"O365 sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/o365/disconnect")
async def disconnect_o365(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Disconnect O365 integration"""
    connection = db.query(O365UserConnection).filter(
        O365UserConnection.user_id == current_user.id
    ).first()
    
    if connection:
        db.delete(connection)
        db.commit()
        
    return {"success": True, "message": "Office 365 disconnected"}


# Inbound email webhook
@app.post("/api/webhooks/inbound-email")
async def process_inbound_email(
    request: Request,
    db: Session = Depends(get_db)
):
    """Process inbound emails from SendGrid"""
    # Verify webhook secret if configured
    webhook_secret = os.environ.get("SENDGRID_WEBHOOK_SECRET", "")
    if webhook_secret:
        provided_secret = request.headers.get("X-Webhook-Secret", "")
        if provided_secret != webhook_secret:
            raise HTTPException(status_code=401, detail="Invalid webhook secret")
    
    body = await request.json()
    
    from_email = body.get("from_email", "")
    to_email = body.get("to_email", "")
    subject = body.get("subject", "")
    content = body.get("content", "")
    
    print(f"Processing inbound email from {from_email} to {to_email}")
    
    # Find contact by email
    contact = db.query(Contact).filter(
        Contact.email == from_email
    ).first()
    
    if not contact:
        print(f"No contact found for email {from_email}, creating new contact")
        # Extract name from email if possible
        email_parts = from_email.split('@')[0].split('.')
        first_name = email_parts[0].title() if email_parts else "Unknown"
        last_name = email_parts[1].title() if len(email_parts) > 1 else "Contact"
        
        # Create contact - find first organization (improve this later)
        first_org = db.query(Organization).first()
        if not first_org:
            return {"error": "No organization found to assign contact"}
        
        contact = Contact(
            first_name=first_name,
            last_name=last_name,
            email=from_email,
            organization_id=first_org.id,
            status="Active"
        )
        db.add(contact)
        db.commit()
        db.refresh(contact)
    
    # Find or create email thread
    threads = db.query(EmailThread).filter(
        EmailThread.contact_id == contact.id,
        EmailThread.organization_id == contact.organization_id
    ).all()
    
    # Look for existing thread with same subject
    thread = None
    clean_subject = subject.replace("Re: ", "").replace("RE: ", "").strip()
    for t in threads:
        if t.subject.replace("Re: ", "").replace("RE: ", "").strip() == clean_subject:
            thread = t
            break
    
    if not thread:
        # Create new thread
        thread = EmailThread(
            subject=subject,
            contact_id=contact.id,
            organization_id=contact.organization_id,
            message_count=0
        )
        db.add(thread)
        db.commit()
        db.refresh(thread)
    
    # Add message to thread
    message = EmailMessage(
        thread_id=thread.id,
        sender=f"{contact.first_name} {contact.last_name}",
        content=content,
        direction="incoming",
        message_id=f"inbound_{int(time.time())}_{thread.id}"
    )
    db.add(message)
    
    # Update thread
    thread.message_count += 1
    thread.preview = content[:100] + ("..." if len(content) > 100 else "")
    thread.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "success": True,
        "thread_id": thread.id,
        "message_id": message.id,
        "contact_id": contact.id
    }


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"🚀 Starting NotHubSpot CRM API on port {port}")
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=port,
        reload=False,  # Disable reload in production
        log_level="info"
    )
