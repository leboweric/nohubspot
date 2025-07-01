from flask import Blueprint, request, jsonify, current_app, g
from src.models.user import db, Contact, Interaction, User, Quote
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

@contacts_bp.route('/', methods=['GET'])
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

@contacts_bp.route('/', methods=['POST'])
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
    """Get contact interaction timeline including quotes"""
    try:
        contact = Contact.query.filter_by(
            id=contact_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not contact:
            return jsonify({'success': False, 'error': {'message': 'Contact not found'}}), 404
        
        # Get all interactions for this contact
        interactions = Interaction.query.filter_by(
            contact_id=contact_id,
            tenant_id=g.current_tenant_id
        ).order_by(Interaction.created_at.desc()).all()
        
        # Also get quote-related activities for better timeline integration
        quote_activities = []
        quotes = Quote.query.filter_by(
            contact_id=contact_id,
            tenant_id=g.current_tenant_id
        ).all()
        
        for quote in quotes:
            # Add quote creation to timeline
            quote_activities.append({
                'id': f"quote-{quote.id}",
                'type': 'quote',
                'subject': f"Quote created: {quote.title}",
                'content': f"Quote {quote.quote_number} created for ${float(quote.amount) if quote.amount else 0}",
                'direction': 'outbound',
                'status': 'completed',
                'created_at': quote.created_at.isoformat() if quote.created_at else None,
                'completed_at': quote.created_at.isoformat() if quote.created_at else None,
                'updated_at': quote.updated_at.isoformat() if quote.updated_at else None,
                'quote_id': quote.id,
                'quote_status': quote.status,
                'quote_amount': float(quote.amount) if quote.amount else 0
            })
            
            # Add sent activity if sent
            if quote.sent_at:
                quote_activities.append({
                    'id': f"quote-sent-{quote.id}",
                    'type': 'quote',
                    'subject': f"Quote sent: {quote.title}",
                    'content': f"Quote {quote.quote_number} sent for ${float(quote.amount) if quote.amount else 0}",
                    'direction': 'outbound',
                    'status': 'completed',
                    'created_at': quote.sent_at.isoformat(),
                    'completed_at': quote.sent_at.isoformat(),
                    'updated_at': quote.sent_at.isoformat(),
                    'quote_id': quote.id,
                    'quote_status': quote.status,
                    'quote_amount': float(quote.amount) if quote.amount else 0
                })
            
            # Add viewed activity if viewed
            if quote.viewed_at:
                quote_activities.append({
                    'id': f"quote-viewed-{quote.id}",
                    'type': 'quote',
                    'subject': f"Quote viewed: {quote.title}",
                    'content': f"Quote {quote.quote_number} was viewed",
                    'direction': 'inbound',
                    'status': 'completed',
                    'created_at': quote.viewed_at.isoformat(),
                    'completed_at': quote.viewed_at.isoformat(),
                    'updated_at': quote.viewed_at.isoformat(),
                    'quote_id': quote.id,
                    'quote_status': quote.status,
                    'quote_amount': float(quote.amount) if quote.amount else 0
                })
            
            # Add accepted/rejected activity if responded
            if quote.accepted_at:
                quote_activities.append({
                    'id': f"quote-accepted-{quote.id}",
                    'type': 'quote',
                    'subject': f"Quote accepted: {quote.title}",
                    'content': f"Quote {quote.quote_number} was accepted! 🎉",
                    'direction': 'inbound',
                    'status': 'completed',
                    'created_at': quote.accepted_at.isoformat(),
                    'completed_at': quote.accepted_at.isoformat(),
                    'updated_at': quote.accepted_at.isoformat(),
                    'quote_id': quote.id,
                    'quote_status': quote.status,
                    'quote_amount': float(quote.amount) if quote.amount else 0
                })
            elif quote.rejected_at:
                quote_activities.append({
                    'id': f"quote-rejected-{quote.id}",
                    'type': 'quote',
                    'subject': f"Quote rejected: {quote.title}",
                    'content': f"Quote {quote.quote_number} was rejected" + (f": {quote.rejection_reason}" if quote.rejection_reason else ""),
                    'direction': 'inbound',
                    'status': 'completed',
                    'created_at': quote.rejected_at.isoformat(),
                    'completed_at': quote.rejected_at.isoformat(),
                    'updated_at': quote.rejected_at.isoformat(),
                    'quote_id': quote.id,
                    'quote_status': quote.status,
                    'quote_amount': float(quote.amount) if quote.amount else 0
                })
        
        # Convert interactions to dict format
        interaction_data = []
        for interaction in interactions:
            interaction_dict = {
                'id': interaction.id,
                'type': interaction.type,
                'subject': interaction.subject,
                'content': interaction.content,
                'direction': interaction.direction,
                'status': interaction.status,
                'created_at': interaction.created_at.isoformat() if interaction.created_at else None,
                'completed_at': interaction.completed_at.isoformat() if interaction.completed_at else None,
                'updated_at': interaction.updated_at.isoformat() if interaction.updated_at else None
            }
            
            # Add user info
            if interaction.user_id:
                user = User.query.get(interaction.user_id)
                if user:
                    interaction_dict['user'] = {
                        'id': user.id,
                        'full_name': user.full_name,
                        'email': user.email
                    }
            
            interaction_data.append(interaction_dict)
        
        # Combine interactions and quote activities
        all_activities = interaction_data + quote_activities
        
        # Sort by created_at timestamp (most recent first)
        all_activities.sort(key=lambda x: x['created_at'] or '1970-01-01T00:00:00', reverse=True)
        
        return jsonify({
            'success': True,
            'data': all_activities
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting contact timeline: {e}")
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
