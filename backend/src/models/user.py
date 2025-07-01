from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid
from werkzeug.security import generate_password_hash, check_password_hash
import re
from decimal import Decimal

db = SQLAlchemy()

def generate_uuid():
    return str(uuid.uuid4())

# Tenant Management
class Tenant(db.Model):
    __tablename__ = 'tenants'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    name = db.Column(db.String(255), nullable=False)
    subdomain = db.Column(db.String(100), unique=True, nullable=False)
    plan = db.Column(db.String(50), default='free')
    settings = db.Column(db.JSON, default={})
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    users = db.relationship('User', backref='tenant', lazy=True, cascade='all, delete-orphan')
    contacts = db.relationship('Contact', backref='tenant', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'subdomain': self.subdomain,
            'plan': self.plan,
            'settings': self.settings,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class TenantBranding(db.Model):
    __tablename__ = 'tenant_branding'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    logo_url = db.Column(db.String(500))
    primary_color = db.Column(db.String(7), default='#22C55E')
    secondary_color = db.Column(db.String(7), default='#1F2937')
    company_name = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'logo_url': self.logo_url,
            'primary_color': self.primary_color,
            'secondary_color': self.secondary_color,
            'company_name': self.company_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# User Management
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(100))
    last_name = db.Column(db.String(100))
    role = db.Column(db.String(50), default='user')  # admin, user, viewer
    is_active = db.Column(db.Boolean, default=True)
    last_login = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('tenant_id', 'email', name='unique_tenant_user'),)
    
    @property
    def full_name(self):
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        elif self.first_name:
            return self.first_name
        elif self.last_name:
            return self.last_name
        else:
            return self.email.split('@')[0]
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'full_name': self.full_name,
            'role': self.role,
            'is_active': self.is_active,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class UserSession(db.Model):
    __tablename__ = 'user_sessions'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    token_hash = db.Column(db.String(255), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Contact Management
class Contact(db.Model):
    __tablename__ = 'contacts'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    first_name = db.Column(db.String(100))
    last_name = db.Column(db.String(100))
    email = db.Column(db.String(255))
    phone = db.Column(db.String(50))
    company = db.Column(db.String(255))
    job_title = db.Column(db.String(255))
    website = db.Column(db.String(500))
    address = db.Column(db.Text)
    notes = db.Column(db.Text)
    lead_score = db.Column(db.Integer, default=0)
    status = db.Column(db.String(50), default='new')  # new, qualified, customer, lost
    source = db.Column(db.String(100))  # website, referral, cold_call, etc.
    assigned_to = db.Column(db.String(36), db.ForeignKey('users.id'))
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    interactions = db.relationship('Interaction', backref='contact', lazy=True, cascade='all, delete-orphan')
    email_sends = db.relationship('EmailSend', backref='contact', lazy=True, cascade='all, delete-orphan')
    tasks = db.relationship('Task', backref='contact', lazy=True, cascade='all, delete-orphan')
    
    @property
    def full_name(self):
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        elif self.first_name:
            return self.first_name
        elif self.last_name:
            return self.last_name
        else:
            return self.email or "Unknown Contact"
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'full_name': self.full_name,
            'email': self.email,
            'phone': self.phone,
            'company': self.company,
            'job_title': self.job_title,
            'website': self.website,
            'address': self.address,
            'notes': self.notes,
            'lead_score': self.lead_score,
            'status': self.status,
            'source': self.source,
            'assigned_to': self.assigned_to,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class ContactTag(db.Model):
    __tablename__ = 'contact_tags'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(7), default='#6B7280')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('tenant_id', 'name', name='unique_tenant_tag'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'name': self.name,
            'color': self.color,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# Quote Management
class Quote(db.Model):
    __tablename__ = 'quotes'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id'), nullable=False)
    contact_id = db.Column(db.String(36), db.ForeignKey('contacts.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    quote_number = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(255))
    description = db.Column(db.Text)
    amount = db.Column(db.Numeric(12, 2))
    currency = db.Column(db.String(3), default='USD')
    status = db.Column(db.String(50), default='draft')
    valid_until = db.Column(db.DateTime)
    file_url = db.Column(db.String(500))
    file_name = db.Column(db.String(255))
    file_size = db.Column(db.Integer)
    external_quote_id = db.Column(db.String(255))
    sent_at = db.Column(db.DateTime)
    viewed_at = db.Column(db.DateTime)
    responded_at = db.Column(db.DateTime)
    accepted_at = db.Column(db.DateTime)
    rejected_at = db.Column(db.DateTime)
    rejection_reason = db.Column(db.Text)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    tenant = db.relationship('Tenant', backref='quotes')
    contact = db.relationship('Contact', backref='quotes')
    user = db.relationship('User', backref='quotes')
    line_items = db.relationship('QuoteLineItem', backref='quote', cascade='all, delete-orphan')
    activities = db.relationship('QuoteActivity', backref='quote', cascade='all, delete-orphan')
    
    # Unique constraint
    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'quote_number', name='quotes_quote_number_tenant_unique'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'contact_id': self.contact_id,
            'user_id': self.user_id,
            'quote_number': self.quote_number,
            'title': self.title,
            'description': self.description,
            'amount': float(self.amount) if self.amount else None,
            'currency': self.currency,
            'status': self.status,
            'valid_until': self.valid_until.isoformat() if self.valid_until else None,
            'file_url': self.file_url,
            'file_name': self.file_name,
            'file_size': self.file_size,
            'external_quote_id': self.external_quote_id,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'viewed_at': self.viewed_at.isoformat() if self.viewed_at else None,
            'responded_at': self.responded_at.isoformat() if self.responded_at else None,
            'accepted_at': self.accepted_at.isoformat() if self.accepted_at else None,
            'rejected_at': self.rejected_at.isoformat() if self.rejected_at else None,
            'rejection_reason': self.rejection_reason,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'contact_name': self.contact.full_name if self.contact else None,
            'user_name': self.user.full_name if self.user else None,
            'line_items': [item.to_dict() for item in self.line_items] if self.line_items else [],
            'total_line_items': sum(float(item.total_price) for item in self.line_items) if self.line_items else 0
        }


class QuoteLineItem(db.Model):
    __tablename__ = 'quote_line_items'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    quote_id = db.Column(db.String(36), db.ForeignKey('quotes.id'), nullable=False)
    description = db.Column(db.String(500), nullable=False)
    quantity = db.Column(db.Numeric(10, 2), default=1)
    unit_price = db.Column(db.Numeric(12, 2), nullable=False)
    total_price = db.Column(db.Numeric(12, 2), nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'quote_id': self.quote_id,
            'description': self.description,
            'quantity': float(self.quantity) if self.quantity else 0,
            'unit_price': float(self.unit_price) if self.unit_price else 0,
            'total_price': float(self.total_price) if self.total_price else 0,
            'sort_order': self.sort_order,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class QuoteActivity(db.Model):
    __tablename__ = 'quote_activities'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id'), nullable=False)
    quote_id = db.Column(db.String(36), db.ForeignKey('quotes.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'))
    activity_type = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    tenant = db.relationship('Tenant')
    user = db.relationship('User')
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'quote_id': self.quote_id,
            'user_id': self.user_id,
            'activity_type': self.activity_type,
            'description': self.description,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'user_name': self.user.full_name if self.user else None
        }

# Interaction Tracking
class Interaction(db.Model):
    __tablename__ = 'interactions'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    contact_id = db.Column(db.String(36), db.ForeignKey('contacts.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'))
    type = db.Column(db.String(50), nullable=False)  # email, call, meeting, note, task, quote
    subject = db.Column(db.String(255))
    content = db.Column(db.Text)
    direction = db.Column(db.String(20))  # inbound, outbound
    status = db.Column(db.String(50))  # completed, scheduled, cancelled
    scheduled_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'contact_id': self.contact_id,
            'user_id': self.user_id,
            'type': self.type,
            'subject': self.subject,
            'content': self.content,
            'direction': self.direction,
            'status': self.status,
            'scheduled_at': self.scheduled_at.isoformat() if self.scheduled_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# Email Tracking System (Updated)
class EmailSend(db.Model):
    __tablename__ = 'email_sends'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    contact_id = db.Column(db.String(36), db.ForeignKey('contacts.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    thread_id = db.Column(db.String(36), db.ForeignKey('email_threads.id'))  # Link to thread
    subject = db.Column(db.String(255))
    content = db.Column(db.Text)
    sent_at = db.Column(db.DateTime, default=datetime.utcnow)
    email_provider = db.Column(db.String(50))  # gmail, outlook, manual
    external_message_id = db.Column(db.String(255))  # SendGrid message ID
    
    # Relationships
    pixel = db.relationship('EmailPixel', backref='email_send', uselist=False, cascade='all, delete-orphan')
    clicks = db.relationship('EmailClick', backref='email_send', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'contact_id': self.contact_id,
            'user_id': self.user_id,
            'thread_id': self.thread_id,
            'subject': self.subject,
            'content': self.content,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'email_provider': self.email_provider,
            'external_message_id': self.external_message_id
        }

# Email Thread Tracking System
class EmailThread(db.Model):
    """Groups related emails into conversation threads"""
    __tablename__ = 'email_threads'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    contact_id = db.Column(db.String(36), db.ForeignKey('contacts.id', ondelete='CASCADE'), nullable=False)
    subject = db.Column(db.String(255), nullable=False)
    thread_key = db.Column(db.String(255), nullable=False)  # For matching replies (normalized subject)
    first_email_id = db.Column(db.String(36), db.ForeignKey('email_sends.id'))  # Original email that started thread
    last_activity_at = db.Column(db.DateTime, default=datetime.utcnow)
    reply_count = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships - Fixed to specify foreign keys explicitly
    emails = db.relationship('EmailSend', 
                           foreign_keys=[EmailSend.thread_id],
                           backref='thread', 
                           lazy=True)
    replies = db.relationship('EmailReply', backref='thread', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'contact_id': self.contact_id,
            'subject': self.subject,
            'thread_key': self.thread_key,
            'first_email_id': self.first_email_id,
            'last_activity_at': self.last_activity_at.isoformat() if self.last_activity_at else None,
            'reply_count': self.reply_count,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class EmailReply(db.Model):
    """Stores incoming email replies captured via webhook"""
    __tablename__ = 'email_replies'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    thread_id = db.Column(db.String(36), db.ForeignKey('email_threads.id', ondelete='CASCADE'), nullable=False)
    contact_id = db.Column(db.String(36), db.ForeignKey('contacts.id', ondelete='CASCADE'), nullable=False)
    original_email_id = db.Column(db.String(36), db.ForeignKey('email_sends.id'))  # Email this is replying to
    
    # Email content
    from_email = db.Column(db.String(255), nullable=False)
    from_name = db.Column(db.String(255))
    subject = db.Column(db.String(255))
    content_text = db.Column(db.Text)  # Plain text version
    content_html = db.Column(db.Text)  # HTML version
    
    # Email metadata
    message_id = db.Column(db.String(255))  # Email Message-ID header
    in_reply_to = db.Column(db.String(255))  # In-Reply-To header
    references = db.Column(db.Text)  # References header (for threading)
    received_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Processing status
    is_processed = db.Column(db.Boolean, default=False)
    processing_error = db.Column(db.Text)
    
    # Webhook data
    webhook_data = db.Column(db.JSON)  # Store raw webhook payload for debugging
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'thread_id': self.thread_id,
            'contact_id': self.contact_id,
            'original_email_id': self.original_email_id,
            'from_email': self.from_email,
            'from_name': self.from_name,
            'subject': self.subject,
            'content_text': self.content_text,
            'content_html': self.content_html,
            'message_id': self.message_id,
            'in_reply_to': self.in_reply_to,
            'references': self.references,
            'received_at': self.received_at.isoformat() if self.received_at else None,
            'is_processed': self.is_processed,
            'processing_error': self.processing_error,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class EmailPixel(db.Model):
    __tablename__ = 'email_pixels'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    email_send_id = db.Column(db.String(36), db.ForeignKey('email_sends.id', ondelete='CASCADE'), nullable=False)
    pixel_token = db.Column(db.String(255), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    opens = db.relationship('EmailOpen', backref='pixel', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'email_send_id': self.email_send_id,
            'pixel_token': self.pixel_token,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class EmailOpen(db.Model):
    __tablename__ = 'email_opens'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    pixel_id = db.Column(db.String(36), db.ForeignKey('email_pixels.id', ondelete='CASCADE'), nullable=False)
    ip_address = db.Column(db.String(45))  # Support IPv6
    user_agent = db.Column(db.Text)
    opened_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_unique = db.Column(db.Boolean, default=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'pixel_id': self.pixel_id,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'opened_at': self.opened_at.isoformat() if self.opened_at else None,
            'is_unique': self.is_unique
        }

class EmailClick(db.Model):
    __tablename__ = 'email_clicks'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    email_send_id = db.Column(db.String(36), db.ForeignKey('email_sends.id', ondelete='CASCADE'), nullable=False)
    url = db.Column(db.String(1000), nullable=False)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)
    clicked_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'email_send_id': self.email_send_id,
            'url': self.url,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'clicked_at': self.clicked_at.isoformat() if self.clicked_at else None
        }

# Tasks and Reminders
class Task(db.Model):
    __tablename__ = 'tasks'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    contact_id = db.Column(db.String(36), db.ForeignKey('contacts.id', ondelete='CASCADE'))
    assigned_to = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    priority = db.Column(db.String(20), default='medium')  # low, medium, high, urgent
    status = db.Column(db.String(50), default='pending')  # pending, in_progress, completed, cancelled
    due_date = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'contact_id': self.contact_id,
            'assigned_to': self.assigned_to,
            'created_by': self.created_by,
            'title': self.title,
            'description': self.description,
            'priority': self.priority,
            'status': self.status,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# Helper functions for email thread management
def normalize_subject(subject):
    """Normalize email subject for thread matching"""
    if not subject:
        return ""
    
    # Remove common reply prefixes
    subject = re.sub(r'^(re:|fwd?:|fw:)\s*', '', subject, flags=re.IGNORECASE)
    
    # Remove extra whitespace
    subject = ' '.join(subject.split())
    
    return subject.lower().strip()

def generate_thread_key(subject, contact_email):
    """Generate unique thread key for grouping emails"""
    normalized_subject = normalize_subject(subject)
    return f"{contact_email}:{normalized_subject}"

def extract_message_id_from_headers(headers):
    """Extract Message-ID from email headers"""
    if isinstance(headers, dict):
        return headers.get('Message-ID') or headers.get('message-id')
    return None

def parse_references_header(references):
    """Parse References header to extract message IDs"""
    if not references:
        return []
    
    # Extract message IDs from References header
    message_ids = re.findall(r'<([^>]+)>', references)
    return message_ids
