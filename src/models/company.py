from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from src.models.user import db

class Company(db.Model):
    __tablename__ = 'companies'
    
    id = db.Column(db.String(36), primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    industry = db.Column(db.String(100))
    website = db.Column(db.String(255))
    description = db.Column(db.Text)
    address = db.Column(db.Text)
    status = db.Column(db.String(50), default='Active')
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    contacts = db.relationship('Contact', backref='company_ref', lazy=True, cascade='all, delete-orphan')
    attachments = db.relationship('Attachment', backref='company_ref', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Company {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'industry': self.industry,
            'website': self.website,
            'description': self.description,
            'address': self.address,
            'status': self.status,
            'notes': self.notes,
            'contactCount': len(self.contacts),
            'attachmentCount': len(self.attachments),
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }

