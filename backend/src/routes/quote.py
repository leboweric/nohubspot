from flask import Blueprint, request, jsonify, g, current_app
from src.models.user import db, Quote, QuoteLineItem, QuoteActivity, Contact, Interaction, User, Tenant
from datetime import datetime, timedelta
from functools import wraps
import jwt
import uuid
import os
from decimal import Decimal

quotes_bp = Blueprint('quotes', __name__)

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

def generate_quote_number(tenant_id):
    """Generate a unique quote number for the tenant"""
    year = datetime.utcnow().year
    
    # Get the highest quote number for this tenant and year
    last_quote = Quote.query.filter(
        Quote.tenant_id == tenant_id,
        Quote.quote_number.like(f"{year}-%")
    ).order_by(Quote.quote_number.desc()).first()
    
    if last_quote:
        # Extract the sequence number and increment
        try:
            last_sequence = int(last_quote.quote_number.split('-')[1])
            next_sequence = last_sequence + 1
        except (IndexError, ValueError):
            next_sequence = 1
    else:
        next_sequence = 1
    
    # Format: 2025-0001, 2025-0002, etc.
    return f"{year}-{next_sequence:04d}"

@quotes_bp.route('/', methods=['GET'])
@require_auth
def get_quotes():
    """Get all quotes for the tenant"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        contact_id = request.args.get('contact_id')
        
        # Build query
        query = Quote.query.filter_by(tenant_id=g.current_tenant_id)
        
        if status:
            query = query.filter_by(status=status)
        
        if contact_id:
            query = query.filter_by(contact_id=contact_id)
        
        # Order by created_at desc
        query = query.order_by(Quote.created_at.desc())
        
        # Paginate
        quotes = query.paginate(
            page=page, 
            per_page=per_page, 
            error_out=False
        )
        
        return jsonify({
            'success': True,
            'quotes': [quote.to_dict() for quote in quotes.items],
            'pagination': {
                'page': quotes.page,
                'pages': quotes.pages,
                'per_page': quotes.per_page,
                'total': quotes.total
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting quotes: {e}")
        return jsonify({
            'success': False,
            'error': {'message': 'Internal server error'}
        }), 500

@quotes_bp.route('/<quote_id>', methods=['GET'])
@require_auth
def get_quote(quote_id):
    """Get a specific quote with line items and activities"""
    try:
        quote = Quote.query.filter_by(
            id=quote_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not quote:
            return jsonify({'success': False, 'error': {'message': 'Quote not found'}}), 404
        
        # Get activities
        activities = QuoteActivity.query.filter_by(quote_id=quote_id).order_by(QuoteActivity.created_at.desc()).all()
        
        quote_data = quote.to_dict()
        quote_data['activities'] = [activity.to_dict() for activity in activities]
        
        return jsonify({
            'success': True,
            'quote': quote_data
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting quote: {e}")
        return jsonify({
            'success': False,
            'error': {'message': 'Internal server error'}
        }), 500

@quotes_bp.route('/', methods=['POST'])
@require_auth
def create_quote():
    """Create a new quote"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['contact_id', 'title']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'error': {'message': f'{field} is required'}}), 400
        
        # Verify contact exists and belongs to tenant
        contact = Contact.query.filter_by(
            id=data['contact_id'],
            tenant_id=g.current_tenant_id
        ).first()
        
        if not contact:
            return jsonify({'success': False, 'error': {'message': 'Contact not found'}}), 404
        
        # Generate quote number
        quote_number = generate_quote_number(g.current_tenant_id)
        
        # Create quote
        quote = Quote(
            tenant_id=g.current_tenant_id,
            contact_id=data['contact_id'],
            user_id=g.current_user_id,
            quote_number=quote_number,
            title=data['title'],
            description=data.get('description'),
            amount=Decimal(str(data['amount'])) if data.get('amount') else None,
            currency=data.get('currency', 'USD'),
            status='draft',
            valid_until=datetime.fromisoformat(data['valid_until'].replace('Z', '+00:00')) if data.get('valid_until') else None,
            notes=data.get('notes')
        )
        
        db.session.add(quote)
        db.session.flush()  # Get quote ID
        
        # Add line items if provided
        if data.get('line_items'):
            for i, item_data in enumerate(data['line_items']):
                quantity = Decimal(str(item_data.get('quantity', 1)))
                unit_price = Decimal(str(item_data['unit_price']))
                total_price = quantity * unit_price
                
                line_item = QuoteLineItem(
                    quote_id=quote.id,
                    description=item_data['description'],
                    quantity=quantity,
                    unit_price=unit_price,
                    total_price=total_price,
                    sort_order=i
                )
                db.session.add(line_item)
        
        # Create activity record
        activity = QuoteActivity(
            tenant_id=g.current_tenant_id,
            quote_id=quote.id,
            user_id=g.current_user_id,
            activity_type='created',
            description=f"Quote {quote_number} created"
        )
        db.session.add(activity)
        
        # Create interaction for timeline
        interaction = Interaction(
            tenant_id=g.current_tenant_id,
            contact_id=contact.id,
            user_id=g.current_user_id,
            type='quote',
            subject=f"Quote created: {data['title']}",
            content=f"Quote {quote_number} created for ${quote.amount or 0}",
            direction='outbound',
            status='completed',
            completed_at=datetime.utcnow()
        )
        db.session.add(interaction)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Quote created successfully',
            'quote': quote.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating quote: {e}")
        return jsonify({
            'success': False,
            'error': {'message': 'Internal server error'}
        }), 500

