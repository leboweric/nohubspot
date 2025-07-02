from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from models import Company, Contact, EmailThread, EmailMessage, Attachment, Activity
from schemas import (
    CompanyCreate, CompanyUpdate, ContactCreate, ContactUpdate,
    EmailThreadCreate, EmailMessageCreate, DashboardStats
)

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
    
    return query.offset(skip).limit(limit).all()

def get_company(db: Session, company_id: int):
    return db.query(Company).filter(Company.id == company_id).first()

def update_company(db: Session, company_id: int, company_update: CompanyUpdate):
    db_company = d
