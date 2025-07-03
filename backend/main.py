from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uvicorn
from datetime import datetime

from database import get_db, engine
from models import Base, Company, Contact, Task, EmailThread, EmailMessage, Attachment, Activity, EmailSignature
from schemas import (
    CompanyCreate, CompanyResponse, CompanyUpdate,
    ContactCreate, ContactResponse, ContactUpdate,
    TaskCreate, TaskResponse, TaskUpdate,
    EmailThreadCreate, EmailThreadResponse,
    EmailMessageCreate, AttachmentResponse,
    EmailSignatureCreate, EmailSignatureResponse, EmailSignatureUpdate,
    ActivityResponse, DashboardStats, BulkUploadResult
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

# Create database tables with error handling
try:
    print("🔨 Checking/Creating database tables...")
    # Try to create tables
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables ready")
    except Exception as create_error:
        if "incompatible types" in str(create_error):
            print("⚠️  Schema mismatch detected, dropping and recreating tables...")
            # Drop all tables and recreate
            Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)
            print("✅ Database tables recreated with correct schema")
        else:
            raise create_error
    
    # Check if we need to seed initial data
    db = next(get_db())
    try:
        company_count = db.query(Company).count()
        if company_count == 0:
            print("📊 No data found, creating sample data...")
            from init_db import seed_sample_data
            seed_sample_data()
    except:
        # If query fails, tables might not exist properly
        pass
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
        db.execute("SELECT 1")
        db.close()
        return {"status": "healthy", "timestamp": datetime.utcnow(), "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "timestamp": datetime.utcnow(), "error": str(e)}

@app.get("/api/users")  # Railway healthcheck endpoint
async def users_health():
    return {"status": "ok", "message": "NotHubSpot CRM API is running"}

# Dashboard endpoints
@app.get("/api/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_statistics(db: Session = Depends(get_db)):
    return get_dashboard_stats(db)

@app.get("/api/activities", response_model=List[ActivityResponse])
async def get_activities(limit: int = 10, db: Session = Depends(get_db)):
    return get_recent_activities(db, limit=limit)

# Company endpoints
@app.post("/api/companies", response_model=CompanyResponse)
async def create_new_company(company: CompanyCreate, db: Session = Depends(get_db)):
    db_company = create_company(db, company)
    
    # Create activity log
    create_activity(
        db, 
        title="Company Added",
        description=f"Added {company.name} as a new company",
        type="company",
        entity_id=str(db_company.id)
    )
    
    return db_company

@app.get("/api/companies", response_model=List[CompanyResponse])
async def read_companies(
    skip: int = 0, 
    limit: int = 100, 
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return get_companies(db, skip=skip, limit=limit, search=search, status=status)

@app.get("/api/companies/{company_id}", response_model=CompanyResponse)
async def read_company(company_id: int, db: Session = Depends(get_db)):
    company = get_company(db, company_id)
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
async def get_user_signature(user_id: str = "default", db: Session = Depends(get_db)):
    return get_email_signature(db, user_id)

@app.post("/api/signature", response_model=EmailSignatureResponse)
async def create_or_update_signature(
    signature: EmailSignatureCreate,
    user_id: str = "default",
    db: Session = Depends(get_db)
):
    return create_or_update_email_signature(db, signature, user_id)

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
