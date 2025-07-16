from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON, Float, Enum, cast, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

Base = declarative_base()

class UserRole(enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    USER = "user"
    READONLY = "readonly"

class InviteStatus(enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    EXPIRED = "expired"

class Organization(Base):
    __tablename__ = "organizations"
    
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(100), unique=True, nullable=False, index=True)  # URL identifier
    name = Column(String(255), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"))
    plan = Column(String(50), default="free")  # free, starter, pro, enterprise
    is_active = Column(Boolean, default=True)
    settings = Column(JSON, default={})  # Store tenant-specific settings
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    users = relationship("User", back_populates="organization", foreign_keys="User.organization_id")
    companies = relationship("Company", back_populates="organization", foreign_keys="Company.organization_id", cascade="all, delete-orphan")
    contacts = relationship("Contact", back_populates="organization", foreign_keys="Contact.organization_id", cascade="all, delete-orphan")

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    role = Column(String(20), default="user")
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization", back_populates="users", foreign_keys=[organization_id])
    created_organizations = relationship("Organization", foreign_keys="Organization.created_by")
    invites_sent = relationship("UserInvite", foreign_keys="UserInvite.invited_by", back_populates="inviter")

class UserInvite(Base):
    __tablename__ = "user_invites"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    email = Column(String(255), nullable=False)
    role = Column(String(20), default="user")
    invite_code = Column(String(100), unique=True, nullable=False)
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="pending")
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    organization = relationship("Organization")
    inviter = relationship("User", back_populates="invites_sent")

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User")

class Company(Base):
    __tablename__ = "companies"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    industry = Column(String(100))
    website = Column(String(255))
    description = Column(Text)
    
    # Address fields
    street_address = Column(String(255))
    city = Column(String(100))
    state = Column(String(100))
    postal_code = Column(String(20))
    
    # Business info
    phone = Column(String(50))
    annual_revenue = Column(Float)
    
    # Legacy field - kept for backward compatibility
    address = Column(Text)  # This can be deprecated later
    
    status = Column(String(50), default="Active")  # Active, Lead, Inactive
    contact_count = Column(Integer, default=0)
    attachment_count = Column(Integer, default=0)
    primary_account_owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    primary_referral_source = Column(Text, nullable=True)  # Free-form text field for referral source
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization", back_populates="companies", foreign_keys=[organization_id])
    primary_account_owner = relationship("User", foreign_keys=[primary_account_owner_id])
    contacts = relationship("Contact", back_populates="company_rel", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="company_rel", cascade="all, delete-orphan")
    activities = relationship("Activity", foreign_keys="Activity.entity_id", 
                            primaryjoin="and_(cast(Company.id, String) == Activity.entity_id, Activity.type == 'company')",
                            overlaps="activities")
    
    @property
    def primary_account_owner_name(self):
        if self.primary_account_owner:
            return f"{self.primary_account_owner.first_name} {self.primary_account_owner.last_name}"
        return None

class Contact(Base):
    __tablename__ = "contacts"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(50))
    title = Column(String(100))
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    company_name = Column(String(255))  # Denormalized for easier queries
    status = Column(String(50), default="Active")  # Active, Lead, Inactive
    notes = Column(Text)
    
    # Privacy and sharing settings
    is_shared = Column(Boolean, default=False)  # Deprecated - use shared_with_team
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    shared_with_team = Column(Boolean, default=False)  # If true, all team members can see this contact
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_activity = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    organization = relationship("Organization", back_populates="contacts", foreign_keys=[organization_id])
    company_rel = relationship("Company", back_populates="contacts")
    email_threads = relationship("EmailThread", back_populates="contact", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="contact", cascade="all, delete-orphan")
    activities = relationship("Activity", foreign_keys="Activity.entity_id", 
                            primaryjoin="and_(cast(Contact.id, String) == Activity.entity_id, Activity.type == 'contact')",
                            overlaps="activities")
    owner = relationship("User", foreign_keys=[owner_id])

class EmailThread(Base):
    __tablename__ = "email_threads"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    subject = Column(String(500), nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)
    message_count = Column(Integer, default=0)
    preview = Column(Text)
    
    # Privacy settings
    is_private = Column(Boolean, default=True)  # Private by default
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    shared_with = Column(JSON)  # Array of user IDs who can see this thread
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    contact = relationship("Contact", back_populates="email_threads")
    messages = relationship("EmailMessage", back_populates="thread", cascade="all, delete-orphan")
    owner = relationship("User", foreign_keys=[owner_id])
    sharing_permissions = relationship("EmailSharingPermission", back_populates="email_thread", cascade="all, delete-orphan")

class EmailMessage(Base):
    __tablename__ = "email_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(Integer, ForeignKey("email_threads.id"), nullable=False)
    sender = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    direction = Column(String(20), nullable=False)  # incoming, outgoing
    message_id = Column(String(255))  # External email service message ID
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    thread = relationship("EmailThread", back_populates="messages")

