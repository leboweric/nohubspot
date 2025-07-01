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
    documents = db.relationship('ContactDocument', backref='contact', lazy=True, cascade='all, delete-orphan')
    
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

# Contact Documents - WITH PERSISTENT STORAGE
class ContactDocument(db.Model):
    __tablename__ = 'contact_documents'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    contact_id = db.Column(db.String(36), db.ForeignKey('contacts.id', ondelete='CASCADE'), nullable=False)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    original_filename = db.Column(db.String(255), nullable=False)
    stored_filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=True)  # Keep for backward compatibility
    file_data = db.Column(db.LargeBinary, nullable=False)  # NEW: Store actual file content
    file_type = db.Column(db.String(50), nullable=False)  # quote, proposal, contract, presentation, image, other
    mime_type = db.Column(db.String(100))
    file_size = db.Column(db.BigInteger, nullable=False)
    status = db.Column(db.String(20), default='draft')  # draft, sent, viewed, signed, rejected
    notes = db.Column(db.Text)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    sent_at = db.Column(db.DateTime)
    viewed_at = db.Column(db.DateTime)
    signed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='uploaded_documents')
    
    def to_dict(self):
        return {
            'id': self.id,
            'contact_id': self.contact_id,
            'tenant_id': self.tenant_id,
            'user_id': self.user_id,
            'title': self.title,
            'description': self.description,
            'original_filename': self.original_filename,
            'stored_filename': self.stored_filename,
            'file_path': self.file_path,
            'file_type': self.file_type,
            'mime_type': self.mime_type,
            'file_size': self.file_size,
            'status': self.status,
            'notes': self.notes,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'viewed_at': self.viewed_at.isoformat() if self.viewed_at else None,
            'signed_at': self.signed_at.isoformat() if self.signed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'uploader_name': self.user.full_name if self.user else None
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
    quote_id = db.Column(db.String(36), db.ForeignKey('quotes.id'), nullable=False)
    activity_type = db.Column(db.String(50), nullable=False)  # created, sent, viewed, accepted, rejected, etc.
    description = db.Column(db.Text)
    activity_metadata = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'quote_id': self.quote_id,
            'activity_type': self.activity_type,
            'description': self.description,
            'metadata': self.activity_metadata,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# Activity/Interaction Tracking
class Interaction(db.Model):
    __tablename__ = 'interactions'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    contact_id = db.Column(db.String(36), db.ForeignKey('contacts.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # email, call, meeting, note, task, document
    subject = db.Column(db.String(255))
    content = db.Column(db.Text)
    direction = db.Column(db.String(20))  # inbound, outbound
    status = db.Column(db.String(50), default='completed')  # scheduled, completed, cancelled
    scheduled_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    interaction_metadata = db.Column(db.JSON)  # Store additional data like email_id, call_duration, etc.
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='interactions')
    
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
            'metadata': self.interaction_metadata,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'user_name': self.user.full_name if self.user else None
        }

# Task Management
class Task(db.Model):
    __tablename__ = 'tasks'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    contact_id = db.Column(db.String(36), db.ForeignKey('contacts.id', ondelete='CASCADE'), nullable=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    assigned_to = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    priority = db.Column(db.String(20), default='medium')  # low, medium, high, urgent
    status = db.Column(db.String(50), default='pending')  # pending, in_progress, completed, cancelled
    due_date = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', foreign_keys=[user_id], backref='created_tasks')
    assignee = db.relationship('User', foreign_keys=[assigned_to], backref='assigned_tasks')
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'contact_id': self.contact_id,
            'user_id': self.user_id,
            'assigned_to': self.assigned_to,
            'title': self.title,
            'description': self.description,
            'priority': self.priority,
            'status': self.status,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'creator_name': self.user.full_name if self.user else None,
            'assignee_name': self.assignee.full_name if self.assignee else None,
            'contact_name': self.contact.full_name if self.contact else None
        }

# Email System Models
class EmailSend(db.Model):
    __tablename__ = 'email_sends'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    contact_id = db.Column(db.String(36), db.ForeignKey('contacts.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    thread_id = db.Column(db.String(36), db.ForeignKey('email_threads.id', ondelete='CASCADE'), nullable=True)
    sendgrid_message_id = db.Column(db.String(255), unique=True)
    subject = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    from_email = db.Column(db.String(255), nullable=False)
    to_email = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(50), default='sent')  # sent, delivered, opened, clicked, bounced, failed
    sent_at = db.Column(db.DateTime, default=datetime.utcnow)
    delivered_at = db.Column(db.DateTime)
    opened_at = db.Column(db.DateTime)
    clicked_at = db.Column(db.DateTime)
    bounced_at = db.Column(db.DateTime)
    bounce_reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='sent_emails')
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'contact_id': self.contact_id,
            'user_id': self.user_id,
            'thread_id': self.thread_id,
            'sendgrid_message_id': self.sendgrid_message_id,
            'subject': self.subject,
            'content': self.content,
            'from_email': self.from_email,
            'to_email': self.to_email,
            'status': self.status,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'delivered_at': self.delivered_at.isoformat() if self.delivered_at else None,
            'opened_at': self.opened_at.isoformat() if self.opened_at else None,
            'clicked_at': self.clicked_at.isoformat() if self.clicked_at else None,
            'bounced_at': self.bounced_at.isoformat() if self.bounced_at else None,
            'bounce_reason': self.bounce_reason,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'sender_name': self.user.full_name if self.user else None,
            'contact_name': self.contact.full_name if self.contact else None
        }

