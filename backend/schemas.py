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
    street_address: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    phone: Optional[str] = Field(None, max_length=50)
    annual_revenue: Optional[float] = None
    primary_account_owner_id: Optional[int] = None
    primary_referral_source: Optional[str] = None
    status: str = Field(default="Active", max_length=50)

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    industry: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    address: Optional[str] = None
    street_address: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    phone: Optional[str] = Field(None, max_length=50)
    annual_revenue: Optional[float] = None
    primary_account_owner_id: Optional[int] = None
    primary_referral_source: Optional[str] = None
    status: Optional[str] = Field(None, max_length=50)

class CompanyResponse(CompanyBase, TimestampMixin):
    id: int
    contact_count: int = 0
    attachment_count: int = 0
    
    # Populated by API
    primary_account_owner_name: Optional[str] = None
    
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
    # Privacy fields
    owner_id: Optional[int] = None
    shared_with_team: bool = False
    
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
    messages: Optional[List['EmailMessageResponse']] = []
    
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

class UserAdd(BaseModel):
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    role: UserRole = UserRole.USER

class UserAddResponse(BaseModel):
    user: UserResponse
    temporary_password: str
    message: str

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

# Password Reset schemas
class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

class PasswordResetResponse(BaseModel):
    message: str

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

# Event Attendee schemas
class EventAttendeeBase(BaseModel):
    contact_id: int
    status: str = Field(default="invited", max_length=50)

class EventAttendeeCreate(EventAttendeeBase):
    pass

class EventAttendeeResponse(EventAttendeeBase):
    id: int
    event_id: int
    invite_sent: bool
    invite_sent_at: Optional[datetime]
    response_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    # Contact details (populated by API)
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    
    class Config:
        from_attributes = True

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
    attendee_ids: Optional[List[int]] = Field(default_factory=list)  # List of contact IDs to invite

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
    attendees: List[EventAttendeeResponse] = Field(default_factory=list)  # List of attendees

    class Config:
        from_attributes = True

# Office 365 Organization Configuration schemas
class O365OrganizationConfigBase(BaseModel):
    client_id: Optional[str] = None
    tenant_id: Optional[str] = None
    calendar_sync_enabled: bool = True
    email_sending_enabled: bool = True
    contact_sync_enabled: bool = True

class O365OrganizationConfigCreate(O365OrganizationConfigBase):
    client_secret: Optional[str] = None  # Will be encrypted before storing

class O365OrganizationConfigUpdate(BaseModel):
    client_id: Optional[str] = None
    client_secret: Optional[str] = None  # Will be encrypted before storing
    tenant_id: Optional[str] = None
    calendar_sync_enabled: Optional[bool] = None
    email_sending_enabled: Optional[bool] = None
    contact_sync_enabled: Optional[bool] = None

class O365OrganizationConfigResponse(O365OrganizationConfigBase):
    id: int
    organization_id: int
    is_configured: bool
    last_test_at: Optional[datetime] = None
    last_test_success: bool = False
    last_error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    # Security: Never expose client_secret in responses
    client_secret: Optional[str] = None  # Always None for security
    
    class Config:
        from_attributes = True

# Office 365 User Connection schemas
class O365UserConnectionBase(BaseModel):
    sync_calendar_enabled: bool = True
    sync_email_enabled: bool = True
    sync_contacts_enabled: bool = True

class O365UserConnectionUpdate(O365UserConnectionBase):
    # Privacy settings
    sync_only_crm_contacts: Optional[bool] = None
    excluded_domains: Optional[List[str]] = None
    excluded_keywords: Optional[List[str]] = None
    auto_create_contacts: Optional[bool] = None

class O365UserConnectionResponse(O365UserConnectionBase):
    id: int
    user_id: int
    o365_user_id: str
    o365_email: str
    o365_display_name: Optional[str] = None
    scopes_granted: Optional[List[str]] = None
    is_active: bool
    last_sync_at: Optional[datetime] = None
    last_sync_success: bool = False
    last_error_message: Optional[str] = None
    token_expires_at: datetime
    # Privacy settings
    sync_only_crm_contacts: bool = True
    excluded_domains: Optional[List[str]] = []
    excluded_keywords: Optional[List[str]] = []
    auto_create_contacts: bool = False
    created_at: datetime
    updated_at: datetime
    
    # Security: Never expose tokens in responses
    access_token_encrypted: Optional[str] = None  # Always None for security
    refresh_token_encrypted: Optional[str] = None  # Always None for security
    
    class Config:
        from_attributes = True

