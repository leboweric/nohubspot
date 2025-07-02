from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from models import Company, Contact, EmailThread, EmailMessage, Attachment, Activity
from schemas import (
    CompanyCreate, CompanyUpdate, ContactCreate, ContactUpdate,
    DashboardStats
)
from datetime import datetime, timedelta
from typing import Optional, List

# Company CRUD operations
def create_company(db: Session, company: CompanyCreate):
    db_company = Company(**company.dict())
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    return db_company

def get_companies(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    search: Optional[str] = None,
    status: Optional[str] = None
):
    query = db.query(Company)
    
    if search:
        query = query.filter(
            or_(
                Company.name.ilike(f"%{search}%"),
                Company.industry.ilike(f"%{search}%"),
                Company.description.ilike(f"%{search}%")
            )
        )
    
    if status:
        query = query.filter(Company.status == status)
    
    companies = query.offset(skip).limit(limit).all()
    
    # Add contact and attachment counts
    for company in companies:
        company.contact_count = len(company.contacts)
        company.attachment_count = len(company.attachments)
    
    return companies

def get_company(db: Session, company_id: int):
    company = db.query(Company).filter(Company.id == company_id).first()
    if company:
        company.contact_count = len(company.contacts)
        company.attachment_count = len(company.attachments)
    return company

def update_company(db: Session, company_id: int, company_update: CompanyUpdate):
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if not db_company:
        return None
    
    update_data = company_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_company, field, value)
    
    db.commit()
    db.refresh(db_company)
    return db_company

def delete_company(db: Session, company_id: int):
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if not db_company:
        return False
    
    db.delete(db_company)
    db.commit()
    return True

# Contact CRUD operations
def create_contact(db: Session, contact: ContactCreate):
    db_contact = Contact(**contact.dict())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    
    # Add company name
    if db_contact.company:
        db_contact.company_name = db_contact.company.name
    
    return db_contact

def get_contacts(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    company_id: Optional[int] = None,
    status: Optional[str] = None
):
    query = db.query(Contact)
    
    if search:
        query = query.filter(
            or_(
                Contact.first_name.ilike(f"%{search}%"),
                Contact.last_name.ilike(f"%{search}%"),
                Contact.email.ilike(f"%{search}%"),
                Contact.title.ilike(f"%{search}%")
            )
        )
    
    if company_id:
        query = query.filter(Contact.company_id == company_id)
    
    if status:
        query = query.filter(Contact.status == status)
    
    contacts = query.offset(skip).limit(limit).all()
    
    # Add company names
    for contact in contacts:
        if contact.company:
            contact.company_name = contact.company.name
    
    return contacts

def get_contact(db: Session, contact_id: int):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if contact and contact.company:
        contact.company_name = contact.company.name
    return contact

# Activity CRUD operations
def create_activity(
    db: Session,
    title: str,
    description: str,
    type: str,
    entity_id: str
):
    db_activity = Activity(
        title=title,
        description=description,
        type=type,
        entity_id=entity_id
    )
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    
    return db_activity

def get_recent_activities(db: Session, limit: int = 10):
    return db.query(Activity).order_by(Activity.created_at.desc()).limit(limit).all()

# Dashboard statistics
def get_dashboard_stats(db: Session) -> DashboardStats:
    # Get current month start
    current_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    total_companies = db.query(Company).count()
    total_contacts = db.query(Contact).count()
    active_companies = db.query(Company).filter(Company.status == "Active").count()
    active_contacts = db.query(Contact).filter(Contact.status == "Active").count()
    email_threads = db.query(EmailThread).count()
    attachments = db.query(Attachment).count()
    
    companies_this_month = db.query(Company).filter(Company.created_at >= current_month).count()
    contacts_this_month = db.query(Contact).filter(Contact.created_at >= current_month).count()
    
    return DashboardStats(
        total_companies=total_companies,
        total_contacts=total_contacts,
        active_companies=active_companies,
        active_contacts=active_contacts,
        email_threads=email_threads,
        attachments=attachments,
        companies_this_month=companies_this_month,
        contacts_this_month=contacts_this_month
    )