class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="pending")  # pending, in_progress, completed, cancelled
    priority = Column(String(50), default="medium")  # low, medium, high, urgent
    due_date = Column(DateTime(timezone=True))
    assigned_to = Column(String(255))
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    contact_name = Column(String(255))
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    company_name = Column(String(255))
    type = Column(String(50), default="other")  # call, email, meeting, follow_up, demo, proposal, other
    tags = Column(JSON)  # Store as JSON array
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    contact = relationship("Contact", back_populates="tasks")

class Attachment(Base):
    __tablename__ = "attachments"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    file_size = Column(Integer)
    file_type = Column(String(100))
    file_url = Column(String(500))
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    uploaded_by = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    company_rel = relationship("Company", back_populates="attachments")

class Activity(Base):
    __tablename__ = "activities"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    type = Column(String(50), nullable=False)  # company, contact, email, task, attachment
    entity_id = Column(String(50))  # ID of the related entity
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(255))

class EmailSignature(Base):
    __tablename__ = "email_signatures"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, default=1)
    user_id = Column(String(100), default="default")
    name = Column(String(255))
    title = Column(String(255))
    company = Column(String(255))
    phone = Column(String(50))
    email = Column(String(255))
    website = Column(String(255))
    custom_text = Column(Text)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class EmailTemplate(Base):
    __tablename__ = "email_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Template details
    name = Column(String(200), nullable=False)
    subject = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)  # sales, support, follow-up, etc.
    
    # Sharing settings
    is_shared = Column(Boolean, default=True)  # True = team-wide, False = personal
    
    # Track which variables are used in the template
    variables_used = Column(JSON, nullable=True)  # e.g., ["contact.first_name", "company.name"]
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization")
    creator = relationship("User")

class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Event details
    title = Column(String(255), nullable=False)
    description = Column(Text)
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=False)
    location = Column(String(255))
    event_type = Column(String(50), default="meeting")  # meeting, call, task, reminder
    
    # Related entities
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    
    # Event settings
    is_all_day = Column(Boolean, default=False)
    reminder_minutes = Column(Integer, default=15)  # 0=no reminder, 15=15min before, etc.
    status = Column(String(50), default="scheduled")  # scheduled, completed, cancelled
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization")
    creator = relationship("User")
    contact = relationship("Contact")
    company = relationship("Company")
    attendees = relationship("EventAttendee", back_populates="event", cascade="all, delete-orphan")

class EventAttendee(Base):
    __tablename__ = "event_attendees"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("calendar_events.id"), nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)
    
    # Attendee status
    status = Column(String(50), default="invited")  # invited, accepted, declined, tentative
    invite_sent = Column(Boolean, default=False)
    invite_sent_at = Column(DateTime(timezone=True))
    response_at = Column(DateTime(timezone=True))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    event = relationship("CalendarEvent", back_populates="attendees")
    contact = relationship("Contact")

class O365OrganizationConfig(Base):
    __tablename__ = "o365_organization_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, unique=True)
    
    # Azure AD App Registration Details
    client_id = Column(String(255), nullable=True)  # Application (client) ID
    client_secret_encrypted = Column(Text, nullable=True)  # Encrypted client secret
    tenant_id = Column(String(255), nullable=True)  # Directory (tenant) ID
    
    # Integration Feature Toggles
    calendar_sync_enabled = Column(Boolean, default=True)
    email_sending_enabled = Column(Boolean, default=True)
    contact_sync_enabled = Column(Boolean, default=True)
    
    # Configuration Status
    is_configured = Column(Boolean, default=False)
    last_test_at = Column(DateTime(timezone=True))
    last_test_success = Column(Boolean, default=False)
    last_error_message = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization")
    user_connections = relationship("O365UserConnection", back_populates="org_config", cascade="all, delete-orphan")

class O365UserConnection(Base):
    __tablename__ = "o365_user_connections"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    org_config_id = Column(Integer, ForeignKey("o365_organization_configs.id"), nullable=False)
    
    # O365 User Information
    o365_user_id = Column(String(255), nullable=False)  # Azure AD user ID
    o365_email = Column(String(255), nullable=False)  # User's O365 email
    o365_display_name = Column(String(255))  # User's display name from O365
    
    # OAuth Tokens (Encrypted)
    access_token_encrypted = Column(Text, nullable=False)
    refresh_token_encrypted = Column(Text, nullable=False)
    token_expires_at = Column(DateTime(timezone=True), nullable=False)
    scopes_granted = Column(JSON)  # List of granted scopes
    
    # User Sync Preferences
    sync_calendar_enabled = Column(Boolean, default=True)
    sync_email_enabled = Column(Boolean, default=True)
    sync_contacts_enabled = Column(Boolean, default=True)
    
    # Email Privacy Settings
    sync_only_crm_contacts = Column(Boolean, default=True)  # Only sync emails for existing CRM contacts
    excluded_domains = Column(JSON)  # List of domains to exclude from sync (e.g., ["gmail.com", "yahoo.com"])
    excluded_keywords = Column(JSON)  # List of keywords to exclude from sync
    auto_create_contacts = Column(Boolean, default=False)  # Auto-create contacts from emails
    
    # Connection Status
    is_active = Column(Boolean, default=True)
    last_sync_at = Column(DateTime(timezone=True))
    last_sync_success = Column(Boolean, default=False)
    last_error_message = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User")
    organization = relationship("Organization")
    org_config = relationship("O365OrganizationConfig", back_populates="user_connections")

