from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    USER = "user"
    READONLY = "readonly"

# Base schemas for common fields
class TimestampMixin(BaseModel):
    created_at: datetime
    updated_at: datetime

# Company schemas
class CompanyBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    industry: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    address: Optional[str] = None
    status: str = Field(default="Active", max_length=50)

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    industry: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = Field(None, max_length=50)

class CompanyResponse(CompanyBase, TimestampMixin):
    id: int
    contact_count: int
    attachment_count: int
    
    class Config:
        from_attributes = True

# Contact schemas
class ContactBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, max_length=100)
    company_id: Optional[int] = None
    company_name: Optional[str] = Field(None, max_length=255)
    status: str = Field(default="Active", max_length=50)
    notes: Optional[str] = None

class ContactCreate(ContactBase):
    pass

class ContactUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, max_length=100)
    company_id: Optional[int] = None
    company_name: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None

class ContactResponse(ContactBase, TimestampMixin):
    id: int
    last_activity: datetime
    
    class Config:
        from_attributes = True

# Task schemas
class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    status: str = Field(default="pending", max_length=50)
    priority: str = Field(default="medium", max_length=50)
    due_date: Optional[datetime] = None
    assigned_to: Optional[str] = Field(None, max_length=255)
    contact_id: Optional[int] = None
    contact_name: Optional[str] = Field(None, max_length=255)
    company_id: Optional[int] = None
    company_name: Optional[str] = Field(None, max_length=255)
    type: str = Field(default="other", max_length=50)
    tags: Optional[List[str]] = Field(default_factory=list)

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    status: Optional[str] = Field(None, max_length=50)
    priority: Optional[str] = Field(None, max_length=50)
    due_date: Optional[datetime] = None
    assigned_to: Optional[str] = Field(None, max_length=255)
    contact_id: Optional[int] = None
    contact_name: Optional[str] = Field(None, max_length=255)
    company_id: Optional[int] = None
    company_name: Optional[str] = Field(None, max_length=255)
    type: Optional[str] = Field(None, max_length=50)
    tags: Optional[List[str]] = None

class TaskResponse(TaskBase, TimestampMixin):
    id: int
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Email schemas
class EmailThreadBase(BaseModel):
    subject: str = Field(..., min_length=1, max_length=500)
    contact_id: int

class EmailThreadCreate(EmailThreadBase):
    pass

class EmailThreadResponse(EmailThreadBase, TimestampMixin):
    id: int
    message_count: int
    preview: Optional[str] = None
    
    class Config:
        from_attributes = True

class EmailMessageBase(BaseModel):
    sender: str = Field(..., max_length=255)
    content: str = Field(..., min_length=1)
    direction: str = Field(..., max_length=20)

class EmailMessageCreate(EmailMessageBase):
    thread_id: int
    message_id: Optional[str] = Field(None, max_length=255)

class EmailMessageResponse(EmailMessageBase):
    id: int
    thread_id: int
    message_id: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Attachment schemas
class AttachmentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    file_size: Optional[int] = None
    file_type: Optional[str] = Field(None, max_length=100)
    file_url: Optional[str] = Field(None, max_length=500)
    company_id: Optional[int] = None
    uploaded_by: Optional[str] = Field(None, max_length=255)

class AttachmentCreate(AttachmentBase):
    pass

class AttachmentResponse(AttachmentBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Activity schemas
class ActivityBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    type: str = Field(..., max_length=50)
    entity_id: Optional[str] = Field(None, max_length=50)
    created_by: Optional[str] = Field(None, max_length=255)

class ActivityCreate(ActivityBase):
    pass

class ActivityResponse(ActivityBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Email Signature schemas
class EmailSignatureBase(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    title: Optional[str] = Field(None, max_length=255)
    company: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=255)
    custom_text: Optional[str] = None
    enabled: bool = Field(default=True)

class EmailSignatureCreate(EmailSignatureBase):
    pass

class EmailSignatureUpdate(EmailSignatureBase):
    pass

class EmailSignatureResponse(EmailSignatureBase, TimestampMixin):
    id: int
    user_id: str
    
    class Config:
        from_attributes = True

# Bulk upload schemas
class BulkUploadResult(BaseModel):
    success_count: int
    error_count: int
    total_count: int
    errors: List[str] = Field(default_factory=list)

# Organization schemas
class OrganizationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    
class OrganizationCreate(OrganizationBase):
    pass

class OrganizationResponse(OrganizationBase):
    id: int
    slug: str
    plan: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# User schemas
class UserBase(BaseModel):
    email: EmailStr
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    role: UserRole = UserRole.USER

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    organization_id: Optional[int] = None  # For invite-based registration

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    company_name: str = Field(..., min_length=1, max_length=255)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    organization_id: int
    is_active: bool
    email_verified: bool
    last_login: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    role: Optional[UserRole] = None

# User invite schemas
class UserInviteCreate(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.USER

class UserInviteResponse(BaseModel):
    id: int
    organization_id: int
    email: str
    role: UserRole
    status: str
    expires_at: datetime
    created_at: datetime
    inviter: UserResponse
    
    class Config:
        from_attributes = True

class UserInviteAccept(BaseModel):
    invite_code: str
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=8)

# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse
    organization: OrganizationResponse

# Email Template Schemas
class EmailTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    subject: str = Field(..., min_length=1, max_length=500)
    body: str = Field(..., min_length=1)
    category: Optional[str] = Field(None, max_length=100)
    is_shared: bool = True

class EmailTemplateCreate(EmailTemplateBase):
    variables_used: Optional[List[str]] = None

class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    subject: Optional[str] = Field(None, min_length=1, max_length=500)
    body: Optional[str] = Field(None, min_length=1)
    category: Optional[str] = Field(None, max_length=100)
    is_shared: Optional[bool] = None
    variables_used: Optional[List[str]] = None

class EmailTemplateResponse(EmailTemplateBase):
    id: int
    organization_id: int
    created_by: Optional[int]
    variables_used: Optional[List[str]]
    usage_count: int
    last_used_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    creator_name: Optional[str] = None  # Will be populated by the API

    class Config:
        from_attributes = True

# Dashboard schemas
class DashboardStats(BaseModel):
    total_companies: int
    total_contacts: int
    total_tasks: int
    total_email_threads: int
    active_companies: int
    active_contacts: int
    pending_tasks: int
    overdue_tasks: int

# Calendar Event schemas
class CalendarEventBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location: Optional[str] = Field(None, max_length=255)
    event_type: str = Field(default="meeting", max_length=50)
    contact_id: Optional[int] = None
    company_id: Optional[int] = None
    is_all_day: bool = False
    reminder_minutes: int = Field(default=15, ge=0, le=1440)  # 0 to 24 hours
    status: str = Field(default="scheduled", max_length=50)

class CalendarEventCreate(CalendarEventBase):
    pass

class CalendarEventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location: Optional[str] = Field(None, max_length=255)
    event_type: Optional[str] = Field(None, max_length=50)
    contact_id: Optional[int] = None
    company_id: Optional[int] = None
    is_all_day: Optional[bool] = None
    reminder_minutes: Optional[int] = Field(None, ge=0, le=1440)
    status: Optional[str] = Field(None, max_length=50)

class CalendarEventResponse(CalendarEventBase, TimestampMixin):
    id: int
    created_by: int
    contact_name: Optional[str] = None  # Will be populated by API
    company_name: Optional[str] = None  # Will be populated by API
    creator_name: Optional[str] = None  # Will be populated by API

    class Config:
        from_attributes = True