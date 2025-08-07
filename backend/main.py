from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, status, Request
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import text, or_
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
import models
from models import Base, Company, Contact, Task, EmailThread, EmailMessage, Attachment, Activity, EmailSignature, Organization, User, UserInvite, PasswordResetToken, CalendarEvent, EventAttendee, O365OrganizationConfig, O365UserConnection, GoogleOrganizationConfig, GoogleUserConnection, PipelineStage, Deal, EmailTracking, EmailEvent, EmailSharingPermission, ProjectStage, Project, ProjectType, ProjectUpdate, DealUpdate
from schemas import (
    CompanyCreate, CompanyResponse, CompanyUpdate, CompanyPaginatedResponse,
    ContactCreate, ContactResponse, ContactUpdate,
    TaskCreate, TaskResponse, TaskUpdate,
    EmailThreadCreate, EmailThreadResponse,
    EmailMessageCreate, EmailMessageResponse, AttachmentCreate, AttachmentResponse,
    EmailSignatureCreate, EmailSignatureResponse, EmailSignatureUpdate,
    ActivityResponse, DashboardStats, BulkUploadResult,
    OrganizationCreate, OrganizationResponse, UserRegister, UserLogin, UserResponse, UserCreate,
    UserInviteCreate, UserInviteResponse, UserInviteAccept, Token,
    UserAdd, UserAddResponse,
    ProjectUpdateResponse, ProjectUpdateCreate, ProjectUpdateUpdate,
    DealUpdateResponse, DealUpdateCreate, DealUpdateUpdate,
    EmailTemplateCreate, EmailTemplateResponse, EmailTemplateUpdate,
    CalendarEventCreate, CalendarEventResponse, CalendarEventUpdate,
    EventAttendeeCreate, EventAttendeeResponse,
    PasswordResetRequest, PasswordResetConfirm, PasswordResetResponse,
    O365OrganizationConfigCreate, O365OrganizationConfigUpdate, O365OrganizationConfigResponse,
    O365UserConnectionUpdate, O365UserConnectionResponse,
    O365TestConnectionRequest, O365TestConnectionResponse,
    GoogleOrganizationConfigCreate, GoogleOrganizationConfigUpdate, GoogleOrganizationConfigResponse,
    GoogleUserConnectionUpdate, GoogleUserConnectionResponse,
    GoogleTestConnectionRequest, GoogleTestConnectionResponse,
    PipelineStageCreate, PipelineStageResponse, PipelineStageUpdate,
    DealCreate, DealResponse, DealUpdate,
    ProjectStageCreate, ProjectStageResponse, ProjectStageUpdate,
    ProjectCreate, ProjectResponse, ProjectUpdate, PROJECT_TYPES,
    ProjectTypeCreate, ProjectTypeResponse, ProjectTypeUpdate,
    EmailTrackingCreate, EmailTrackingResponse, EmailEventCreate, EmailEventResponse, SendGridEvent,
    ContactPrivacyUpdate, EmailThreadSharingUpdate, EmailSharingPermissionCreate, EmailSharingPermissionResponse,
    EmailPrivacySettings, EmailPrivacySettingsUpdate
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
    get_google_org_config, create_google_org_config, update_google_org_config, delete_google_org_config,
    get_google_user_connection, get_google_user_connections_by_org, update_google_user_connection, delete_google_user_connection,
    create_pipeline_stage, get_pipeline_stages, get_pipeline_stage, update_pipeline_stage, delete_pipeline_stage, create_default_pipeline_stages,
    create_deal, get_deals, get_deal, update_deal, delete_deal,
    create_project_stage, get_project_stages, get_project_stage, update_project_stage, delete_project_stage,
    create_project, get_projects, get_project, update_project, delete_project,
    get_project_types, get_project_type, create_project_type, update_project_type, delete_project_type,
    recalculate_all_contact_counts, sync_contact_company_names
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
from password_utils import generate_temporary_password
from ai_chat import process_ai_chat
from o365_service import O365Service, get_oauth_url, exchange_code_for_tokens
from o365_encryption import encrypt_access_token, encrypt_refresh_token, decrypt_client_secret, encrypt_client_secret
from run_migrations import run_migrations
from cleanup_routes import router as cleanup_router

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
    
    # Run SQL migrations
    run_migrations()
    
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

# Initialize background scheduler
from scheduler import init_scheduler, shutdown_scheduler
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan"""
    # Startup
    init_scheduler()
    yield
    # Shutdown
    shutdown_scheduler()

app = FastAPI(
    title="NotHubSpot CRM API",
    description="Backend API for NotHubSpot CRM - The HubSpot Alternative",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware configured for your deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins temporarily
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Additional middleware to ensure CORS headers on errors
@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        # Add CORS headers to all responses
        origin = request.headers.get("origin")
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response
    except Exception as e:
        # Return error with CORS headers
        origin = request.headers.get("origin", "*")
        return JSONResponse(
            status_code=500,
            content={"detail": str(e)},
            headers={
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true"
            }
        )

# Include cleanup router (temporary)
app.include_router(cleanup_router)

# Debug endpoint for invitations (temporary)
@app.get("/api/debug/invitations")
async def debug_invitations(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Debug endpoint to check all invitations (admin only)"""
    invites = db.query(UserInvite).filter(
        UserInvite.organization_id == current_user.organization_id
    ).all()
    
    return {
        "organization_id": current_user.organization_id,
        "invitations": [
            {
                "id": invite.id,
                "email": invite.email,
                "status": invite.status,
                "role": invite.role,
                "created_at": invite.created_at.isoformat() if invite.created_at else None,
                "expires_at": invite.expires_at.isoformat() if invite.expires_at else None
            }
            for invite in invites
        ]
    }

# Debug endpoint to test SendGrid (temporary)
@app.post("/api/debug/test-sendgrid")
async def test_sendgrid(
    current_user: User = Depends(get_current_admin_user)
):
    """Test SendGrid configuration by sending a test email to the current user"""
    from email_service import send_email
    
    # Check if SendGrid is configured
    sendgrid_key = os.environ.get("SENDGRID_API_KEY", "")
    if not sendgrid_key:
        return {
            "success": False,
            "error": "SENDGRID_API_KEY not configured",
            "details": "Please set SENDGRID_API_KEY in environment variables"
        }
    
    # Send test email
    test_subject = "Test Email from NotHubSpot"
    test_html = f"""
    <h2>SendGrid Test Email</h2>
    <p>Hi {current_user.first_name},</p>
    <p>This is a test email to verify SendGrid is working correctly.</p>
    <p>If you received this email, SendGrid is properly configured!</p>
    <hr>
    <p><small>Sent at: {datetime.utcnow().isoformat()}</small></p>
    """
    test_text = f"""SendGrid Test Email

Hi {current_user.first_name},

This is a test email to verify SendGrid is working correctly.

If you received this email, SendGrid is properly configured!

Sent at: {datetime.utcnow().isoformat()}"""
    
    success = await send_email(
        to_email=current_user.email,
        subject=test_subject,
        html_content=test_html,
        text_content=test_text
    )
    
    return {
        "success": success,
        "message": f"Test email {'sent' if success else 'failed'} to {current_user.email}",
        "sendgrid_configured": bool(sendgrid_key),
        "from_email": os.environ.get("SENDGRID_FROM_EMAIL", "noreply@nothubspot.app")
    }

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

@app.get("/api/health/users")  # Railway healthcheck endpoint
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
            to_email=user.email,
            user_name=f"{user.first_name} {user.last_name}" if user.first_name else user.email.split('@')[0],
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
    print(f"Creating invitation for: {invite.email} by user: {current_user.email}")
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
    
    # Find the organization owner to CC on the invitation
    owner_email = None
    owner = db.query(User).filter(
        User.organization_id == current_user.organization_id,
        User.role == "owner"
    ).first()
    
    if owner:
        owner_email = owner.email
        print(f"CC'ing organization owner: {owner_email}")
    
    # Send the invitation email
    inviter_name = f"{current_user.first_name} {current_user.last_name}"
    email_sent = await send_invite_email(
        user_email=invite.email,
        organization_name=organization.name,
        inviter_name=inviter_name,
        invite_url=invite_url,
        role=invite.role,
        cc_owner_email=owner_email
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

@app.get("/api/invites/validate/{code}")
async def validate_invite(code: str, db: Session = Depends(get_db)):
    """Validate an invitation code and return details"""
    invite = db.query(UserInvite).filter(
        UserInvite.invite_code == code,
        UserInvite.status == "pending"
    ).first()
    
    if not invite:
        raise HTTPException(
            status_code=404,
            detail="Invalid or expired invitation"
        )
    
    # Get organization details
    organization = db.query(Organization).filter(
        Organization.id == invite.organization_id
    ).first()
    
    return {
        "valid": True,
        "email": invite.email,
        "organization": organization.name,
        "role": invite.role
    }

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
    # First check if the invite exists at all
    invite = db.query(UserInvite).filter(UserInvite.id == invite_id).first()
    
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invitation with ID {invite_id} not found"
        )
    
    # Check if it belongs to the user's organization
    if invite.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot revoke invitations from other organizations"
        )
    
    # Check if it's already processed
    if invite.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot revoke invitation with status '{invite.status}'. Only pending invitations can be revoked."
        )
    
    # Now try to revoke it
    success = revoke_invite(db, invite_id, current_user.organization_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke invitation"
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

# Add user directly (replaces invite system)
@app.post("/api/users/add", response_model=UserAddResponse)
async def add_user_directly(
    user_data: UserAdd,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Add a user directly to the organization with a temporary password"""
    # Check if user already exists
    existing_user = get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists"
        )
    
    # Generate temporary password
    temp_password = generate_temporary_password()
    
    # Create the user
    try:
        # Create UserCreate object
        user_create = UserCreate(
            email=user_data.email,
            password=temp_password,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            role=user_data.role
        )
        
        new_user = create_user(
            db=db,
            user=user_create,
            organization_id=current_user.organization_id
        )
        
        # Pre-verify the email since admin is creating
        new_user.email_verified = True
        db.commit()
        
        # Send welcome email with temporary password
        await send_welcome_email(
            to_email=new_user.email,
            user_name=f"{new_user.first_name} {new_user.last_name}",
            organization_name=current_user.organization.name,
            temporary_password=temp_password,
            added_by=f"{current_user.first_name} {current_user.last_name}"
        )
        
        return UserAddResponse(
            user=new_user,
            temporary_password=temp_password,
            message=f"User {new_user.email} added successfully. Welcome email sent with temporary password."
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add user: {str(e)}"
        )

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

# Google Workspace Integration endpoints
# Organization-level configuration endpoints removed - using centralized OAuth only

@app.get("/api/settings/google/user", response_model=GoogleUserConnectionResponse)
async def get_user_google_connection(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's Google Workspace connection"""
    connection = get_google_user_connection(db, current_user.id)
    if not connection:
        raise HTTPException(status_code=404, detail="Google Workspace connection not found")
    
    return connection

@app.put("/api/settings/google/user", response_model=GoogleUserConnectionResponse)
async def update_user_google_connection(
    connection_update: GoogleUserConnectionUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update current user's Google Workspace connection preferences"""
    connection = update_google_user_connection(db, current_user.id, connection_update)
    if not connection:
        raise HTTPException(status_code=404, detail="Google Workspace connection not found")
    
    return connection

@app.delete("/api/settings/google/user")
async def disconnect_user_google_connection(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Disconnect current user's Google Workspace connection"""
    success = delete_google_user_connection(db, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Google Workspace connection not found")
    
    return {"message": "Google Workspace connection disconnected successfully"}

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

@app.get("/api/companies", response_model=CompanyPaginatedResponse)
async def read_companies(
    skip: int = 0, 
    limit: int = 100, 
    search: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "asc",
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Get companies
    companies = get_companies(db, current_user.organization_id, skip=skip, limit=limit, search=search, status=status, sort_by=sort_by, sort_order=sort_order)
    
    # Get total count - we need to create a count function
    from sqlalchemy import func
    query = db.query(func.count(Company.id)).filter(Company.organization_id == current_user.organization_id)
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Company.name.ilike(search_filter),
                Company.industry.ilike(search_filter),
                Company.website.ilike(search_filter)
            )
        )
    
    if status:
        query = query.filter(Company.status == status)
    
    total = query.scalar()
    
    # Calculate pagination info
    page = (skip // limit) + 1
    pages = (total + limit - 1) // limit  # Ceiling division
    
    return CompanyPaginatedResponse(
        items=companies,
        total=total,
        page=page,
        per_page=limit,
        pages=pages
    )

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


# Project Stage endpoints
@app.get("/api/projects/stages", response_model=List[ProjectStageResponse])
async def get_project_stages_endpoint(
    include_inactive: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all project stages for the organization"""
    stages = get_project_stages(db, current_user.organization_id)
    
    # Add project counts
    for stage in stages:
        stage.project_count = db.query(Project).filter(
            Project.stage_id == stage.id,
            Project.is_active == True
        ).count()
    
    return stages

@app.post("/api/projects/stages", response_model=ProjectStageResponse)
async def create_project_stage_endpoint(
    stage: ProjectStageCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new project stage"""
    db_stage = create_project_stage(db, stage, current_user.organization_id)
    
    # Create activity log
    create_activity(
        db,
        title="Project Stage Created",
        description=f"Created project stage: {stage.name}",
        type="project",
        organization_id=current_user.organization_id
    )
    
    return db_stage

@app.post("/api/projects/stages/fix")
async def fix_project_stages(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Fix project stages - ensure all projects have valid stage_ids"""
    # Get existing stages
    stages = db.query(ProjectStage).filter(
        ProjectStage.organization_id == current_user.organization_id
    ).order_by(ProjectStage.position).all()
    
    if not stages:
        raise HTTPException(status_code=400, detail="No project stages found. Please create stages first.")
    
    # Get all projects
    projects = db.query(Project).filter(
        Project.organization_id == current_user.organization_id
    ).all()
    
    # Get valid stage IDs
    valid_stage_ids = {s.id for s in stages}
    default_stage = stages[0]  # First stage (Planning) as default
    
    # Fix projects with invalid stage_ids
    fixed_count = 0
    for project in projects:
        if project.stage_id not in valid_stage_ids:
            project.stage_id = default_stage.id
            fixed_count += 1
    
    db.commit()
    
    return {
        "message": f"Fixed {fixed_count} projects with invalid stage_ids",
        "total_projects": len(projects),
        "fixed_count": fixed_count
    }

@app.get("/api/projects/debug")
async def debug_projects(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Debug project data"""
    # Get raw project data
    projects = db.execute(text("""
        SELECT 
            p.id,
            p.title,
            p.stage_id,
            p.is_active,
            ps.name as stage_name,
            ps.id as stage_id_from_join
        FROM projects p
        LEFT JOIN project_stages ps ON p.stage_id = ps.id AND ps.organization_id = p.organization_id
        WHERE p.organization_id = :org_id
        AND p.is_active = true
        LIMIT 5
    """), {"org_id": current_user.organization_id}).fetchall()
    
    stages = db.execute(text("""
        SELECT id, name, position
        FROM project_stages
        WHERE organization_id = :org_id
        AND is_active = true
        ORDER BY position
    """), {"org_id": current_user.organization_id}).fetchall()
    
    return {
        "sample_projects": [
            {
                "id": p.id,
                "title": p.title,
                "stage_id": p.stage_id,
                "is_active": p.is_active,
                "stage_name": p.stage_name,
                "stage_id_from_join": p.stage_id_from_join
            }
            for p in projects
        ],
        "available_stages": [
            {"id": s.id, "name": s.name, "position": s.position}
            for s in stages
        ]
    }

@app.get("/api/projects/stages/diagnostic")
async def diagnose_project_stages(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Diagnose project stage issues"""
    org_id = current_user.organization_id
    
    # Get all stages
    stages = db.query(ProjectStage).filter(
        ProjectStage.organization_id == org_id
    ).all()
    
    # Get all projects
    projects = db.query(Project).filter(
        Project.organization_id == org_id,
        Project.is_active == True
    ).all()
    
    # Find projects with invalid stage_ids
    valid_stage_ids = {s.id for s in stages}
    invalid_projects = []
    valid_projects = []
    
    for project in projects:
        if project.stage_id not in valid_stage_ids:
            invalid_projects.append({
                "id": project.id,
                "title": project.title,
                "stage_id": project.stage_id,
                "issue": "stage_id not in valid stages"
            })
        else:
            valid_projects.append({
                "id": project.id,
                "title": project.title,
                "stage_id": project.stage_id
            })
    
    return {
        "organization_id": org_id,
        "stages": [{"id": s.id, "name": s.name, "position": s.position} for s in stages],
        "total_projects": len(projects),
        "valid_projects_count": len(valid_projects),
        "invalid_projects_count": len(invalid_projects),
        "invalid_projects": invalid_projects[:10],  # First 10 for brevity
        "sample_valid_projects": valid_projects[:5]
    }

@app.get("/api/projects/stages/{stage_id}", response_model=ProjectStageResponse)
async def get_project_stage_endpoint(
    stage_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific project stage"""
    stage = get_project_stage(db, stage_id, current_user.organization_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Project stage not found")
    
    # Add project count
    stage.project_count = db.query(Project).filter(
        Project.stage_id == stage.id,
        Project.is_active == True
    ).count()
    
    return stage

@app.put("/api/projects/stages/{stage_id}", response_model=ProjectStageResponse)
async def update_project_stage_endpoint(
    stage_id: int,
    stage_update: ProjectStageUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a project stage"""
    db_stage = update_project_stage(db, stage_id, stage_update, current_user.organization_id)
    if not db_stage:
        raise HTTPException(status_code=404, detail="Project stage not found")
    
    return db_stage

@app.delete("/api/projects/stages/{stage_id}")
async def delete_project_stage_endpoint(
    stage_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a project stage"""
    success = delete_project_stage(db, stage_id, current_user.organization_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project stage not found or has projects")
    
    return {"message": "Project stage deleted successfully"}


@app.post("/api/projects/stages/initialize")
async def create_default_project_stages(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Initialize default project stages for the organization"""
    # Check if stages already exist
    existing_stages = get_project_stages(db, current_user.organization_id)
    if existing_stages:
        raise HTTPException(status_code=400, detail="Project stages already exist")
    
    # Create default stages
    default_stages = [
        {"name": "Planning", "description": "Project approved, not yet started", "position": 0, "is_closed": False, "color": "#3B82F6"},
        {"name": "Active", "description": "Currently in progress", "position": 1, "is_closed": False, "color": "#10B981"},
        {"name": "Wrapping Up", "description": "Nearing completion", "position": 2, "is_closed": False, "color": "#F59E0B"},
        {"name": "Closed", "description": "Completed projects", "position": 3, "is_closed": True, "color": "#6B7280"}
    ]
    
    created_stages = []
    for stage_data in default_stages:
        from schemas import ProjectStageCreate
        stage = ProjectStageCreate(**stage_data)
        db_stage = create_project_stage(db, stage, current_user.organization_id)
        created_stages.append(db_stage)
    
    return {
        "message": f"Created {len(created_stages)} default project stages",
        "stages": created_stages
    }


# Project endpoints
@app.get("/api/projects", response_model=List[ProjectResponse])
async def get_organization_projects(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    stage_id: Optional[int] = None,
    company_id: Optional[int] = None,
    project_type: Optional[str] = None,
    assigned_to: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all projects for the organization"""
    projects = get_projects(
        db, current_user.organization_id, skip, limit, search, 
        stage_id, company_id, assigned_to, project_type
    )
    
    # Populate additional fields for response
    for project in projects:
        # Stage info
        if project.stage:
            project.stage_name = project.stage.name
            project.stage_color = project.stage.color
        
        # Company info
        if project.company:
            project.company_name = project.company.name
        
        # Contact info
        if project.contact:
            project.contact_name = f"{project.contact.first_name} {project.contact.last_name}"
        
        # Creator info
        if project.creator:
            project.creator_name = f"{project.creator.first_name} {project.creator.last_name}"
        
        # Assigned team member names
        if project.assigned_team_members:
            team_members = db.query(User).filter(
                User.id.in_(project.assigned_team_members),
                User.organization_id == current_user.organization_id
            ).all()
            project.assigned_team_member_names = [
                f"{member.first_name} {member.last_name}" for member in team_members
            ]
    
    return projects

@app.post("/api/projects", response_model=ProjectResponse)
async def create_project_endpoint(
    project: ProjectCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new project"""
    db_project = create_project(db, project, current_user.organization_id, current_user.id)
    return db_project

@app.get("/api/projects/types", response_model=List[str])
async def get_project_types_list(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get available project types for the current organization"""
    project_types = get_project_types(db, current_user.organization_id)
    
    # If no project types exist yet, return the default list for backward compatibility
    if not project_types:
        return PROJECT_TYPES
    
    # Return just the names for the dropdown
    return [pt.name for pt in project_types]

# Project Type management endpoints
@app.get("/api/project-types", response_model=List[ProjectTypeResponse])
async def get_organization_project_types(
    include_inactive: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all project types for the organization"""
    return get_project_types(db, current_user.organization_id, include_inactive)

@app.post("/api/project-types", response_model=ProjectTypeResponse)
async def create_project_type_endpoint(
    project_type: ProjectTypeCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new project type (admin only)"""
    return create_project_type(db, project_type, current_user.organization_id)

@app.get("/api/project-types/{type_id}", response_model=ProjectTypeResponse)
async def get_project_type_endpoint(
    type_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific project type"""
    project_type = get_project_type(db, type_id, current_user.organization_id)
    if not project_type:
        raise HTTPException(status_code=404, detail="Project type not found")
    return project_type

@app.put("/api/project-types/{type_id}", response_model=ProjectTypeResponse)
async def update_project_type_endpoint(
    type_id: int,
    project_type_update: ProjectTypeUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update a project type (admin only)"""
    updated_type = update_project_type(db, type_id, project_type_update, current_user.organization_id)
    if not updated_type:
        raise HTTPException(status_code=404, detail="Project type not found")
    return updated_type

@app.delete("/api/project-types/{type_id}")
async def delete_project_type_endpoint(
    type_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete a project type (admin only)"""
    success = delete_project_type(db, type_id, current_user.organization_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project type not found")
    return {"message": "Project type deleted successfully"}

@app.post("/api/project-types/initialize")
async def initialize_default_project_types(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Initialize default project types for the organization"""
    existing_types = get_project_types(db, current_user.organization_id, include_inactive=True)
    if existing_types:
        return {"message": "Project types already exist", "count": len(existing_types)}
    
    # Use a generic default list that works for most organizations
    # Organizations can customize these after initialization
    default_types = [
        "Consulting",
        "Implementation",
        "Training",
        "Support",
        "Development",
        "Research",
        "Strategy",
        "Other"
    ]
    types_to_create = default_types
    
    # Create project types
    created_types = []
    for i, type_name in enumerate(types_to_create):
        project_type = ProjectTypeCreate(
            name=type_name,
            display_order=i,
            is_active=True
        )
        created_type = create_project_type(db, project_type, current_user.organization_id)
        created_types.append(created_type)
    
    return {"message": f"Created {len(created_types)} project types", "types": created_types}

@app.get("/api/projects/{project_id}", response_model=ProjectResponse)
async def get_project_endpoint(
    project_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific project"""
    project = get_project(db, project_id, current_user.organization_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Populate additional fields
    if project.stage:
        project.stage_name = project.stage.name
        project.stage_color = project.stage.color
    
    if project.company:
        project.company_name = project.company.name
    
    if project.contact:
        project.contact_name = f"{project.contact.first_name} {project.contact.last_name}"
    
    if project.creator:
        project.creator_name = f"{project.creator.first_name} {project.creator.last_name}"
    
    if project.assigned_team_members:
        team_members = db.query(User).filter(
            User.id.in_(project.assigned_team_members),
            User.organization_id == current_user.organization_id
        ).all()
        project.assigned_team_member_names = [
            f"{member.first_name} {member.last_name}" for member in team_members
        ]
    
    return project

@app.put("/api/projects/{project_id}", response_model=ProjectResponse)
async def update_project_endpoint(
    project_id: int,
    project_update: ProjectUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a project"""
    db_project = update_project(db, project_id, project_update, current_user.organization_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return db_project

@app.delete("/api/projects/{project_id}")
async def delete_project_endpoint(
    project_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a project"""
    success = delete_project(db, project_id, current_user.organization_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"message": "Project deleted successfully"}


# Project Attachment endpoints
from fastapi import UploadFile, File as FastAPIFile

@app.post("/api/projects/{project_id}/attachments", response_model=AttachmentResponse)
async def upload_project_attachment(
    project_id: int,
    file: UploadFile = FastAPIFile(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload an attachment to a project - stores file directly in PostgreSQL"""
    # Verify project exists and belongs to user's organization
    project = get_project(db, project_id, current_user.organization_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Read file contents
    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")
    
    # Create the attachment record with file data stored in database
    db_attachment = Attachment(
        name=file.filename,
        file_size=len(contents),
        file_type=file.content_type,
        file_data=contents,  # Store the actual file bytes in PostgreSQL
        project_id=project_id,
        organization_id=current_user.organization_id,
        uploaded_by=f"{current_user.first_name} {current_user.last_name}"
    )
    
    db.add(db_attachment)
    db.commit()
    db.refresh(db_attachment)
    
    # Log activity
    activity = Activity(
        organization_id=current_user.organization_id,
        title=f"File attached to project",
        description=f"File '{file.filename}' was attached to project '{project.title}'",
        type="attachment",
        entity_id=str(project_id),
        created_by=f"{current_user.first_name} {current_user.last_name}"
    )
    db.add(activity)
    db.commit()
    
    # Return attachment without file_data to avoid sending large binary in response
    return AttachmentResponse(
        id=db_attachment.id,
        name=db_attachment.name,
        description=db_attachment.description,
        file_size=db_attachment.file_size,
        file_type=db_attachment.file_type,
        file_url=db_attachment.file_url,
        company_id=db_attachment.company_id,
        project_id=db_attachment.project_id,
        uploaded_by=db_attachment.uploaded_by,
        created_at=db_attachment.created_at
    )

# Deal Attachment endpoints
@app.post("/api/deals/{deal_id}/attachments", response_model=AttachmentResponse)
async def upload_deal_attachment(
    deal_id: int,
    file: UploadFile = FastAPIFile(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload an attachment to a deal - stores file directly in PostgreSQL"""
    # Verify deal exists and belongs to user's organization
    deal = get_deal(db, deal_id, current_user.organization_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Read file contents
    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")
    
    # Create the attachment record with file data stored in database
    db_attachment = Attachment(
        name=file.filename,
        file_size=len(contents),
        file_type=file.content_type,
        file_data=contents,  # Store the actual file bytes in PostgreSQL
        deal_id=deal_id,
        organization_id=current_user.organization_id,
        uploaded_by=f"{current_user.first_name} {current_user.last_name}"
    )
    
    db.add(db_attachment)
    db.commit()
    db.refresh(db_attachment)
    
    # Log activity
    activity = Activity(
        organization_id=current_user.organization_id,
        title=f"File attached to deal",
        description=f"File '{file.filename}' was attached to deal '{deal.title}'",
        type="attachment",
        entity_id=str(deal_id),
        created_by=f"{current_user.first_name} {current_user.last_name}"
    )
    db.add(activity)
    db.commit()
    
    # Return attachment without file_data to avoid sending large binary in response
    return AttachmentResponse(
        id=db_attachment.id,
        name=db_attachment.name,
        description=db_attachment.description,
        file_size=db_attachment.file_size,
        file_type=db_attachment.file_type,
        file_url=db_attachment.file_url,
        company_id=db_attachment.company_id,
        project_id=db_attachment.project_id,
        deal_id=db_attachment.deal_id,
        uploaded_by=db_attachment.uploaded_by,
        created_at=db_attachment.created_at
    )

@app.get("/api/deals/{deal_id}/attachments", response_model=List[AttachmentResponse])
async def get_deal_attachments(
    deal_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all attachments for a deal"""
    # Verify deal exists and belongs to user's organization
    deal = get_deal(db, deal_id, current_user.organization_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    attachments = db.query(Attachment).filter(
        Attachment.deal_id == deal_id,
        Attachment.organization_id == current_user.organization_id
    ).order_by(Attachment.created_at.desc()).all()
    
    return attachments

@app.get("/api/projects/{project_id}/attachments", response_model=List[AttachmentResponse])
async def get_project_attachments(
    project_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all attachments for a project"""
    # Verify project exists and belongs to user's organization
    project = get_project(db, project_id, current_user.organization_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    attachments = db.query(Attachment).filter(
        Attachment.project_id == project_id,
        Attachment.organization_id == current_user.organization_id
    ).order_by(Attachment.created_at.desc()).all()
    
    return attachments

@app.get("/api/attachments/{attachment_id}/download")
async def download_attachment(
    attachment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Download an attachment file from PostgreSQL"""
    from fastapi.responses import Response
    
    # Get attachment and verify user has access
    attachment = db.query(Attachment).filter(
        Attachment.id == attachment_id,
        Attachment.organization_id == current_user.organization_id
    ).first()
    
    if not attachment:
        raise HTTPException(status_code=404, detail="File not found")
    
    if not attachment.file_data:
        raise HTTPException(status_code=404, detail="File content not found")
    
    # Return file data from database
    return Response(
        content=attachment.file_data,
        media_type=attachment.file_type or 'application/octet-stream',
        headers={
            "Content-Disposition": f"attachment; filename=\"{attachment.name}\""
        }
    )

@app.delete("/api/attachments/{attachment_id}")
async def delete_attachment(
    attachment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete an attachment"""
    attachment = db.query(Attachment).filter(
        Attachment.id == attachment_id,
        Attachment.organization_id == current_user.organization_id
    ).first()
    
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # Get project or deal info for activity log
    project = None
    deal = None
    if attachment.project_id:
        project = db.query(Project).filter(Project.id == attachment.project_id).first()
    elif attachment.deal_id:
        deal = db.query(Deal).filter(Deal.id == attachment.deal_id).first()
    
    # Delete the attachment record (file data will be deleted with it)
    db.delete(attachment)
    db.commit()
    
    # Log activity
    if project:
        activity = Activity(
            organization_id=current_user.organization_id,
            title=f"File removed from project",
            description=f"File '{attachment.name}' was removed from project '{project.title}'",
            type="attachment",
            entity_id=str(project.id),
            created_by=f"{current_user.first_name} {current_user.last_name}"
        )
        db.add(activity)
        db.commit()
    elif deal:
        activity = Activity(
            organization_id=current_user.organization_id,
            title=f"File removed from deal",
            description=f"File '{attachment.name}' was removed from deal '{deal.title}'",
            type="attachment",
            entity_id=str(deal.id),
            created_by=f"{current_user.first_name} {current_user.last_name}"
        )
        db.add(activity)
        db.commit()
    
    return {"message": "Attachment deleted successfully"}


# Project Updates endpoints
@app.post("/api/projects/{project_id}/updates", response_model=ProjectUpdateResponse)
async def create_project_update(
    project_id: int,
    update: ProjectUpdateCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new project update or milestone"""
    # Verify project exists and belongs to user's organization
    project = get_project(db, project_id, current_user.organization_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Create the update
    db_update = ProjectUpdate(
        **update.dict(),
        project_id=project_id,
        organization_id=current_user.organization_id,
        created_by=current_user.id,
        created_by_name=f"{current_user.first_name} {current_user.last_name}"
    )
    
    # If marking a milestone as completed, set the completion date
    if update.is_milestone and update.milestone_completed:
        db_update.milestone_completed_date = datetime.utcnow()
    
    db.add(db_update)
    db.commit()
    db.refresh(db_update)
    
    # Log activity
    activity_type = "milestone" if update.is_milestone else "update"
    activity = Activity(
        organization_id=current_user.organization_id,
        title=f"Project {activity_type} added",
        description=f"{update.title} - {project.title}",
        type="project_update",
        entity_id=str(project_id),
        created_by=f"{current_user.first_name} {current_user.last_name}"
    )
    db.add(activity)
    db.commit()
    
    return db_update

@app.get("/api/projects/{project_id}/updates", response_model=List[ProjectUpdateResponse])
async def get_project_updates(
    project_id: int,
    update_type: Optional[str] = None,
    milestones_only: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all updates for a project"""
    # Verify project exists and belongs to user's organization
    project = get_project(db, project_id, current_user.organization_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    query = db.query(ProjectUpdate).filter(
        ProjectUpdate.project_id == project_id,
        ProjectUpdate.organization_id == current_user.organization_id
    )
    
    if milestones_only:
        query = query.filter(ProjectUpdate.is_milestone == True)
    elif update_type:
        query = query.filter(ProjectUpdate.update_type == update_type)
    
    updates = query.order_by(ProjectUpdate.created_at.desc()).all()
    
    return updates

@app.put("/api/projects/{project_id}/updates/{update_id}", response_model=ProjectUpdateResponse)
async def update_project_update(
    project_id: int,
    update_id: int,
    update: ProjectUpdateUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a project update or milestone"""
    # Verify project exists and belongs to user's organization
    project = get_project(db, project_id, current_user.organization_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get the update
    db_update = db.query(ProjectUpdate).filter(
        ProjectUpdate.id == update_id,
        ProjectUpdate.project_id == project_id,
        ProjectUpdate.organization_id == current_user.organization_id
    ).first()
    
    if not db_update:
        raise HTTPException(status_code=404, detail="Update not found")
    
    # Update fields
    update_data = update.dict(exclude_unset=True)
    
    # Handle milestone completion
    if 'milestone_completed' in update_data:
        if update_data['milestone_completed'] and not db_update.milestone_completed:
            db_update.milestone_completed_date = datetime.utcnow()
        elif not update_data['milestone_completed']:
            db_update.milestone_completed_date = None
    
    for field, value in update_data.items():
        setattr(db_update, field, value)
    
    db.commit()
    db.refresh(db_update)
    
    return db_update

@app.delete("/api/projects/{project_id}/updates/{update_id}")
async def delete_project_update(
    project_id: int,
    update_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a project update"""
    # Verify project exists and belongs to user's organization
    project = get_project(db, project_id, current_user.organization_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get the update
    db_update = db.query(ProjectUpdate).filter(
        ProjectUpdate.id == update_id,
        ProjectUpdate.project_id == project_id,
        ProjectUpdate.organization_id == current_user.organization_id
    ).first()
    
    if not db_update:
        raise HTTPException(status_code=404, detail="Update not found")
    
    # Delete the update
    db.delete(db_update)
    db.commit()
    
    return {"detail": "Update deleted successfully"}


# Deal Updates endpoints
@app.post("/api/deals/{deal_id}/updates", response_model=DealUpdateResponse)
async def create_deal_update(
    deal_id: int,
    update: DealUpdateCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new update for a deal"""
    try:
        # Verify deal exists and belongs to user's organization
        deal = get_deal(db, deal_id, current_user.organization_id)
        if not deal:
            raise HTTPException(status_code=404, detail="Deal not found")
        
        # Get user's full name for the update
        user_name = f"{current_user.first_name or ''} {current_user.last_name or ''}".strip()
        
        # Create the update - don't use **update.dict() as it may include None values
        update_data = update.dict(exclude_none=True)
        db_update = models.DealUpdate(
            deal_id=deal_id,
            organization_id=current_user.organization_id,
            created_by=current_user.id,
            created_by_name=user_name or current_user.email,
            **update_data
        )
        
        db.add(db_update)
        db.commit()
        db.refresh(db_update)
        
        # Create activity log
        activity = Activity(
            organization_id=current_user.organization_id,
            title=f"Added update to deal '{deal.title}'",
            description=update.title,
            type="deal_update",
            entity_id=str(deal_id),
            created_by=user_name or current_user.email
        )
        db.add(activity)
        db.commit()
        
        return db_update
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create update: {str(e)}")

@app.get("/api/deals/{deal_id}/updates", response_model=List[DealUpdateResponse])
async def get_deal_updates(
    deal_id: int,
    update_type: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all updates for a deal"""
    # Verify deal exists and belongs to user's organization
    deal = get_deal(db, deal_id, current_user.organization_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    query = db.query(models.DealUpdate).filter(
        models.DealUpdate.deal_id == deal_id,
        models.DealUpdate.organization_id == current_user.organization_id
    )
    
    if update_type:
        query = query.filter(models.DealUpdate.update_type == update_type)
    
    updates = query.order_by(models.DealUpdate.created_at.desc()).all()
    
    return updates

@app.put("/api/deals/{deal_id}/updates/{update_id}", response_model=DealUpdateResponse)
async def update_deal_update(
    deal_id: int,
    update_id: int,
    update: DealUpdateUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a deal update"""
    # Verify deal exists and belongs to user's organization
    deal = get_deal(db, deal_id, current_user.organization_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Get the update
    db_update = db.query(models.DealUpdate).filter(
        models.DealUpdate.id == update_id,
        models.DealUpdate.deal_id == deal_id,
        models.DealUpdate.organization_id == current_user.organization_id
    ).first()
    
    if not db_update:
        raise HTTPException(status_code=404, detail="Update not found")
    
    # Update fields
    update_data = update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_update, field, value)
    
    db.commit()
    db.refresh(db_update)
    
    return db_update

@app.delete("/api/deals/{deal_id}/updates/{update_id}")
async def delete_deal_update(
    deal_id: int,
    update_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a deal update"""
    # Verify deal exists and belongs to user's organization
    deal = get_deal(db, deal_id, current_user.organization_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    
    # Get the update
    db_update = db.query(models.DealUpdate).filter(
        models.DealUpdate.id == update_id,
        models.DealUpdate.deal_id == deal_id,
        models.DealUpdate.organization_id == current_user.organization_id
    ).first()
    
    if not db_update:
        raise HTTPException(status_code=404, detail="Update not found")
    
    # Delete the update
    db.delete(db_update)
    db.commit()
    
    return {"detail": "Update deleted successfully"}


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


# Email Privacy and Sharing Endpoints
@app.patch("/api/contacts/{contact_id}/privacy")
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


@app.get("/api/email-privacy-settings", response_model=EmailPrivacySettings)
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


@app.patch("/api/email-privacy-settings")
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


from pydantic import BaseModel

class O365CallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None

@app.post("/api/o365/auth/callback")
async def o365_auth_callback(
    callback_data: O365CallbackRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Handle O365 OAuth callback"""
    code = callback_data.code
    state = callback_data.state
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


# Google Workspace OAuth Endpoints
@app.get("/api/google/auth/url")
async def get_google_auth_url(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get Google OAuth URL for user authorization"""
    from google_service import get_google_auth_url
    import secrets
    
    # Check if centralized Google OAuth is configured
    if not os.environ.get("GOOGLE_CLIENT_ID"):
        raise HTTPException(
            status_code=400,
            detail="Google Workspace integration is not configured on this server."
        )
    
    # Generate state token for CSRF protection
    state = secrets.token_urlsafe(32)
    
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "https://nohubspot-production.up.railway.app/api/auth/google/callback")
    
    auth_url = get_google_auth_url(redirect_uri, state)
    
    return {
        "auth_url": auth_url,
        "state": state
    }

class GoogleCallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None

@app.post("/api/google/auth/callback")
async def google_auth_callback(
    callback_data: GoogleCallbackRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Handle Google OAuth callback"""
    from google_service import exchange_code_for_tokens, GoogleService
    from google_encryption import encrypt_access_token, encrypt_refresh_token
    
    code = callback_data.code
    state = callback_data.state
    
    # Check if centralized Google OAuth is configured
    if not os.environ.get("GOOGLE_CLIENT_ID") or not os.environ.get("GOOGLE_CLIENT_SECRET"):
        raise HTTPException(
            status_code=400,
            detail="Google Workspace integration is not configured on this server."
        )
    
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "https://nohubspot-production.up.railway.app/api/auth/google/callback")
    
    try:
        # Exchange code for tokens using centralized credentials
        token_data = await exchange_code_for_tokens(code, redirect_uri)
        
        # Create temporary connection to get user info
        temp_connection = GoogleUserConnection(
            user_id=current_user.id,
            organization_id=current_user.organization_id,
            org_config_id=None,  # No org config in simplified approach
            google_user_id="temp",
            google_email="temp",
            access_token_encrypted=encrypt_access_token(token_data["access_token"]),
            refresh_token_encrypted=encrypt_refresh_token(token_data["refresh_token"]),
            token_expires_at=datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600)),
            scopes_granted=token_data.get("scope", "").split() if token_data.get("scope") else []
        )
        
        # Get user info from Google (no org_config needed)
        async with GoogleService(temp_connection) as service:
            user_info = await service.get_user_info()
        
        # Check if connection already exists
        existing_connection = db.query(GoogleUserConnection).filter(
            GoogleUserConnection.user_id == current_user.id
        ).first()
        
        if existing_connection:
            # Update existing connection
            existing_connection.google_user_id = user_info.get("id", "")
            existing_connection.google_email = user_info.get("email", "")
            existing_connection.google_display_name = user_info.get("name", "")
            existing_connection.google_picture_url = user_info.get("picture", "")
            existing_connection.access_token_encrypted = encrypt_access_token(token_data["access_token"])
            existing_connection.refresh_token_encrypted = encrypt_refresh_token(token_data["refresh_token"])
            existing_connection.token_expires_at = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))
            existing_connection.scopes_granted = token_data.get("scope", "").split() if token_data.get("scope") else []
            existing_connection.connection_status = "active"
            existing_connection.sync_error_count = 0
            existing_connection.last_sync_error = None
            
            db_connection = existing_connection
        else:
            # Create new connection
            db_connection = GoogleUserConnection(
                user_id=current_user.id,
                organization_id=current_user.organization_id,
                org_config_id=None,  # No org config in simplified approach
                google_user_id=user_info.get("id", ""),
                google_email=user_info.get("email", ""),
                google_display_name=user_info.get("name", ""),
                google_picture_url=user_info.get("picture", ""),
                access_token_encrypted=encrypt_access_token(token_data["access_token"]),
                refresh_token_encrypted=encrypt_refresh_token(token_data["refresh_token"]),
                token_expires_at=datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600)),
                scopes_granted=token_data.get("scope", "").split() if token_data.get("scope") else []
            )
            db.add(db_connection)
        
        db.commit()
        
        # Create activity log
        create_activity(
            db,
            title="Google Workspace Connected",
            description=f"Connected Google account: {user_info.get('email', '')}",
            activity_type="integration",
            user_id=current_user.id,
            organization_id=current_user.organization_id
        )
        
        return {
            "success": True,
            "message": "Google Workspace connected successfully",
            "email": user_info.get("email", ""),
            "display_name": user_info.get("name", "")
        }
        
    except Exception as e:
        print(f"Google OAuth callback error: {str(e)}")
        raise HTTPException(
            status_code=400, 
            detail=f"Failed to connect Google Workspace: {str(e)}"
        )


@app.get("/api/google/status")
async def get_google_connection_status(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's Google connection status"""
    connection = db.query(GoogleUserConnection).filter(
        GoogleUserConnection.user_id == current_user.id
    ).first()
    
    if not connection:
        return {
            "connected": False,
            "message": "No Google Workspace connection found"
        }
    
    return {
        "connected": connection.connection_status == "active",
        "email": connection.google_email,
        "display_name": connection.google_display_name,
        "picture_url": connection.google_picture_url,
        "last_gmail_sync": connection.last_gmail_sync,
        "last_calendar_sync": connection.last_calendar_sync,
        "last_contacts_sync": connection.last_contacts_sync,
        "connection_status": connection.connection_status
    }


@app.post("/api/google/sync")
async def sync_google_data(
    sync_type: Optional[str] = "gmail",  # gmail, calendar, contacts, all
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Manually trigger Google data sync"""
    connection = db.query(GoogleUserConnection).filter(
        GoogleUserConnection.user_id == current_user.id,
        GoogleUserConnection.connection_status == "active"
    ).first()
    
    if not connection:
        raise HTTPException(status_code=400, detail="No active Google connection")
    
    try:
        async with GoogleService(connection) as service:
            synced_items = {}
            
            if sync_type in ["gmail", "all"] and connection.sync_gmail_enabled:
                await service.sync_gmail_messages(
                    db, 
                    since_date=connection.last_gmail_sync
                )
                synced_items["gmail"] = "completed"
            
            # Additional sync types can be implemented here
            # if sync_type in ["calendar", "all"] and connection.sync_calendar_enabled:
            #     synced_items["calendar"] = await service.sync_calendar_events(db)
            
            # if sync_type in ["contacts", "all"] and connection.sync_contacts_enabled:
            #     synced_items["contacts"] = await service.sync_contacts(db)
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Google {sync_type} sync completed",
            "synced": synced_items
        }
        
    except Exception as e:
        print(f"Google sync error: {str(e)}")
        connection.sync_error_count += 1
        connection.last_sync_error = str(e)
        db.commit()
        
        raise HTTPException(
            status_code=500,
            detail=f"Sync failed: {str(e)}"
        )


@app.delete("/api/google/disconnect")
async def disconnect_google(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Disconnect Google integration"""
    connection = db.query(GoogleUserConnection).filter(
        GoogleUserConnection.user_id == current_user.id
    ).first()
    
    if connection:
        db.delete(connection)
        db.commit()
        
    return {"success": True, "message": "Google Workspace disconnected"}


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


# Admin endpoints
@app.post("/api/admin/standardize-phone-numbers")
async def standardize_phone_numbers_endpoint(
    dry_run: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Manually trigger phone number standardization.
    Only accessible by admin users.
    """
    # Check if user is admin (you may want to add an is_admin field to User model)
    # For now, we'll allow any authenticated user to run this
    
    try:
        if dry_run:
            # Import here to avoid circular imports
            from scripts.standardize_phone_numbers import dry_run as run_dry_run
            preview_data = run_dry_run(organization_id=current_user.organization_id)
            return preview_data
        else:
            from scheduler import trigger_phone_standardization
            stats = trigger_phone_standardization(organization_id=current_user.organization_id)
            return {"message": "Phone number standardization completed successfully!", "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/find-duplicates")
async def find_duplicates_endpoint(
    record_type: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Find duplicate companies or contacts.
    """
    try:
        from scripts.find_duplicates import find_duplicate_companies, find_duplicate_contacts
        
        if record_type == "companies":
            duplicates = find_duplicate_companies(current_user.organization_id)
        elif record_type == "contacts":
            duplicates = find_duplicate_contacts(current_user.organization_id)
        else:
            raise HTTPException(status_code=400, detail="Invalid record type. Must be 'companies' or 'contacts'")
        
        return duplicates
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/delete-duplicates")
async def delete_duplicates_endpoint(
    request: dict,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Delete selected duplicate records.
    """
    try:
        from scripts.find_duplicates import delete_duplicate_records
        
        record_type = request.get("record_type")
        record_ids = request.get("record_ids", [])
        
        if not record_type or record_type not in ["companies", "contacts"]:
            raise HTTPException(status_code=400, detail="Invalid record type")
        
        if not record_ids:
            raise HTTPException(status_code=400, detail="No record IDs provided")
        
        result = delete_duplicate_records(record_type, record_ids, current_user.organization_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/recalculate-contact-counts")
async def recalculate_contact_counts_endpoint(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Recalculate contact counts for all companies in the organization.
    This fixes any discrepancies in the contact_count field.
    """
    try:
        result = recalculate_all_contact_counts(db, current_user.organization_id)
        return {
            "message": "Contact counts recalculated successfully",
            "details": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/sync-contact-company-names")
async def sync_contact_company_names_endpoint(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Sync company names for all contacts in the organization.
    This fixes any discrepancies in the denormalized company_name field.
    """
    try:
        result = sync_contact_company_names(db, current_user.organization_id)
        return {
            "message": "Contact company names synced successfully",
            "details": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