class EmailThread(db.Model):
    __tablename__ = 'email_threads'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    contact_id = db.Column(db.String(36), db.ForeignKey('contacts.id', ondelete='CASCADE'), nullable=False)
    thread_key = db.Column(db.String(255), nullable=False)  # Normalized subject + email for grouping
    subject = db.Column(db.String(255), nullable=False)
    last_message_at = db.Column(db.DateTime, default=datetime.utcnow)
    message_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    email_sends = db.relationship('EmailSend', backref='thread', lazy=True)
    email_replies = db.relationship('EmailReply', backref='thread', lazy=True)
    
    __table_args__ = (db.UniqueConstraint('tenant_id', 'thread_key', name='unique_tenant_thread'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'contact_id': self.contact_id,
            'thread_key': self.thread_key,
            'subject': self.subject,
            'last_message_at': self.last_message_at.isoformat() if self.last_message_at else None,
            'message_count': self.message_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'contact_name': self.contact.full_name if self.contact else None
        }

class EmailReply(db.Model):
    __tablename__ = 'email_replies'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    contact_id = db.Column(db.String(36), db.ForeignKey('contacts.id', ondelete='CASCADE'), nullable=False)
    thread_id = db.Column(db.String(36), db.ForeignKey('email_threads.id', ondelete='CASCADE'), nullable=False)
    original_send_id = db.Column(db.String(36), db.ForeignKey('email_sends.id', ondelete='CASCADE'), nullable=True)
    message_id = db.Column(db.String(255))  # Email Message-ID header
    subject = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    from_email = db.Column(db.String(255), nullable=False)
    to_email = db.Column(db.String(255), nullable=False)
    received_at = db.Column(db.DateTime, default=datetime.utcnow)
    processed_at = db.Column(db.DateTime, default=datetime.utcnow)
    raw_headers = db.Column(db.JSON)  # Store original email headers
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'contact_id': self.contact_id,
            'thread_id': self.thread_id,
            'original_send_id': self.original_send_id,
            'message_id': self.message_id,
            'subject': self.subject,
            'content': self.content,
            'from_email': self.from_email,
            'to_email': self.to_email,
            'received_at': self.received_at.isoformat() if self.received_at else None,
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
            'raw_headers': self.raw_headers,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'contact_name': self.contact.full_name if self.contact else None
        }

# Email Tracking Models
class EmailPixel(db.Model):
    __tablename__ = 'email_pixels'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    email_send_id = db.Column(db.String(36), db.ForeignKey('email_sends.id', ondelete='CASCADE'), nullable=False)
    tracking_token = db.Column(db.String(255), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    email_send = db.relationship('EmailSend', backref='tracking_pixels')
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'email_send_id': self.email_send_id,
            'tracking_token': self.tracking_token,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class EmailOpen(db.Model):
    __tablename__ = 'email_opens'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    email_send_id = db.Column(db.String(36), db.ForeignKey('email_sends.id', ondelete='CASCADE'), nullable=False)
    ip_address = db.Column(db.String(45))  # IPv6 compatible
    user_agent = db.Column(db.Text)
    opened_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    email_send = db.relationship('EmailSend', backref='opens')
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'email_send_id': self.email_send_id,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'opened_at': self.opened_at.isoformat() if self.opened_at else None
        }

class EmailClick(db.Model):
    __tablename__ = 'email_clicks'
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    tenant_id = db.Column(db.String(36), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    email_send_id = db.Column(db.String(36), db.ForeignKey('email_sends.id', ondelete='CASCADE'), nullable=False)
    url = db.Column(db.Text, nullable=False)
    ip_address = db.Column(db.String(45))  # IPv6 compatible
    user_agent = db.Column(db.Text)
    clicked_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    email_send = db.relationship('EmailSend', backref='clicks')
    
    def to_dict(self):
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'email_send_id': self.email_send_id,
            'url': self.url,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'clicked_at': self.clicked_at.isoformat() if self.clicked_at else None
        }

# Email Threading Utility Functions
def normalize_subject(subject):
    """Remove Re:, Fwd: prefixes for consistent thread grouping"""
    if not subject:
        return ""
    
    # Remove common prefixes (case insensitive)
    prefixes = ['re:', 'fwd:', 'fw:', 'reply:', 'forward:']
    normalized = subject.strip()
    
    while True:
        original = normalized
        for prefix in prefixes:
            if normalized.lower().startswith(prefix):
                normalized = normalized[len(prefix):].strip()
                break
        if normalized == original:
            break
    
    return normalized[:200]  # Limit length for database

def generate_thread_key(subject, email_address):
    """Generate a unique key for email thread grouping"""
    normalized_subject = normalize_subject(subject)
    normalized_email = email_address.lower().strip()
    
    # Create a consistent key for grouping
    thread_key = f"{normalized_subject}|{normalized_email}"
    return thread_key[:255]  # Limit length for database

def extract_message_id_from_headers(headers_dict):
    """Extract Message-ID from email headers"""
    if not headers_dict:
        return None
    
    # Try different possible header names
    possible_keys = ['Message-ID', 'message-id', 'Message-Id', 'MESSAGE-ID']
    
    for key in possible_keys:
        if key in headers_dict:
            message_id = headers_dict[key]
            # Clean up the message ID (remove < > brackets if present)
            if message_id.startswith('<') and message_id.endswith('>'):
                message_id = message_id[1:-1]
            return message_id[:255]  # Limit length for database
    
    return None

def parse_references_header(references_header):
    """Parse References header to extract message IDs for thread reconstruction"""
    if not references_header:
        return []
    
    # Split by whitespace and clean up message IDs
    message_ids = []
    for ref in references_header.split():
        ref = ref.strip()
        if ref.startswith('<') and ref.endswith('>'):
            ref = ref[1:-1]
        if ref:
            message_ids.append(ref)
    
    return message_ids

