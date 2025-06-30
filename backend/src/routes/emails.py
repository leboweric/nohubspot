from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, From, To, Subject, HtmlContent
from src.models.user import db, User, Contact, EmailSend, Interaction
from datetime import datetime
import uuid
import os

emails_bp = Blueprint('emails', __name__)

@emails_bp.route('/health', methods=['GET'])
def emails_health():
    """Health check endpoint"""
    return jsonify({
        'success': True, 
        'message': 'Emails blueprint is working',
        'endpoint': 'emails_health'
    }), 200

@emails_bp.route('/send', methods=['POST'])
@jwt_required()
def send_email():
    """Send email with SendGrid"""
    try:
        data = request.get_json()
        current_user_id = get_jwt_identity()
        
        # Validate required fields
        required_fields = ['contact_id', 'to', 'subject', 'content']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 400
        
        # Get current user
        current_user = User.query.get(current_user_id)
        if not current_user:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        # Get contact
        contact = Contact.query.filter_by(
            id=data['contact_id'],
            tenant_id=current_user.tenant_id
        ).first()
        
        if not contact:
            return jsonify({'success': False, 'error': 'Contact not found'}), 404
        
        # Create email record
        email_id = str(uuid.uuid4())
        email_send = EmailSend(
            id=email_id,
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            contact_id=contact.id,
            to_email=data['to'],
            to_name=contact.full_name,
            from_email=current_user.email,
            from_name=f"{current_user.full_name} ({current_user.company})" if current_user.company else current_user.full_name,
            subject=data['subject'],
            content=data['content'],
            status='sending'
        )
        db.session.add(email_send)
        
        # Create interaction record
        interaction = Interaction(
            tenant_id=current_user.tenant_id,
            contact_id=contact.id,
            type='email',
            subject=f"Email sent: {data['subject']}",
            content=data['content'],
            direction='outbound',
            status='completed',
            completed_at=datetime.utcnow()
        )
        db.session.add(interaction)
        
        # Send email via SendGrid
        sendgrid_api_key = os.environ.get('SENDGRID_API_KEY')
        if not sendgrid_api_key:
            return jsonify({'success': False, 'error': 'SendGrid API key not configured'}), 500
        
        message = Mail(
            from_email=From(current_user.email, email_send.from_name),
            to_emails=To(data['to'], contact.full_name),
            subject=Subject(data['subject']),
            html_content=HtmlContent(data['content'])
        )
        
        sg = SendGridAPIClient(api_key=sendgrid_api_key)
        response = sg.send(message)
        
        if response.status_code in [200, 202]:
            email_send.status = 'sent'
            email_send.sent_at = datetime.utcnow()
            email_send.sendgrid_message_id = response.headers.get('X-Message-Id', '')
        else:
            email_send.status = 'failed'
            email_send.error_message = f"SendGrid error: {response.status_code}"
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Email sent successfully',
            'email_id': email_id
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error sending email: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@emails_bp.route('/threads/<thread_id>', methods=['GET'])
@jwt_required()
def get_email_thread(thread_id):
    """Placeholder thread endpoint"""
    return jsonify({
        'success': True,
        'thread': {'id': thread_id, 'messages': []}
    }), 200

@emails_bp.route('/threads/contact/<contact_id>', methods=['GET'])
@jwt_required()
def get_contact_threads(contact_id):
    """Placeholder contact threads endpoint"""
    return jsonify({
        'success': True,
        'threads': []
    }), 200

@emails_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_email_stats():
    """Get email statistics"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        # Get basic email stats
        total_sent = EmailSend.query.filter_by(
            tenant_id=current_user.tenant_id,
            status='sent'
        ).count()
        
        return jsonify({
            'success': True,
            'stats': {
                'total_sent': total_sent,
                'total_opened': 0,  # Placeholder
                'total_clicked': 0  # Placeholder
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting email stats: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

