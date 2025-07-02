from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Company(Base):
    __tablename__ = "companies"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    industry = Column(String)
    website = Column(String)
    description = Column(Text)
    address = Column(Text)
    status = Column(String, default="Active")  # Active, Lead, Inactive
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    contacts = relationship("Contact", back_populates="company")
    attachments = relationship("Attachment", back_populates="company")

class Contact(Base):
    __tablename__ = "contacts"
    
    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True)
    phone = Column(String)
    title = Column(String)
    status = Column(String, default="Active")  # Active, Lead, Inactive
    notes = Column(Text)
    company_id = Column(Integer, ForeignKey("companies.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    company = relationship("Company", back_populates="contacts")
    email_threads = relationship("EmailThread", back_populates="contact")

class EmailThread(Base):
    __tablename__ = "email_threads"
    
    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String, nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    contact = relationship("Contact", back_populates="email_threads")
    messages = relationship("EmailMessage", back_populates="thread")

class EmailMessage(Base):
    __tablename__ = "email_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(Integer, ForeignKey("email_threads.id"))
    sender = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    direction = Column(String, nullable=False)  # incoming, outgoing
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    thread = relationship("EmailThread", back_populates="messages")

class Attachment(Base):
    __tablename__ = "attachments"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    size = Column(Integer)
    file_type = Column(String)
    url = Column(String, nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"))
    uploaded_by = Column(String, default="System")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    company = relationship("Company", back_populates="attachments")

class Activity(Base):
    __tablename__ = "activities"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    type = Column(String, nullable=False)  # company, contact, email, attachment
    entity_id = Column(String)  # ID of the related entity
    created_at = Column(DateTime(timezone=True), server_default=func.now())
