from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uvicorn
from datetime import datetime

from database import get_db, engine
from models import Base, Company, Contact, EmailThread, EmailMessage, Attachment, Activity
from schemas import (
    CompanyCreate, CompanyResponse, CompanyUpdate,
    ContactCreate, ContactResponse, ContactUpdate,
    EmailThreadCreate, EmailThreadResponse,
    EmailMessageCreate, AttachmentResponse,
    ActivityResponse, DashboardStats
)
from crud import (
    create_company, get_companies, get_company, update_company, delete_company,
    create_contact, get_contacts, get_contact, update_contact, delete_contact,
    create_email_thread, get_email_threads, add_email_message,
    create_attachment, get_attachments,
    create_activity, get_recent_activities,
    get_dashboard_stats
)

# Create database tables with error handling
try:
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully")
except Exception as e:
    print(f"❌ Database connection failed: {e}")

app = FastAPI(
    title="NoHubSpot CRM API",
    description="Backend API for NoHubSpot CRM - The HubSpot Alternative",
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
    return {"message": "NoHubSpot CRM API is running!", "version": "1.0.0"}

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
    return {"status": "ok", "message": "NoHubSpot CRM API is running"}

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

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"🚀 Starting NoHubSpot CRM API on port {port}")
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=port,
        reload=False,  # Disable reload in production
        log_level="info"
    )
