from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class Company(Base):
    __tablename__ = "companies"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    industry = Column(String(100))
    website = Column(String(255))
    description = Column(Text)
    address = Column(Text)
    status = Column(String(50), default="Lead")  # Lead, Active, Inactive
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    contacts = relationship("Contact", back_populates="company", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="company", cascade="all, delete-orphan")

class Contact(Base):
    __tablename__ = "contacts"
    
    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(50))
    title = Column(String(100))
    status = Column(String(50), default="Lead")  # Lead, Active, Inactive
    notes = Column(Text)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    company = relationship("Company", back_populates="contacts")
    email_threads = relationship("EmailThread", back_populates="contact", cascade="all, delete-orphan")

class EmailThread(Base):
    __tablename__ = "email_threads"
    
    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String(255), nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
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
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    thread = relationship("EmailThread", back_populates="messages")

class Attachment(Base):
    __tablename__ = "attachments"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    file_size = Column(Integer)
    file_type = Column(String(100))
    file_url = Column(String(500))
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    uploaded_by = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    company = relationship("Company", back_populates="attachments")

class Activity(Base):
    __tablename__ = "activities"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    type = Column(String(50), nullable=False)  # company, contact, email, attachment
    entity_id = Column(String(50))  # ID of the related entity
    created_at = Column(DateTime, default=datetime.utcnow)
