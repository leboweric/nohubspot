from flask import Blueprint, request, jsonify, current_app, g
from src.models.user import db, Contact, Interaction, User
from datetime import datetime, timedelta
from functools import wraps
import jwt

contacts_bp = Blueprint('contacts', __name__)

def require_auth(f):
    """Authentication middleware for contacts routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Get token from Authorization header
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                return jsonify({'success': False, 'message': 'Missing or invalid authorization header'}), 401
            
            token = auth_header.split(' ')[1]
            
            # Decode and verify token
            secret_key = current_app.config['JWT_SECRET_KEY']
            payload = jwt.decode(token, secret_key, algorithms=['HS256'])
            
            # Get user from database
            user = User.query.filter_by(id=payload['user_id']).first()
            if not user:
                return jsonify({'success': False, 'message': 'User not found'}), 401
            
            # Store user in g for use in route functions
            g.current_user = user
            
            return f(*args, **kwargs)
            
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'message': 'Invalid token'}), 401
        except Exception as e:
            current_app.logger.error(f'Authentication error: {str(e)}')
            return jsonify({'success': False, 'message': 'Authentication failed'}), 401
    
    return decorated_function

@contacts_bp.route('', methods=['GET'])
@require_auth
def get_contacts():
    """Get all contacts for the authenticated user's tenant"""
    try:
        tenant_id = g.current_user.tenant_id
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        search = request.args.get('search', '')
        
        # Build query
        query = Contact.query.filter_by(tenant_id=tenant_id)
        
        # Add search filter if provided
        if search:
            search_filter = f'%{search}%'
            query = query.filter(
                db.or_(
                    Contact.first_name.ilike(search_filter),
                    Contact.last_name.ilike(search_filter),
                    Contact.email.ilike(search_filter),
                    Contact.company.ilike(search_filter)
                )
            )
        
        # Paginate results
        contacts = query.order_by(Contact.created_at.desc()).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        # Format response
        contacts_data = []
        for contact in contacts.items:
            contacts_data.append({
                'id': contact.id,
                'first_name': contact.first_name,
                'last_name': contact.last_name,
                'full_name': contact.full_name,
                'email': contact.email,
                'phone': contact.phone,
                'company': contact.company,
                'website': contact.website,
                'address': contact.address,
                'notes': contact.notes,
                'created_at': contact.created_at.isoformat() if contact.created_at else None,
                'updated_at': contact.updated_at.isoformat() if contact.updated_at else None
            })
        
        return jsonify({
            'success': True,
            'data': contacts_data,
            'pagination': {
                'page': contacts.page,
                'pages': contacts.pages,
                'per_page': contacts.per_page,
                'total': contacts.total,
                'has_next': contacts.has_next,
                'has_prev': contacts.has_prev
            }
        })
    
    except Exception as e:
        current_app.logger.error(f'Error getting contacts: {str(e)}')
        return jsonify({'success': False, 'message': 'Failed to get contacts'}), 500

@contacts_bp.route('', methods=['POST'])
@require_auth
def create_contact():
    """Create a new contact"""
    try:
        data = request.get_json()
        tenant_id = g.current_user.tenant_id
        
        # Validate required fields
        if not data.get('first_name') or not data.get('last_name'):
            return jsonify({'success': False, 'message': 'First name and last name are required'}), 400
        
        if not data.get('email'):
            return jsonify({'success': False, 'message': 'Email is required'}), 400
        
        # Check if contact with this email already exists for this tenant
        existing_contact = Contact.query.filter_by(
            tenant_id=tenant_id,
            email=data['email']
        ).first()
        
        if existing_contact:
            return jsonify({'success': False, 'message': 'Contact with this email already exists'}), 400
        
        # Create new contact
        contact = Contact(
            tenant_id=tenant_id,
            first_name=data['first_name'].strip(),
            last_name=data['last_name'].strip(),
            email=data['email'].strip().lower(),
            phone=data.get('phone', '').strip(),
            company=data.get('company', '').strip(),
            website=data.get('website', '').strip(),
            address=data.get('address', '').strip(),
            notes=data.get('notes', '').strip()
        )
        
        db.session.add(contact)
        db.session.commit()
        
        # Create contact creation interaction
        interaction = Interaction(
            tenant_id=tenant_id,
            contact_id=contact.id,
            user_id=g.current_user.id,
            type='contact',
            direction='outbound',
            subject='Contact created',
            content=f'Contact {contact.full_name} was created',
            completed_at=datetime.utcnow()
        )
        
        db.session.add(interaction)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': {
                'id': contact.id,
                'first_name': contact.first_name,
                'last_name': contact.last_name,
                'full_name': contact.full_name,
                'email': contact.email,
                'phone': contact.phone,
                'company': contact.company,
                'website': contact.website,
                'address': contact.address,
                'notes': contact.notes,
                'created_at': contact.created_at.isoformat(),
                'updated_at': contact.updated_at.isoformat()
            }
        }), 201
    
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error creating contact: {str(e)}')
        return jsonify({'success': False, 'message': 'Failed to create contact'}), 500

