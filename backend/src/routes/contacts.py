from flask import Blueprint, request, jsonify
from src.models.user import db
from src.models.contact import Contact
from src.models.company import Company
from src.models.email import EmailThread
from src.models.activity import Activity
import uuid

contacts_bp = Blueprint('contacts', __name__)

@contacts_bp.route('/contacts', methods=['GET'])
def get_contacts():
    """Get all contacts"""
    try:
        contacts = Contact.query.all()
        return jsonify([contact.to_dict() for contact in contacts])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/contacts/<contact_id>', methods=['GET'])
def get_contact(contact_id):
    """Get a specific contact by ID"""
    try:
        contact = Contact.query.get_or_404(contact_id)
        return jsonify(contact.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/contacts', methods=['POST'])
def create_contact():
    """Create a new contact"""
    try:
        data = request.get_json()
        
        # Verify company exists
        company = Company.query.get(data.get('companyId'))
        if not company:
            return jsonify({'error': 'Company not found'}), 404
        
        contact_id = str(uuid.uuid4())
        contact = Contact(
            id=contact_id,
            first_name=data.get('firstName'),
            last_name=data.get('lastName'),
            email=data.get('email'),
            phone=data.get('phone'),
            title=data.get('title'),
            company_id=data.get('companyId'),
            status=data.get('status', 'Active'),
            notes=data.get('notes')
        )
        
        db.session.add(contact)
        
        # Add activity
        activity = Activity(
            id=str(uuid.uuid4()),
            title='Contact Added',
            description=f'Added {contact.first_name} {contact.last_name} as a new contact',
            type='contact',
            entity_id=contact_id
        )
        db.session.add(activity)
        
        db.session.commit()
        return jsonify(contact.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/contacts/<contact_id>', methods=['PUT'])
def update_contact(contact_id):
    """Update a contact"""
    try:
        contact = Contact.query.get_or_404(contact_id)
        data = request.get_json()
        
        # Verify company exists if changing company
        if 'companyId' in data and data['companyId'] != contact.company_id:
            company = Company.query.get(data['companyId'])
            if not company:
                return jsonify({'error': 'Company not found'}), 404
        
        contact.first_name = data.get('firstName', contact.first_name)
        contact.last_name = data.get('lastName', contact.last_name)
        contact.email = data.get('email', contact.email)
        contact.phone = data.get('phone', contact.phone)
        contact.title = data.get('title', contact.title)
        contact.company_id = data.get('companyId', contact.company_id)
        contact.status = data.get('status', contact.status)
        contact.notes = data.get('notes', contact.notes)
        
        db.session.commit()
        return jsonify(contact.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/contacts/<contact_id>', methods=['DELETE'])
def delete_contact(contact_id):
    """Delete a contact"""
    try:
        contact = Contact.query.get_or_404(contact_id)
        db.session.delete(contact)
        db.session.commit()
        return jsonify({'message': 'Contact deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/contacts/<contact_id>/email-threads', methods=['GET'])
def get_contact_email_threads(contact_id):
    """Get all email threads for a contact"""
    try:
        threads = EmailThread.query.filter_by(contact_id=contact_id).all()
        return jsonify([thread.to_dict() for thread in threads])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

