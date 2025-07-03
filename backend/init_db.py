#!/usr/bin/env python3
"""
Database initialization script for NotHubSpot CRM
This script creates all database tables and optionally seeds with sample data.
"""

import os
from datetime import datetime, timedelta
from database import engine, get_db
from models import Base, Company, Contact, Task, EmailSignature
from sqlalchemy.orm import Session

def create_tables():
    """Create all database tables"""
    print("🔨 Creating database tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to create tables: {e}")
        return False

def seed_sample_data():
    """Seed database with sample data"""
    print("🌱 Seeding sample data...")
    
    db = next(get_db())
    
    try:
        # Check if data already exists
        if db.query(Company).count() > 0:
            print("⚠️  Sample data already exists, skipping...")
            return True
        
        # Create sample companies
        companies_data = [
            {
                "name": "Acme Corporation",
                "industry": "Technology",
                "website": "https://acme.example.com",
                "description": "A leading technology company specializing in innovative solutions.",
                "status": "Active"
            },
            {
                "name": "Globex Industries", 
                "industry": "Manufacturing",
                "website": "https://globex.example.com",
                "description": "Manufacturing company focused on sustainable products.",
                "status": "Active"
            },
            {
                "name": "Initech LLC",
                "industry": "Finance", 
                "website": "https://initech.example.com",
                "description": "Financial services provider for small businesses and startups.",
                "status": "Lead"
            }
        ]
        
        db_companies = []
        for company_data in companies_data:
            company = Company(**company_data)
            db.add(company)
            db_companies.append(company)
        
        db.commit()
        
        # Refresh to get IDs
        for company in db_companies:
            db.refresh(company)
        
        # Create sample contacts
        contacts_data = [
            {
                "first_name": "John",
                "last_name": "Smith", 
                "email": "john.smith@acme.example.com",
                "phone": "+1 (555) 123-4567",
                "title": "CTO",
                "company_id": db_companies[0].id,
                "company_name": "Acme Corporation",
                "status": "Active",
                "notes": "Key technical decision maker. Interested in cloud migration solutions."
            },
            {
                "first_name": "Sarah",
                "last_name": "Johnson",
                "email": "sarah.j@acme.example.com", 
                "phone": "+1 (555) 987-6543",
                "title": "Marketing Director",
                "company_id": db_companies[0].id,
                "company_name": "Acme Corporation",
                "status": "Active",
                "notes": "Responsible for all marketing initiatives. Looking for analytics tools."
            },
            {
                "first_name": "Michael",
                "last_name": "Brown",
                "email": "michael.b@globex.example.com",
                "phone": "+1 (555) 456-7890", 
                "title": "CEO",
                "company_id": db_companies[1].id,
                "company_name": "Globex Industries",
                "status": "Active",
                "notes": "Final decision maker. Focuses on cost-efficiency and ROI."
            },
            {
                "first_name": "Emily",
                "last_name": "Davis",
                "email": "emily.d@initech.example.com",
                "title": "CFO", 
                "company_id": db_companies[2].id,
                "company_name": "Initech LLC",
                "status": "Lead",
                "notes": "New lead from conference. Interested in financial planning tools."
            }
        ]
        
        db_contacts = []
        for contact_data in contacts_data:
            contact = Contact(**contact_data)
            db.add(contact)
            db_contacts.append(contact)
        
        db.commit()
        
        # Refresh to get IDs
        for contact in db_contacts:
            db.refresh(contact)
        
        # Update company contact counts
        for company in db_companies:
            contact_count = db.query(Contact).filter(Contact.company_id == company.id).count()
            company.contact_count = contact_count
        
        # Create sample tasks
        tasks_data = [
            {
                "title": "Follow up on proposal with John Smith",
                "description": "Call John Smith to discuss the pricing proposal sent last week. Need to address his concerns about implementation timeline.",
                "status": "pending",
                "priority": "high", 
                "due_date": datetime.utcnow() + timedelta(days=2),
                "assigned_to": "Sales Rep",
                "contact_id": db_contacts[0].id,
                "contact_name": "John Smith",
                "company_id": db_companies[0].id,
                "company_name": "Acme Corporation",
                "type": "call",
                "tags": ["proposal", "follow-up", "pricing"]
            },
            {
                "title": "Send demo invitation to Sarah Johnson", 
                "description": "Schedule and send calendar invite for product demo next week.",
                "status": "in_progress",
                "priority": "medium",
                "due_date": datetime.utcnow() + timedelta(days=1),
                "assigned_to": "Sales Rep",
                "contact_id": db_contacts[1].id,
                "contact_name": "Sarah Johnson", 
                "company_id": db_companies[0].id,
                "company_name": "Acme Corporation",
                "type": "email",
                "tags": ["demo", "calendar"]
            },
            {
                "title": "Prepare quarterly business review",
                "description": "Compile Q4 metrics and prepare presentation for upcoming QBR meeting.",
                "status": "pending",
                "priority": "urgent",
                "due_date": datetime.utcnow() - timedelta(days=1),  # Overdue
                "assigned_to": "Sales Rep",
                "type": "other",
                "tags": ["qbr", "presentation", "quarterly"]
            }
        ]
        
        for task_data in tasks_data:
            task = Task(**task_data)
            db.add(task)
        
        # Create default email signature
        signature = EmailSignature(
            user_id="default",
            name="Sales Rep",
            title="Sales Representative", 
            company="NotHubSpot CRM",
            email="sales@nothubspot.app",
            enabled=True
        )
        db.add(signature)
        
        db.commit()
        print("✅ Sample data seeded successfully")
        return True
        
    except Exception as e:
        print(f"❌ Failed to seed data: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def main():
    """Main initialization function"""
    print("🚀 Initializing NotHubSpot CRM Database...")
    
    # Create tables
    if not create_tables():
        return False
    
    # Seed sample data
    if not seed_sample_data():
        return False
    
    print("🎉 Database initialization completed successfully!")
    return True

if __name__ == "__main__":
    main()