@contacts_bp.route('/<contact_id>', methods=['GET'])
@require_auth
def get_contact(contact_id):
    """Get a specific contact by ID"""
    try:
        tenant_id = g.current_user.tenant_id
        
        contact = Contact.query.filter_by(
            id=contact_id,
            tenant_id=tenant_id
        ).first()
        
        if not contact:
            return jsonify({'success': False, 'message': 'Contact not found'}), 404
        
        return jsonify({
            'success': True,
            'data': {
                'id': contact.id,
                'first_name': contact.first_name,
                'last_name': contact.last_name,
                'full_name': contact.full_name,
                'email': contact.email,
                'phone': contact.phone,
                'company': contact.company,
                'website': contact.website,
                'address': contact.address,
                'notes': contact.notes,
                'created_at': contact.created_at.isoformat() if contact.created_at else None,
                'updated_at': contact.updated_at.isoformat() if contact.updated_at else None
            }
        })
    
    except Exception as e:
        current_app.logger.error(f'Error getting contact: {str(e)}')
        return jsonify({'success': False, 'message': 'Failed to get contact'}), 500

@contacts_bp.route('/<contact_id>', methods=['PUT'])
@require_auth
def update_contact(contact_id):
    """Update a contact"""
    try:
        data = request.get_json()
        tenant_id = g.current_user.tenant_id
        
        contact = Contact.query.filter_by(
            id=contact_id,
            tenant_id=tenant_id
        ).first()
        
        if not contact:
            return jsonify({'success': False, 'message': 'Contact not found'}), 404
        
        # Validate required fields
        if not data.get('first_name') or not data.get('last_name'):
            return jsonify({'success': False, 'message': 'First name and last name are required'}), 400
        
        if not data.get('email'):
            return jsonify({'success': False, 'message': 'Email is required'}), 400
        
        # Check if email is being changed and if it conflicts with another contact
        if data['email'].strip().lower() != contact.email:
            existing_contact = Contact.query.filter_by(
                tenant_id=tenant_id,
                email=data['email'].strip().lower()
            ).first()
            
            if existing_contact:
                return jsonify({'success': False, 'message': 'Contact with this email already exists'}), 400
        
        # Update contact fields
        contact.first_name = data['first_name'].strip()
        contact.last_name = data['last_name'].strip()
        contact.email = data['email'].strip().lower()
        contact.phone = data.get('phone', '').strip()
        contact.company = data.get('company', '').strip()
        contact.website = data.get('website', '').strip()
        contact.address = data.get('address', '').strip()
        contact.notes = data.get('notes', '').strip()
        contact.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': {
                'id': contact.id,
                'first_name': contact.first_name,
                'last_name': contact.last_name,
                'full_name': contact.full_name,
                'email': contact.email,
                'phone': contact.phone,
                'company': contact.company,
                'website': contact.website,
                'address': contact.address,
                'notes': contact.notes,
                'created_at': contact.created_at.isoformat(),
                'updated_at': contact.updated_at.isoformat()
            }
        })
    
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error updating contact: {str(e)}')
        return jsonify({'success': False, 'message': 'Failed to update contact'}), 500

@contacts_bp.route('/<contact_id>', methods=['DELETE'])
@require_auth
def delete_contact(contact_id):
    """Delete a contact"""
    try:
        tenant_id = g.current_user.tenant_id
        
        contact = Contact.query.filter_by(
            id=contact_id,
            tenant_id=tenant_id
        ).first()
        
        if not contact:
            return jsonify({'success': False, 'message': 'Contact not found'}), 404
        
        # Delete associated interactions (removed quote deletion for now)
        Interaction.query.filter_by(contact_id=contact_id).delete()
        
        # Delete the contact
        db.session.delete(contact)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Contact deleted successfully'})
    
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error deleting contact: {str(e)}')
        return jsonify({'success': False, 'message': 'Failed to delete contact'}), 500

