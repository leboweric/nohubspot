from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
import os
import uvicorn
from datetime import datetime, timedelta

from database import get_db, engine
from models import Base, Company, Contact, Task, EmailThread, EmailMessage, Attachment, Activity, EmailSignature, Organization, User, UserInvite
from schemas import (
    CompanyCreate, CompanyResponse, CompanyUpdate,
    ContactCreate, ContactResponse, ContactUpdate,
    TaskCreate, TaskResponse, TaskUpdate,
    EmailThreadCreate, EmailThreadResponse,
    EmailMessageCreate, AttachmentResponse,
    EmailSignatureCreate, EmailSignatureResponse, EmailSignatureUpdate,
    ActivityResponse, DashboardStats, BulkUploadResult,
    OrganizationCreate, OrganizationResponse, UserRegister, UserLogin, UserResponse,
    UserInviteCreate, UserInviteResponse, UserInviteAccept, Token
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
    get_dashboard_stats
)
from auth_crud import (
    create_organization, get_organization_by_slug, get_organization_by_id,
    create_user, register_user_with_organization, get_user_by_email,
    create_user_invite, get_invite_by_code, accept_user_invite,
    get_organization_invites, revoke_invite, get_users_by_organization
)
from auth import (
    verify_password, create_access_token, get_current_user, 
    get_current_active_user, get_current_admin_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

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
FORCE_RECREATE = True  # Set to True only when you need to reset the database

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
        # Test database connection
        db = next(get_db())
        db.execute(text("SELECT 1"))
        db.close()
        return {"status": "healthy", "timestamp": datetime.utcnow(), "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "timestamp": datetime.utcnow(), "error": str(e)}

@app.get("/api/users")  # Railway healthcheck endpoint
async def users_health():
    return {"status": "ok", "message": "NotHubSpot CRM API is running"}

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
            data={"sub": user.id, "organization_id": organization.id}, 
            expires_delta=access_token_expires
        )
        
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
        data={"sub": user.id, "organization_id": user.organization_id}, 
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
    
    return create_user_invite(db, invite, current_user.organization_id, current_user.id)

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
            data={"sub": user.id, "organization_id": user.organization_id}, 
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
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all users in the organization"""
    return get_users_by_organization(db, current_user.organization_id, skip, limit)

# Dashboard endpoints
@app.get("/api/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_statistics(db: Session = Depends(get_db)):
    return get_dashboard_stats(db)

@app.get("/api/activities", response_model=List[ActivityResponse])
async def get_activities(limit: int = 10, db: Session = Depends(get_db)):
    return get_recent_activities(db, limit=limit)

# Company endpoints
@app.post("/api/companies", response_model=CompanyResponse)
async def create_new_company(
    company: CompanyCreate, 
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    db_company = create_company(db, company, current_user.organization_id)
    
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
    db: Session = Depends(get_db)
):
    company = update_company(db, company_id, company_update)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    create_activity(
        db,
        title="Company Updated", 
        description=f"Updated {company.name}",
        type="company",
        entity_id=str(company.id)
    )
    
    return company

# Contact endpoints
@app.post("/api/contacts", response_model=ContactResponse)
async def create_new_contact(contact: ContactCreate, db: Session = Depends(get_db)):
    db_contact = create_contact(db, contact)
    
    create_activity(
        db,
        title="Contact Added",
        description=f"Added {contact.first_name} {contact.last_name} as a new contact",
        type="contact", 
        entity_id=str(db_contact.id)
    )
    
    return db_contact

@app.get("/api/contacts", response_model=List[ContactResponse])
async def read_contacts(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    company_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return get_contacts(db, skip=skip, limit=limit, search=search, company_id=company_id, status=status)

@app.get("/api/contacts/{contact_id}", response_model=ContactResponse)
async def read_contact(contact_id: int, db: Session = Depends(get_db)):
    contact = get_contact(db, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact

@app.delete("/api/contacts/{contact_id}")
async def delete_existing_contact(contact_id: int, db: Session = Depends(get_db)):
    success = delete_contact(db, contact_id)
    if not success:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Contact deleted successfully"}

# Task endpoints
@app.post("/api/tasks", response_model=TaskResponse)
async def create_new_task(task: TaskCreate, db: Session = Depends(get_db)):
    db_task = create_task(db, task)
    
    create_activity(
        db,
        title="Task Created",
        description=f"Created task: {task.title}",
        type="task",
        entity_id=str(db_task.id)
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
    db: Session = Depends(get_db)
):
    return get_tasks(
        db, 
        skip=skip, 
        limit=limit, 
        search=search, 
        status=status, 
        priority=priority,
        contact_id=contact_id,
        company_id=company_id
    )

@app.get("/api/tasks/{task_id}", response_model=TaskResponse)
async def read_task(task_id: int, db: Session = Depends(get_db)):
    task = get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.put("/api/tasks/{task_id}", response_model=TaskResponse)
async def update_existing_task(
    task_id: int,
    task_update: TaskUpdate,
    db: Session = Depends(get_db)
):
    task = update_task(db, task_id, task_update)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    create_activity(
        db,
        title="Task Updated",
        description=f"Updated task: {task.title}",
        type="task",
        entity_id=str(task.id)
    )
    
    return task

@app.delete("/api/tasks/{task_id}")
async def delete_existing_task(task_id: int, db: Session = Depends(get_db)):
    success = delete_task(db, task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    
    create_activity(
        db,
        title="Task Deleted",
        description=f"Deleted task",
        type="task",
        entity_id=str(task_id)
    )
    
    return {"message": "Task deleted successfully"}

# Email Signature endpoints
@app.get("/api/signature", response_model=Optional[EmailSignatureResponse])
async def get_user_signature(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return get_email_signature(db, current_user.id, current_user.organization_id)

@app.post("/api/signature", response_model=EmailSignatureResponse)
async def create_or_update_signature(
    signature: EmailSignatureCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    return create_or_update_email_signature(db, signature, current_user.id, current_user.organization_id)

# Bulk upload endpoints
@app.post("/api/companies/bulk", response_model=BulkUploadResult)
async def bulk_upload_companies(companies: List[CompanyCreate], db: Session = Depends(get_db)):
    try:
        db_companies = bulk_create_companies(db, companies)
        
        # Create activity for bulk upload
        create_activity(
            db,
            title="Bulk Companies Upload",
            description=f"Uploaded {len(db_companies)} companies",
            type="company"
        )
        
        return BulkUploadResult(
            success_count=len(db_companies),
            error_count=0,
            total_count=len(companies),
            errors=[]
        )
    except Exception as e:
        return BulkUploadResult(
            success_count=0,
            error_count=len(companies),
            total_count=len(companies),
            errors=[str(e)]
        )

@app.post("/api/contacts/bulk", response_model=BulkUploadResult)
async def bulk_upload_contacts(contacts: List[ContactCreate], db: Session = Depends(get_db)):
    try:
        db_contacts = bulk_create_contacts(db, contacts)
        
        # Create activity for bulk upload
        create_activity(
            db,
            title="Bulk Contacts Upload",
            description=f"Uploaded {len(db_contacts)} contacts",
            type="contact"
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