# O365 Test Connection Request/Response
class O365TestConnectionRequest(BaseModel):
    client_id: str
    client_secret: str
    tenant_id: str

class O365TestConnectionResponse(BaseModel):
    success: bool
    message: str
    error_details: Optional[str] = None

# Pipeline Stage schemas
class PipelineStageBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    position: int = Field(..., ge=0)
    is_closed_won: bool = False
    is_closed_lost: bool = False
    color: str = Field(default="#3B82F6", pattern="^#[0-9A-Fa-f]{6}$")
    is_active: bool = True

class PipelineStageCreate(PipelineStageBase):
    pass

class PipelineStageUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    position: Optional[int] = Field(None, ge=0)
    is_closed_won: Optional[bool] = None
    is_closed_lost: Optional[bool] = None
    color: Optional[str] = Field(None, pattern="^#[0-9A-Fa-f]{6}$")
    is_active: Optional[bool] = None

class PipelineStageResponse(PipelineStageBase, TimestampMixin):
    id: int
    organization_id: int
    deal_count: Optional[int] = 0  # Will be populated by API
    
    class Config:
        from_attributes = True

# Deal schemas
class DealBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    value: float = Field(default=0.0, ge=0)
    currency: str = Field(default="USD", max_length=3)
    probability: int = Field(default=50, ge=0, le=100)
    expected_close_date: Optional[datetime] = None
    contact_id: Optional[int] = None
    company_id: Optional[int] = None
    assigned_to: Optional[int] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = Field(default_factory=list)

class DealCreate(DealBase):
    stage_id: int

class DealUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    value: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = Field(None, max_length=3)
    probability: Optional[int] = Field(None, ge=0, le=100)
    expected_close_date: Optional[datetime] = None
    actual_close_date: Optional[datetime] = None
    stage_id: Optional[int] = None
    contact_id: Optional[int] = None
    company_id: Optional[int] = None
    assigned_to: Optional[int] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None

class DealResponse(DealBase, TimestampMixin):
    id: int
    organization_id: int
    created_by: int
    stage_id: int
    actual_close_date: Optional[datetime] = None
    is_active: bool
    
    # Populated by API
    stage_name: Optional[str] = None
    stage_color: Optional[str] = None
    contact_name: Optional[str] = None
    company_name: Optional[str] = None
    creator_name: Optional[str] = None
    assignee_name: Optional[str] = None
    
    class Config:
        from_attributes = True


# Project Stage schemas
class ProjectStageBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    position: int = Field(..., ge=0)
    is_closed: bool = False
    color: str = Field(default="#3B82F6", pattern="^#[0-9A-Fa-f]{6}$")
    is_active: bool = True

class ProjectStageCreate(ProjectStageBase):
    pass

class ProjectStageUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    position: Optional[int] = Field(None, ge=0)
    is_closed: Optional[bool] = None
    color: Optional[str] = Field(None, pattern="^#[0-9A-Fa-f]{6}$")
    is_active: Optional[bool] = None

class ProjectStageResponse(ProjectStageBase, TimestampMixin):
    id: int
    organization_id: int
    project_count: Optional[int] = 0  # Will be populated by API
    
    class Config:
        from_attributes = True


# Project Type enum for validation
PROJECT_TYPES = [
    "Annual Giving",
    "Board Development", 
    "Capital Campaign",
    "Individual or Team Coaching",
    "Communications Strategy",
    "Consultation Set-Up",
    "Executive Search",
    "Feasibility Study",
    "Fundraising Training",
    "Fundraising/Resource Development",
    "Grant Writing",
    "Interim Development Director",
    "Interim Executive Director",
    "Marketing Strategy/Support",
    "Merger/Partnership",
    "Mission/Vision/Values",
    "Organizational Assessment",
    "Program Evaluation",
    "Strategic Planning",
    "Team Training",
    "Other"
]


# Project schemas
class ProjectBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    projected_end_date: Optional[datetime] = None
    hourly_rate: Optional[float] = Field(None, ge=0)
    project_type: Optional[str] = Field(None, max_length=100)
    projected_hours: Optional[float] = Field(None, ge=0)
    contact_id: Optional[int] = None
    company_id: Optional[int] = None
    assigned_team_members: Optional[List[int]] = Field(default_factory=list)  # User IDs
    notes: Optional[str] = None
    tags: Optional[List[str]] = Field(default_factory=list)

class ProjectCreate(ProjectBase):
    stage_id: int

