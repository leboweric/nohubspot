from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from src.models.user import db

class EmailThread(db.Model):
    __tablename__ = 'email_threads'
    
    id = db.Column(db.String(36), primary_key=True)
    subject = db.Column(db.String(255), nullable=False)
    contact_id = db.Column(db.String(36), db.ForeignKey('contacts.id'), nullable=False)
    preview = db.Column(db.Text)
    message_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    messages = db.relationship('EmailMessage', backref='thread_ref', lazy=True, cascade='all, delete-orphan', order_by='EmailMessage.timestamp')
    
    def __repr__(self):
        return f'<EmailThread {self.subject}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'subject': self.subject,
            'contactId': self.contact_id,
            'preview': self.preview,
            'messageCount': self.message_count,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'messages': [message.to_dict() for message in self.messages]
        }

class EmailMessage(db.Model):
    __tablename__ = 'email_messages'
    
    id = db.Column(db.String(36), primary_key=True)
    thread_id = db.Column(db.String(36), db.ForeignKey('email_threads.id'), nullable=False)
    sender = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    direction = db.Column(db.String(20), nullable=False)  # 'incoming' or 'outgoing'
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    attachments = db.relationship('EmailAttachment', backref='message_ref', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<EmailMessage {self.sender}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'threadId': self.thread_id,
            'sender': self.sender,
            'content': self.content,
            'direction': self.direction,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'attachments': [attachment.to_dict() for attachment in self.attachments]
        }

class EmailAttachment(db.Model):
    __tablename__ = 'email_attachments'
    
    id = db.Column(db.String(36), primary_key=True)
    message_id = db.Column(db.String(36), db.ForeignKey('email_messages.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    
    def __repr__(self):
        return f'<EmailAttachment {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'url': self.url
        }

