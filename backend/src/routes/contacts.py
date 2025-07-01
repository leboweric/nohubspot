from flask import Blueprint, request, jsonify, current_app, g
from src.models.user import db, Contact, Interaction, User
from datetime import datetime, timedelta
from functools import wraps
import jwt

contacts_bp = Blueprint('contacts', __name__)

def require_auth(f):
    """Authentication middleware"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'success': False, 'error': {'message': 'Authorization header required'}}), 401
        
        token = auth_header.split(' ')[1]
        
        try:
            payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
            g.current_user_id = payload['user_id']
            g.current_tenant_id = payload['tenant_id']
            g.current_user_role = payload['role']
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'error': {'message': 'Token expired'}}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'error': {'message': 'Invalid token'}}), 401
        
        return f(*args, **kwargs)
    return decorated_function

@contacts_bp.route('', methods=['GET'])
@require_auth
def get_contacts():
    """Get paginated list of contacts with filtering"""
    try:
        # Query parameters
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 25, type=int)
        search = request.args.get('search', '')
        status = request.args.get('status', '')
        assigned_to = request.args.get('assigned_to', '')
        sort = request.args.get('sort', 'updated_at')
        order = request.args.get('order', 'desc')
        
        # Limit page size
        limit = min(limit, 100)
        
        # Base query with tenant isolation
        query = Contact.query.filter_by(tenant_id=g.current_tenant_id)
        
        # Apply filters
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                db.or_(
                    Contact.first_name.ilike(search_term),
                    Contact.last_name.ilike(search_term),
                    Contact.email.ilike(search_term),
                    Contact.company.ilike(search_term)
                )
            )
        
        if status:
            query = query.filter_by(status=status)
        
        if assigned_to:
            query = query.filter_by(assigned_to=assigned_to)
        
        # Apply sorting
        if hasattr(Contact, sort):
            if order.lower() == 'desc':
                query = query.order_by(getattr(Contact, sort).desc())
            else:
                query = query.order_by(getattr(Contact, sort))
        
        # Paginate
        pagination = query.paginate(
            page=page,
            per_page=limit,
            error_out=False
        )
        
        contacts = [contact.to_dict() for contact in pagination.items]
        
        return jsonify({
            'success': True,
            'data': contacts,
            'meta': {
                'page': page,
                'limit': limit,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@contacts_bp.route('', methods=['POST'])
@require_auth
def create_contact():
    """Create new contact"""
    try:
        data = request.get_json()
        
        # Validate required fields (at least one of name or email)
        if not data.get('first_name') and not data.get('last_name') and not data.get('email'):
            return jsonify({
                'success': False, 
                'error': {'message': 'At least first name, last name, or email is required'}
            }), 400
        
        # Create contact
        contact = Contact(
            tenant_id=g.current_tenant_id,
            first_name=data.get('first_name'),
            last_name=data.get('last_name'),
            email=data.get('email'),
            phone=data.get('phone'),
            company=data.get('company'),
            job_title=data.get('job_title'),
            website=data.get('website'),
            address=data.get('address'),
            notes=data.get('notes'),
            status=data.get('status', 'active'),
            source=data.get('source'),
            assigned_to=data.get('assigned_to'),
            created_by=g.current_user_id
        )
        
        db.session.add(contact)
        db.session.commit()
        
        # Log creation interaction
        interaction = Interaction(
            tenant_id=g.current_tenant_id,
            contact_id=contact.id,
            user_id=g.current_user_id,
            type='note',
            subject='Contact created',
            content=f'Contact {contact.full_name or contact.email} was created',
            direction='outbound',
            status='completed',
            completed_at=datetime.utcnow()
        )
        db.session.add(interaction)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': contact.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@contacts_bp.route('/<contact_id>', methods=['GET'])
@require_auth
def get_contact(contact_id):
    """Get contact details"""
    try:
        contact = Contact.query.filter_by(
            id=contact_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not contact:
            return jsonify({'success': False, 'error': {'message': 'Contact not found'}}), 404
        
        return jsonify({
            'success': True,
            'data': contact.to_dict()
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@contacts_bp.route('/<contact_id>', methods=['PUT'])
@require_auth
def update_contact(contact_id):
    """Update contact"""
    try:
        contact = Contact.query.filter_by(
            id=contact_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not contact:
            return jsonify({'success': False, 'error': {'message': 'Contact not found'}}), 404
        
        data = request.get_json()
        
        # Update fields
        updatable_fields = [
            'first_name', 'last_name', 'email', 'phone', 'company',
            'job_title', 'website', 'address', 'notes', 'status',
            'source', 'assigned_to', 'lead_score'
        ]
        
        for field in updatable_fields:
            if field in data:
                setattr(contact, field, data[field])
        
        contact.updated_at = datetime.utcnow()
        db.session.commit()
        
        # Log update interaction
        interaction = Interaction(
            tenant_id=g.current_tenant_id,
            contact_id=contact.id,
            user_id=g.current_user_id,
            type='note',
            subject='Contact updated',
            content=f'Contact {contact.full_name or contact.email} was updated',
            direction='outbound',
            status='completed',
            completed_at=datetime.utcnow()
        )
        db.session.add(interaction)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': contact.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@contacts_bp.route('/<contact_id>', methods=['DELETE'])
@require_auth
def delete_contact(contact_id):
    """Delete contact"""
    try:
        contact = Contact.query.filter_by(
            id=contact_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not contact:
            return jsonify({'success': False, 'error': {'message': 'Contact not found'}}), 404
        
        db.session.delete(contact)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': {'message': 'Contact deleted successfully'}
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@contacts_bp.route('/<contact_id>/timeline', methods=['GET'])
@require_auth
def get_contact_timeline(contact_id):
    """Get contact interaction timeline"""
    try:
        contact = Contact.query.filter_by(
            id=contact_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not contact:
            return jsonify({'success': False, 'error': {'message': 'Contact not found'}}), 404
        
        # Get interactions
        interactions = Interaction.query.filter_by(
            contact_id=contact_id,
            tenant_id=g.current_tenant_id
        ).order_by(Interaction.created_at.desc()).all()
        
        timeline = []
        for interaction in interactions:
            item = interaction.to_dict()
            
            # Add user info
            if interaction.user_id:
                user = User.query.get(interaction.user_id)
                if user:
                    item['user'] = {
                        'id': user.id,
                        'full_name': user.full_name,
                        'email': user.email
                    }
            
            timeline.append(item)
        
        return jsonify({
            'success': True,
            'data': timeline
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@contacts_bp.route('/stats', methods=['GET'])
@require_auth
def get_contact_stats():
    """Get contact statistics for dashboard"""
    try:
        # Total contacts
        total_contacts = Contact.query.filter_by(tenant_id=g.current_tenant_id).count()
        
        # Active leads
        active_leads = Contact.query.filter_by(
            tenant_id=g.current_tenant_id,
            status='active'
        ).count()
        
        # Recent contacts (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_contacts = Contact.query.filter(
            Contact.tenant_id == g.current_tenant_id,
            Contact.created_at >= thirty_days_ago
        ).count()
        
        return jsonify({
            'success': True,
            'data': {
                'total_contacts': total_contacts,
                'active_leads': active_leads,
                'recent_contacts': recent_contacts
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500