class GoogleOrganizationConfig(Base):
    __tablename__ = "google_organization_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, unique=True)
    
    # Google Cloud Project Details
    client_id = Column(String(255), nullable=True)  # OAuth 2.0 Client ID
    client_secret_encrypted = Column(Text, nullable=True)  # Encrypted client secret
    project_id = Column(String(255), nullable=True)  # Google Cloud Project ID
    
    # Integration Feature Toggles
    gmail_sync_enabled = Column(Boolean, default=True)
    calendar_sync_enabled = Column(Boolean, default=True)
    contact_sync_enabled = Column(Boolean, default=True)
    drive_sync_enabled = Column(Boolean, default=False)
    
    # Configuration Status
    is_configured = Column(Boolean, default=False)
    last_test_at = Column(DateTime(timezone=True))
    last_test_success = Column(Boolean, default=False)
    last_error_message = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization")
    user_connections = relationship("GoogleUserConnection", back_populates="org_config", cascade="all, delete-orphan")

class GoogleUserConnection(Base):
    __tablename__ = "google_user_connections"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    org_config_id = Column(Integer, ForeignKey("google_organization_configs.id"), nullable=False)
    
    # Google Account Information
    google_user_id = Column(String(255), nullable=False)  # Google unique user ID
    google_email = Column(String(255), nullable=False)  # User's Google email
    google_display_name = Column(String(255))  # User's display name from Google
    google_picture_url = Column(String(500))  # Profile picture URL
    
    # OAuth Tokens (Encrypted)
    access_token_encrypted = Column(Text, nullable=False)
    refresh_token_encrypted = Column(Text, nullable=False)
    token_expires_at = Column(DateTime(timezone=True), nullable=False)
    scopes_granted = Column(JSON)  # List of granted scopes
    
    # User Sync Preferences
    sync_gmail_enabled = Column(Boolean, default=True)
    sync_calendar_enabled = Column(Boolean, default=True)
    sync_contacts_enabled = Column(Boolean, default=True)
    sync_drive_enabled = Column(Boolean, default=False)
    
    # Email Privacy Settings (matching O365 pattern)
    sync_only_crm_contacts = Column(Boolean, default=True)
    excluded_email_domains = Column(JSON, default=list)  # List of domains to exclude from sync
    excluded_email_keywords = Column(JSON, default=list)  # Keywords to exclude from sync
    include_sent_emails = Column(Boolean, default=True)
    
    # Sync Status
    last_gmail_sync = Column(DateTime(timezone=True))
    last_calendar_sync = Column(DateTime(timezone=True))
    last_contacts_sync = Column(DateTime(timezone=True))
    last_drive_sync = Column(DateTime(timezone=True))
    sync_error_count = Column(Integer, default=0)
    last_sync_error = Column(Text)
    
    # Connection Status
    connection_status = Column(String(50), default="active")  # active, error, revoked
    connection_established_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User")
    organization = relationship("Organization")
    org_config = relationship("GoogleOrganizationConfig", back_populates="user_connections")

class PipelineStage(Base):
    __tablename__ = "pipeline_stages"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)  # Lead, Qualified, Proposal, etc.
    description = Column(Text)
    position = Column(Integer, nullable=False)  # Order in pipeline (0, 1, 2, ...)
    is_closed_won = Column(Boolean, default=False)  # Final winning stage
    is_closed_lost = Column(Boolean, default=False)  # Final losing stage
    color = Column(String(7), default="#3B82F6")  # Hex color for UI
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization")
    deals = relationship("Deal", back_populates="stage")