class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    projected_end_date: Optional[datetime] = None
    actual_end_date: Optional[datetime] = None
    hourly_rate: Optional[float] = Field(None, ge=0)
    project_type: Optional[str] = Field(None, max_length=100)
    projected_hours: Optional[float] = Field(None, ge=0)
    actual_hours: Optional[float] = Field(None, ge=0)
    stage_id: Optional[int] = None
    contact_id: Optional[int] = None
    company_id: Optional[int] = None
    assigned_team_members: Optional[List[int]] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None

class ProjectResponse(ProjectBase, TimestampMixin):
    id: int
    organization_id: int
    created_by: int
    stage_id: int
    actual_end_date: Optional[datetime] = None
    actual_hours: float = 0.0
    is_active: bool
    
    # Populated by API
    stage_name: Optional[str] = None
    stage_color: Optional[str] = None
    contact_name: Optional[str] = None
    company_name: Optional[str] = None
    creator_name: Optional[str] = None
    assigned_team_member_names: Optional[List[str]] = Field(default_factory=list)  # Names of assigned users
    
    class Config:
        from_attributes = True


# Project Type schemas
class ProjectTypeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    display_order: int = Field(default=0)
    is_active: bool = Field(default=True)

class ProjectTypeCreate(ProjectTypeBase):
    pass

class ProjectTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    display_order: Optional[int] = None
    is_active: Optional[bool] = None

class ProjectTypeResponse(ProjectTypeBase, TimestampMixin):
    id: int
    organization_id: int
    
    class Config:
        from_attributes = True


# Email Tracking schemas
class EmailTrackingBase(BaseModel):
    message_id: str = Field(..., max_length=255)
    to_email: str = Field(..., max_length=255)
    from_email: str = Field(..., max_length=255)
    subject: str = Field(..., max_length=500)
    contact_id: Optional[int] = None
    sent_at: datetime

class EmailTrackingCreate(EmailTrackingBase):
    sent_by: int

class EmailTrackingResponse(EmailTrackingBase, TimestampMixin):
    id: int
    organization_id: int
    sent_by: int
    opened_at: Optional[datetime] = None
    open_count: int = 0
    first_clicked_at: Optional[datetime] = None
    click_count: int = 0
    
    # Populated by API
    sender_name: Optional[str] = None
    contact_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class EmailEventBase(BaseModel):
    event_type: str = Field(..., max_length=50)  # open, click, bounce, spam, unsubscribe
    timestamp: datetime
    ip_address: Optional[str] = Field(None, max_length=45)
    user_agent: Optional[str] = None
    url: Optional[str] = None  # For click events

class EmailEventCreate(EmailEventBase):
    tracking_id: int
    raw_data: Optional[dict] = None

class EmailEventResponse(EmailEventBase):
    id: int
    tracking_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# SendGrid webhook event
class SendGridEvent(BaseModel):
    event: str
    email: str
    timestamp: int
    sg_message_id: str
    sg_event_id: Optional[str] = None
    ip: Optional[str] = None
    useragent: Optional[str] = None
    url: Optional[str] = None
    category: Optional[List[str]] = None
    # Custom args we send with emails
    contact_name: Optional[str] = None
    sender_name: Optional[str] = None
    source: Optional[str] = None
# Update forward references
EmailThreadResponse.model_rebuild()


# Email Privacy Settings
class EmailPrivacySettings(BaseModel):
    sync_only_crm_contacts: bool = True
    excluded_domains: Optional[List[str]] = []
    excluded_keywords: Optional[List[str]] = []
    auto_create_contacts: bool = False

class EmailPrivacySettingsUpdate(BaseModel):
    sync_only_crm_contacts: Optional[bool] = None
    excluded_domains: Optional[List[str]] = None
    excluded_keywords: Optional[List[str]] = None
    auto_create_contacts: Optional[bool] = None

# Contact Privacy Settings
class ContactPrivacyUpdate(BaseModel):
    shared_with_team: Optional[bool] = None
    owner_id: Optional[int] = None

# Email Thread Sharing
class EmailThreadSharingUpdate(BaseModel):
    is_private: Optional[bool] = None
    shared_with: Optional[List[int]] = None  # User IDs

class EmailSharingPermissionCreate(BaseModel):
    email_thread_id: int
    user_id: int
    permission_level: str = "read"  # read, write

class EmailSharingPermissionResponse(BaseModel):
    id: int
    email_thread_id: int
    user_id: int
    permission_level: str
    granted_by: int
    granted_at: datetime
    
    class Config:
        from_attributes = True