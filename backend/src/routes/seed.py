from flask import Blueprint, jsonify
from src.models.user import db
from src.models.company import Company
from src.models.contact import Contact
from src.models.activity import Activity
import uuid
from datetime import datetime

seed_bp = Blueprint('seed', __name__)

@seed_bp.route('/seed', methods=['POST'])
def seed_database():
    """Seed the database with initial sample data"""
    try:
        # Check if data already exists
        if Company.query.count() > 0:
            return jsonify({'message': 'Database already contains data'}), 200
        
        # Create sample companies
        companies_data = [
            {
                'id': str(uuid.uuid4()),
                'name': 'Acme Corporation',
                'industry': 'Technology',
                'website': 'https://acme.example.com',
                'description': 'A leading technology company specializing in innovative solutions.',
                'address': '123 Tech Lane, San Francisco, CA 94107',
                'status': 'Active',
                'notes': 'Key account with multiple ongoing projects.'
            },
            {
                'id': str(uuid.uuid4()),
                'name': 'Globex Industries',
                'industry': 'Manufacturing',
                'website': 'https://globex.example.com',
                'description': 'Manufacturing company focused on sustainable products.',
                'address': '456 Factory Blvd, Detroit, MI 48201',
                'status': 'Active'
            },
            {
                'id': str(uuid.uuid4()),
                'name': 'Initech LLC',
                'industry': 'Finance',
                'website': 'https://initech.example.com',
                'description': 'Financial services provider for small businesses and startups.',
                'address': '789 Finance Ave, New York, NY 10004',
                'status': 'Lead'
            }
        ]
        
        companies = []
        for company_data in companies_data:
            company = Company(**company_data)
            companies.append(company)
            db.session.add(company)
        
        # Create sample contacts
        contacts_data = [
            {
                'id': str(uuid.uuid4()),
                'first_name': 'John',
                'last_name': 'Smith',
                'email': 'john.smith@acme.example.com',
                'phone': '+1 (555) 123-4567',
                'title': 'CTO',
                'company_id': companies[0].id,
                'status': 'Active',
                'notes': 'Key decision maker for technology purchases.'
            },
            {
                'id': str(uuid.uuid4()),
                'first_name': 'Sarah',
                'last_name': 'Johnson',
                'email': 'sarah.j@acme.example.com',
                'phone': '+1 (555) 987-6543',
                'title': 'Marketing Director',
                'company_id': companies[0].id,
                'status': 'Active'
            },
            {
                'id': str(uuid.uuid4()),
                'first_name': 'Michael',
                'last_name': 'Brown',
                'email': 'michael.b@globex.example.com',
                'phone': '+1 (555) 456-7890',
                'title': 'CEO',
                'company_id': companies[1].id,
                'status': 'Active',
                'notes': 'Interested in expanding partnership.'
            },
            {
                'id': str(uuid.uuid4()),
                'first_name': 'Emily',
                'last_name': 'Davis',
                'email': 'emily.d@initech.example.com',
                'title': 'CFO',
                'company_id': companies[2].id,
                'status': 'Lead'
            }
        ]
        
        for contact_data in contacts_data:
            contact = Contact(**contact_data)
            db.session.add(contact)
        
        # Create sample activities
        activities_data = [
            {
                'id': str(uuid.uuid4()),
                'title': 'Company Added',
                'description': 'Added Acme Corporation as a new company',
                'type': 'company',
                'entity_id': companies[0].id
            },
            {
                'id': str(uuid.uuid4()),
                'title': 'Contact Added',
                'description': 'Added John Smith as a new contact',
                'type': 'contact',
                'entity_id': contacts_data[0]['id']
            },
            {
                'id': str(uuid.uuid4()),
                'title': 'Contact Added',
                'description': 'Added Sarah Johnson as a new contact',
                'type': 'contact',
                'entity_id': contacts_data[1]['id']
            }
        ]
        
        for activity_data in activities_data:
            activity = Activity(**activity_data)
            db.session.add(activity)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Database seeded successfully',
            'companies': len(companies_data),
            'contacts': len(contacts_data),
            'activities': len(activities_data)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