class Deal(Base):
    __tablename__ = "deals"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Deal details
    title = Column(String(255), nullable=False)
    description = Column(Text)
    value = Column(Float, default=0.0)  # Deal value in currency
    currency = Column(String(3), default="USD")  # ISO currency code
    probability = Column(Integer, default=50)  # 0-100% chance of closing
    
    # Dates
    expected_close_date = Column(DateTime(timezone=True))
    actual_close_date = Column(DateTime(timezone=True))
    
    # Relationships
    stage_id = Column(Integer, ForeignKey("pipeline_stages.id"), nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    
    # Status and tracking
    is_active = Column(Boolean, default=True)
    notes = Column(Text)
    tags = Column(JSON)  # Store as JSON array
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization")
    creator = relationship("User", foreign_keys=[created_by])
    assignee = relationship("User", foreign_keys=[assigned_to])
    stage = relationship("PipelineStage", back_populates="deals")
    contact = relationship("Contact")
    company = relationship("Company")
    activities = relationship("Activity", foreign_keys="Activity.entity_id", 
                            primaryjoin="and_(cast(Deal.id, String) == Activity.entity_id, Activity.type == 'deal')",
                            overlaps="activities")


class ProjectStage(Base):
    __tablename__ = "project_stages"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)  # Planning, Active, Wrapping Up, Closed
    description = Column(Text)
    position = Column(Integer, nullable=False)  # Order in pipeline (0, 1, 2, ...)
    is_closed = Column(Boolean, default=False)  # True for Closed stage
    color = Column(String(7), default="#3B82F6")  # Hex color for UI
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization")
    projects = relationship("Project", back_populates="stage")


class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Project details
    title = Column(String(255), nullable=False)
    description = Column(Text)
    
    # Dates
    start_date = Column(DateTime(timezone=True), nullable=True)
    projected_end_date = Column(DateTime(timezone=True), nullable=True)
    actual_end_date = Column(DateTime(timezone=True), nullable=True)
    
    # Financial details
    hourly_rate = Column(Float, nullable=True)  # Hourly rate for the project
    
    # Project type from the intake form
    project_type = Column(String(100), nullable=True)  # Annual Giving, Board Development, etc.
    
    # Time tracking
    projected_hours = Column(Float, nullable=True)  # Estimated hours for completion
    actual_hours = Column(Float, default=0.0)  # Actual hours logged
    
    # Relationships
    stage_id = Column(Integer, ForeignKey("project_stages.id"), nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)  # Primary company contact
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    
    # Team assignments (JSON array of user IDs)
    assigned_team_members = Column(JSON, nullable=True)  # Array of user IDs assigned to project
    
    # Status and tracking
    is_active = Column(Boolean, default=True)
    notes = Column(Text)
    tags = Column(JSON)  # Store as JSON array
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization")
    creator = relationship("User", foreign_keys=[created_by])
    stage = relationship("ProjectStage", back_populates="projects")
    contact = relationship("Contact")
    company = relationship("Company")
    activities = relationship("Activity", foreign_keys="Activity.entity_id", 
                            primaryjoin="and_(cast(Project.id, String) == Activity.entity_id, Activity.type == 'project')",
                            overlaps="activities")


class ProjectType(Base):
    __tablename__ = "project_types"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(255))
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization")
    
    # Unique constraint to prevent duplicate types per organization
    __table_args__ = (
        UniqueConstraint('organization_id', 'name', name='_org_project_type_uc'),
    )


class EmailTracking(Base):
    __tablename__ = "email_tracking"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    
    # SendGrid message ID for tracking
    message_id = Column(String(255), nullable=False, index=True)
    
    # Email details
    to_email = Column(String(255), nullable=False)
    from_email = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=False)
    
    # Related entities
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    sent_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Tracking metrics
    sent_at = Column(DateTime(timezone=True), nullable=False)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    open_count = Column(Integer, default=0)
    first_clicked_at = Column(DateTime(timezone=True), nullable=True)
    click_count = Column(Integer, default=0)
    
    # SendGrid metadata
    sendgrid_data = Column(JSON, nullable=True)  # Store raw event data
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization")
    contact = relationship("Contact")
    sender = relationship("User")
    events = relationship("EmailEvent", back_populates="tracking", cascade="all, delete-orphan")


class EmailEvent(Base):
    __tablename__ = "email_events"
    
    id = Column(Integer, primary_key=True, index=True)
    tracking_id = Column(Integer, ForeignKey("email_tracking.id"), nullable=False, index=True)
    
    # Event details
    event_type = Column(String(50), nullable=False)  # open, click, bounce, spam, unsubscribe
    timestamp = Column(DateTime(timezone=True), nullable=False)
    
    # Additional event data
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    url = Column(Text, nullable=True)  # For click events
    
    # Raw SendGrid event data
    raw_data = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    tracking = relationship("EmailTracking", back_populates="events")

class EmailSharingPermission(Base):
    __tablename__ = "email_sharing_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    email_thread_id = Column(Integer, ForeignKey("email_threads.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Permission level
    permission_level = Column(String(50), nullable=False)  # read, write
    
    # Audit trail
    granted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    granted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    email_thread = relationship("EmailThread", back_populates="sharing_permissions")
    user = relationship("User", foreign_keys=[user_id])
    granter = relationship("User", foreign_keys=[granted_by])