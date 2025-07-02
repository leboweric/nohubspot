from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from datetime import datetime

from database import get_db, engine
from models import Base, Company, Contact, EmailThread, EmailMessage, Attachment, Activity
from schemas import (
    CompanyCreate, CompanyResponse, CompanyUpdate,
    ContactCreate, ContactResponse, ContactUpdate,
    ActivityResponse, DashboardStats
)
from crud import (
    create_company, get_companies, get_company, update_company, delete_company,
    create_contact, get_contacts, get_contact,
    create_activity, get_recent_activities,
    get_dashboard_stats
)

# Create database tables
Base.metadata.create_all(bind=engine)

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
    return {"status": "healthy", "timestamp": datetime.utcnow()}

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
    
    create_activity
