from flask import Blueprint, request, jsonify
from src.models.user import db
from src.models.company import Company
from src.models.contact import Contact
from src.models.attachment import Attachment
from src.models.activity import Activity
import uuid
from datetime import datetime

companies_bp = Blueprint('companies', __name__)

@companies_bp.route('/companies', methods=['GET'])
def get_companies():
    """Get all companies"""
    try:
        companies = Company.query.all()
        return jsonify([company.to_dict() for company in companies])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@companies_bp.route('/companies/<company_id>', methods=['GET'])
def get_company(company_id):
    """Get a specific company by ID"""
    try:
        company = Company.query.get_or_404(company_id)
        return jsonify(company.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@companies_bp.route('/companies', methods=['POST'])
def create_company():
    """Create a new company"""
    try:
        data = request.get_json()
        
        company_id = str(uuid.uuid4())
        company = Company(
            id=company_id,
            name=data.get('name'),
            industry=data.get('industry'),
            website=data.get('website'),
            description=data.get('description'),
            address=data.get('address'),
            status=data.get('status', 'Active'),
            notes=data.get('notes')
        )
        
        db.session.add(company)
        
        # Add activity
        activity = Activity(
            id=str(uuid.uuid4()),
            title='Company Added',
            description=f'Added {company.name} as a new company',
            type='company',
            entity_id=company_id
        )
        db.session.add(activity)
        
        db.session.commit()
        return jsonify(company.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@companies_bp.route('/companies/<company_id>', methods=['PUT'])
def update_company(company_id):
    """Update a company"""
    try:
        company = Company.query.get_or_404(company_id)
        data = request.get_json()
        
        company.name = data.get('name', company.name)
        company.industry = data.get('industry', company.industry)
        company.website = data.get('website', company.website)
        company.description = data.get('description', company.description)
        company.address = data.get('address', company.address)
        company.status = data.get('status', company.status)
        company.notes = data.get('notes', company.notes)
        
        db.session.commit()
        return jsonify(company.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@companies_bp.route('/companies/<company_id>', methods=['DELETE'])
def delete_company(company_id):
    """Delete a company"""
    try:
        company = Company.query.get_or_404(company_id)
        db.session.delete(company)
        db.session.commit()
        return jsonify({'message': 'Company deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@companies_bp.route('/companies/<company_id>/contacts', methods=['GET'])
def get_company_contacts(company_id):
    """Get all contacts for a company"""
    try:
        contacts = Contact.query.filter_by(company_id=company_id).all()
        return jsonify([contact.to_dict() for contact in contacts])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@companies_bp.route('/companies/<company_id>/attachments', methods=['GET'])
def get_company_attachments(company_id):
    """Get all attachments for a company"""
    try:
        attachments = Attachment.query.filter_by(company_id=company_id).all()
        return jsonify([attachment.to_dict() for attachment in attachments])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