@contacts_bp.route('/<contact_id>/timeline', methods=['GET'])
@require_auth
def get_contact_timeline(contact_id):
    """Get timeline/activity for a specific contact"""
    try:
        tenant_id = g.current_user.tenant_id
        
        # Verify contact exists and belongs to tenant
        contact = Contact.query.filter_by(
            id=contact_id,
            tenant_id=tenant_id
        ).first()
        
        if not contact:
            return jsonify({'success': False, 'message': 'Contact not found'}), 404
        
        # Get interactions
        interactions = Interaction.query.filter_by(
            contact_id=contact_id,
            tenant_id=tenant_id
        ).order_by(Interaction.created_at.desc()).all()
        
        # TEMPORARILY DISABLED: Get quotes and their activities
        # quotes = Quote.query.filter_by(
        #     contact_id=contact_id,
        #     tenant_id=tenant_id
        # ).all()
        
        timeline_data = []
        
        # Add interactions to timeline
        for interaction in interactions:
            timeline_data.append({
                'id': interaction.id,
                'type': interaction.type,
                'direction': interaction.direction,
                'subject': interaction.subject,
                'content': interaction.content,
                'content_text': interaction.content_text,
                'content_html': interaction.content_html,
                'opens': interaction.opens or 0,
                'clicks': interaction.clicks or 0,
                'created_at': interaction.created_at.isoformat() if interaction.created_at else None,
                'completed_at': interaction.completed_at.isoformat() if interaction.completed_at else None,
                'updated_at': interaction.updated_at.isoformat() if interaction.updated_at else None
            })
        
        # TEMPORARILY DISABLED: Add quotes to timeline
        # for quote in quotes:
        #     timeline_data.append({
        #         'id': f'quote_{quote.id}',
        #         'type': 'quote',
        #         'direction': 'outbound',
        #         'subject': quote.title,
        #         'content': quote.description or '',
        #         'quote_status': quote.status,
        #         'quote_amount': float(quote.amount) if quote.amount else 0,
        #         'quote_number': quote.quote_number,
        #         'created_at': quote.created_at.isoformat() if quote.created_at else None,
        #         'completed_at': quote.created_at.isoformat() if quote.created_at else None,
        #         'updated_at': quote.updated_at.isoformat() if quote.updated_at else None
        #     })
        
        # Sort by created_at descending
        timeline_data.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return jsonify({
            'success': True,
            'data': timeline_data
        })
    
    except Exception as e:
        current_app.logger.error(f'Error getting contact timeline: {str(e)}')
        return jsonify({'success': False, 'message': 'Failed to get contact timeline'}), 500

@contacts_bp.route('/stats', methods=['GET'])
@require_auth
def get_contact_stats():
    """Get contact statistics for dashboard"""
    try:
        tenant_id = g.current_user.tenant_id
        
        # Get basic contact stats
        total_contacts = Contact.query.filter_by(tenant_id=tenant_id).count()
        
        # Get recent contacts (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_contacts = Contact.query.filter(
            Contact.tenant_id == tenant_id,
            Contact.created_at >= thirty_days_ago
        ).count()
        
        # Get contacts by month for trend data
        six_months_ago = datetime.utcnow() - timedelta(days=180)
        monthly_contacts = db.session.query(
            db.func.date_trunc('month', Contact.created_at).label('month'),
            db.func.count(Contact.id).label('count')
        ).filter(
            Contact.tenant_id == tenant_id,
            Contact.created_at >= six_months_ago
        ).group_by(
            db.func.date_trunc('month', Contact.created_at)
        ).order_by('month').all()
        
        # Format monthly data
        monthly_data = []
        for month, count in monthly_contacts:
            monthly_data.append({
                'month': month.strftime('%Y-%m') if month else None,
                'count': count
            })
        
        return jsonify({
            'success': True,
            'data': {
                'total_contacts': total_contacts,
                'recent_contacts': recent_contacts,
                'monthly_trend': monthly_data
            }
        })
    except Exception as e:
        current_app.logger.error(f'Error getting contact stats: {str(e)}')
        return jsonify({'success': False, 'message': 'Failed to get contact stats'}), 500
