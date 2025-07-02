from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from src.models.user import db

class Contact(db.Model):
    __tablename__ = 'contacts'
    
    id = db.Column(db.String(36), primary_key=True)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(50))
    title = db.Column(db.String(100))
    company_id = db.Column(db.String(36), db.ForeignKey('companies.id'), nullable=False)
    status = db.Column(db.String(50), default='Active')
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    email_threads = db.relationship('EmailThread', backref='contact_ref', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Contact {self.first_name} {self.last_name}>'
    
    def to_dict(self):
        from src.models.company import Company
        company = Company.query.get(self.company_id)
        return {
            'id': self.id,
            'firstName': self.first_name,
            'lastName': self.last_name,
            'email': self.email,
            'phone': self.phone,
            'title': self.title,
            'companyId': self.company_id,
            'companyName': company.name if company else None,
            'status': self.status,
            'notes': self.notes,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }

