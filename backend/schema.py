from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# Company schemas
class CompanyBase(BaseModel):
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    status: str = "Active"
    notes: Optional[str] = None

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class CompanyResponse(CompanyBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    contact_count: int = 0
    attachment_count: int = 0
    
    class Config:
        from_attributes = True

# Contact schemas
class ContactBase(BaseModel):
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    status: str = "Active"
    notes: Optional[str] = None
    company_id: Optional[int] = None

class ContactCreate(ContactBase):
    pass

class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    company_id: Optional[int] = None

class ContactResponse(ContactBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    company_name: Optional[str] = None
    
    class Config:
        from_attributes = True

# Dashboard schemas
class DashboardStats(BaseModel):
    total_companies: int
    total_contacts: int
    active_companies: int
    active_contacts: int
    email_threads: int
    attachments: int
    companies_this_month: int
    contacts_this_month: int

# Activity schemas
class ActivityResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    type: str
    entity_id: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
