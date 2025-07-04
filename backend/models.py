from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON, Float, Enum, cast
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
    address = Column(Text)
    status = Column(String(50), default="Active")  # Active, Lead, Inactive
    contact_count = Column(Integer, default=0)
    attachment_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization", back_populates="companies", foreign_keys=[organization_id])
    contacts = relationship("Contact", back_populates="company_rel", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="company_rel", cascade="all, delete-orphan")
    activities = relationship("Activity", foreign_keys="Activity.entity_id", 
                            primaryjoin="and_(cast(Company.id, String) == Activity.entity_id, Activity.type == 'company')",
                            overlaps="activities")

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

class EmailThread(Base):
    __tablename__ = "email_threads"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    subject = Column(String(500), nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)
    message_count = Column(Integer, default=0)
    preview = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    contact = relationship("Contact", back_populates="email_threads")
    messages = relationship("EmailMessage", back_populates="thread", cascade="all, delete-orphan")

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
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
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