@quotes_bp.route('/<quote_id>', methods=['PUT'])
@require_auth
def update_quote(quote_id):
    """Update a quote"""
    try:
        quote = Quote.query.filter_by(
            id=quote_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not quote:
            return jsonify({'success': False, 'error': {'message': 'Quote not found'}}), 404
        
        data = request.get_json()
        
        # Update quote fields
        if 'title' in data:
            quote.title = data['title']
        if 'description' in data:
            quote.description = data['description']
        if 'amount' in data:
            quote.amount = Decimal(str(data['amount'])) if data['amount'] else None
        if 'currency' in data:
            quote.currency = data['currency']
        if 'valid_until' in data:
            quote.valid_until = datetime.fromisoformat(data['valid_until'].replace('Z', '+00:00')) if data['valid_until'] else None
        if 'notes' in data:
            quote.notes = data['notes']
        
        quote.updated_at = datetime.utcnow()
        
        # Update line items if provided
        if 'line_items' in data:
            # Delete existing line items
            QuoteLineItem.query.filter_by(quote_id=quote.id).delete()
            
            # Add new line items
            for i, item_data in enumerate(data['line_items']):
                quantity = Decimal(str(item_data.get('quantity', 1)))
                unit_price = Decimal(str(item_data['unit_price']))
                total_price = quantity * unit_price
                
                line_item = QuoteLineItem(
                    quote_id=quote.id,
                    description=item_data['description'],
                    quantity=quantity,
                    unit_price=unit_price,
                    total_price=total_price,
                    sort_order=i
                )
                db.session.add(line_item)
        
        # Create activity record
        activity = QuoteActivity(
            tenant_id=g.current_tenant_id,
            quote_id=quote.id,
            user_id=g.current_user_id,
            activity_type='updated',
            description=f"Quote {quote.quote_number} updated"
        )
        db.session.add(activity)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Quote updated successfully',
            'quote': quote.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating quote: {e}")
        return jsonify({
            'success': False,
            'error': {'message': 'Internal server error'}
        }), 500

@quotes_bp.route('/<quote_id>/send', methods=['POST'])
@require_auth
def send_quote(quote_id):
    """Mark quote as sent and create timeline entry"""
    try:
        quote = Quote.query.filter_by(
            id=quote_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not quote:
            return jsonify({'success': False, 'error': {'message': 'Quote not found'}}), 404
        
        # Update quote status
        quote.status = 'sent'
        quote.sent_at = datetime.utcnow()
        quote.updated_at = datetime.utcnow()
        
        # Create activity record
        activity = QuoteActivity(
            tenant_id=g.current_tenant_id,
            quote_id=quote.id,
            user_id=g.current_user_id,
            activity_type='sent',
            description=f"Quote {quote.quote_number} sent to {quote.contact.full_name}"
        )
        db.session.add(activity)
        
        # Create interaction for timeline
        interaction = Interaction(
            tenant_id=g.current_tenant_id,
            contact_id=quote.contact_id,
            user_id=g.current_user_id,
            type='quote',
            subject=f"Quote sent: {quote.title}",
            content=f"Quote {quote.quote_number} sent for ${quote.amount or 0}",
            direction='outbound',
            status='completed',
            completed_at=datetime.utcnow()
        )
        db.session.add(interaction)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Quote sent successfully',
            'quote': quote.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error sending quote: {e}")
        return jsonify({
            'success': False,
            'error': {'message': 'Internal server error'}
        }), 500

@quotes_bp.route('/<quote_id>/status', methods=['PUT'])
@require_auth
def update_quote_status(quote_id):
    """Update quote status (accept, reject, etc.)"""
    try:
        quote = Quote.query.filter_by(
            id=quote_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not quote:
            return jsonify({'success': False, 'error': {'message': 'Quote not found'}}), 404
        
        data = request.get_json()
        new_status = data.get('status')
        
        if not new_status:
            return jsonify({'success': False, 'error': {'message': 'Status is required'}}), 400
        
        # Update quote status and timestamps
        old_status = quote.status
        quote.status = new_status
        quote.updated_at = datetime.utcnow()
        
        if new_status == 'accepted':
            quote.accepted_at = datetime.utcnow()
            quote.responded_at = datetime.utcnow()
        elif new_status == 'rejected':
            quote.rejected_at = datetime.utcnow()
            quote.responded_at = datetime.utcnow()
            quote.rejection_reason = data.get('rejection_reason')
        elif new_status == 'viewed':
            if not quote.viewed_at:
                quote.viewed_at = datetime.utcnow()
        
        # Create activity record
        activity = QuoteActivity(
            tenant_id=g.current_tenant_id,
            quote_id=quote.id,
            user_id=g.current_user_id,
            activity_type=new_status,
            description=f"Quote {quote.quote_number} status changed from {old_status} to {new_status}"
        )
        db.session.add(activity)
        
        # Create interaction for timeline
        status_messages = {
            'viewed': f"Quote viewed: {quote.title}",
            'accepted': f"Quote accepted: {quote.title}",
            'rejected': f"Quote rejected: {quote.title}"
        }
        
        if new_status in status_messages:
            interaction = Interaction(
                tenant_id=g.current_tenant_id,
                contact_id=quote.contact_id,
                user_id=g.current_user_id,
                type='quote',
                subject=status_messages[new_status],
                content=f"Quote {quote.quote_number} {new_status} - ${quote.amount or 0}",
                direction='inbound' if new_status in ['viewed', 'accepted', 'rejected'] else 'outbound',
                status='completed',
                completed_at=datetime.utcnow()
            )
            db.session.add(interaction)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Quote status updated to {new_status}',
            'quote': quote.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating quote status: {e}")
        return jsonify({
            'success': False,
            'error': {'message': 'Internal server error'}
        }), 500

@quotes_bp.route('/<quote_id>', methods=['DELETE'])
@require_auth
def delete_quote(quote_id):
    """Delete a quote"""
    try:
        quote = Quote.query.filter_by(
            id=quote_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not quote:
            return jsonify({'success': False, 'error': {'message': 'Quote not found'}}), 404
        
        quote_number = quote.quote_number
        
        # Delete quote (cascade will handle line items and activities)
        db.session.delete(quote)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Quote {quote_number} deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting quote: {e}")
        return jsonify({
            'success': False,
            'error': {'message': 'Internal server error'}
        }), 500

@quotes_bp.route('/contact/<contact_id>', methods=['GET'])
@require_auth
def get_contact_quotes(contact_id):
    """Get all quotes for a specific contact"""
    try:
        quotes = Quote.query.filter_by(
            contact_id=contact_id,
            tenant_id=g.current_tenant_id
        ).order_by(Quote.created_at.desc()).all()
        
        return jsonify({
            'success': True,
            'quotes': [quote.to_dict() for quote in quotes]
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting contact quotes: {e}")
        return jsonify({
            'success': False,
            'error': {'message': 'Internal server error'}
        }), 500

@quotes_bp.route('/stats', methods=['GET'])
@require_auth
def get_quote_stats():
    """Get quote statistics for the tenant"""
    try:
        total_quotes = Quote.query.filter_by(tenant_id=g.current_tenant_id).count()
        
        sent_quotes = Quote.query.filter_by(
            tenant_id=g.current_tenant_id,
            status='sent'
        ).count()
        
        accepted_quotes = Quote.query.filter_by(
            tenant_id=g.current_tenant_id,
            status='accepted'
        ).count()
        
        # Calculate total value
        total_value = db.session.query(db.func.sum(Quote.amount)).filter_by(
            tenant_id=g.current_tenant_id
        ).scalar() or 0
        
        # Calculate win rate
        win_rate = (accepted_quotes / sent_quotes * 100) if sent_quotes > 0 else 0
        
        return jsonify({
            'success': True,
            'stats': {
                'total_quotes': total_quotes,
                'sent_quotes': sent_quotes,
                'accepted_quotes': accepted_quotes,
                'total_value': float(total_value),
                'win_rate': round(win_rate, 2)
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting quote stats: {e}")
        return jsonify({
            'success': False,
            'error': {'message': 'Internal server error'}
        }), 500
