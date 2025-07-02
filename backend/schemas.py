from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional

# Company schemas
class CompanyBase(BaseModel):
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    status: str = "Lead"
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
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Contact schemas
class ContactBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    title: Optional[str] = None
    status: str = "Lead"
    notes: Optional[str] = None
    company_id: int

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
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Email schemas
class EmailMessageBase(BaseModel):
    sender: str
    content: str
    direction: str

class EmailMessageCreate(EmailMessageBase):
    thread_id: int

class EmailMessageResponse(EmailMessageBase):
    id: int
    thread_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class EmailThreadBase(BaseModel):
    subject: str
    contact_id: int

class EmailThreadCreate(EmailThreadBase):
    pass

class EmailThreadResponse(EmailThreadBase):
    id: int
    created_at: datetime
    updated_at: datetime
    messages: List[EmailMessageResponse] = []
    
    class Config:
        from_attributes = True

# Attachment schemas
class AttachmentResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    file_size: Optional[int]
    file_type: Optional[str]
    file_url: Optional[str]
    company_id: int
    uploaded_by: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

# Activity schemas
class ActivityResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    type: str
    entity_id: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

# Dashboard schemas
class DashboardStats(BaseModel):
    total_companies: int
    total_contacts: int
    total_email_threads: int
    total_attachments: int
    active_companies: int
    active_contacts: int
