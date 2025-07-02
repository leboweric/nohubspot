from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from src.models.user import db

class Attachment(db.Model):
    __tablename__ = 'attachments'
    
    id = db.Column(db.String(36), primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    size = db.Column(db.Integer)  # Size in bytes
    type = db.Column(db.String(100))  # MIME type
    url = db.Column(db.String(500), nullable=False)
    company_id = db.Column(db.String(36), db.ForeignKey('companies.id'), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    uploaded_by = db.Column(db.String(255), default='Sales Rep')
    
    def __repr__(self):
        return f'<Attachment {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'size': self.size,
            'type': self.type,
            'url': self.url,
            'companyId': self.company_id,
            'uploadedAt': self.uploaded_at.isoformat() if self.uploaded_at else None,
            'uploadedBy': self.uploaded_by
        }
