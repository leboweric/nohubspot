from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from src.models.user import db

class Activity(db.Model):
    __tablename__ = 'activities'
    
    id = db.Column(db.String(36), primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    type = db.Column(db.String(50), nullable=False)  # 'email', 'contact', 'company', 'attachment'
    entity_id = db.Column(db.String(36), nullable=False)  # ID of the related entity
    date = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Activity {self.title}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'type': self.type,
            'entityId': self.entity_id,
            'date': self.date.isoformat() if self.date else None
        }

