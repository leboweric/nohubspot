from flask import Blueprint, request, jsonify, current_app
from src.models.user import db
from src.models.email import EmailThread, EmailMessage, EmailAttachment
from src.models.contact import Contact
from src.models.activity import Activity
from src.services.email_service import email_service
import uuid
from datetime import datetime

emails_bp = Blueprint('emails', __name__)

@emails_bp.route('/email-threads', methods=['GET'])
def get_email_threads():
    """Get all email threads, optionally filtered by contact"""
    try:
        contact_id = request.args.get('contact_id')
        if contact_id:
            threads = EmailThread.query.filter_by(contact_id=contact_id).all()
        else:
            threads = EmailThread.query.all()
        return jsonify([thread.to_dict() for thread in threads])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@emails_bp.route('/email-threads/<thread_id>', methods=['GET'])
def get_email_thread(thread_id):
    """Get a specific email thread by ID"""
    try:
        thread = EmailThread.query.get_or_404(thread_id)
        return jsonify(thread.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@emails_bp.route('/email-threads', methods=['POST'])
def create_email_thread():
    """Create a new email thread and send email via SendGrid"""
    try:
        data = request.get_json()
        
        # Verify contact exists
        contact = Contact.query.get(data.get('contactId'))
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404
        
        thread_id = str(uuid.uuid4())
        message_id = str(uuid.uuid4())
        timestamp = datetime.utcnow()
        
        # Create thread
        thread = EmailThread(
            id=thread_id,
            subject=data.get('subject'),
            contact_id=data.get('contactId'),
            preview=data.get('content')[:100] + ('...' if len(data.get('content', '')) > 100 else ''),
            message_count=1
        )
        
        # Create first message
        message = EmailMessage(
            id=message_id,
            thread_id=thread_id,
            sender='Sales Rep',
            content=data.get('content'),
            direction='outgoing',
            timestamp=timestamp
        )
        
        db.session.add(thread)
        db.session.add(message)
        
        # Send actual email via SendGrid
        email_sent = email_service.send_email(
            to_email=contact.email,
            subject=data.get('subject'),
            content=data.get('content'),
            from_name="SimpleCRM Team"
        )
        
        if not email_sent:
            current_app.logger.warning(f"Failed to send email to {contact.email}")
        
        # Add activity
        activity = Activity(
            id=str(uuid.uuid4()),
            title='Email Sent',
            description=f'Sent email to {contact.first_name} {contact.last_name}',
            type='email',
            entity_id=message_id
        )
        db.session.add(activity)
        
        db.session.commit()
        return jsonify({
            'threadId': thread_id, 
            'messageId': message_id,
            'emailSent': email_sent
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@emails_bp.route('/email-threads/<thread_id>/messages', methods=['POST'])
def reply_to_thread(thread_id):
    """Reply to an email thread and send email via SendGrid"""
    try:
        thread = EmailThread.query.get_or_404(thread_id)
        contact = Contact.query.get(thread.contact_id)
        data = request.get_json()
        
        message_id = str(uuid.uuid4())
        timestamp = datetime.utcnow()
        
        # Create reply message
        message = EmailMessage(
            id=message_id,
            thread_id=thread_id,
            sender='Sales Rep',
            content=data.get('content'),
            direction='outgoing',
            timestamp=timestamp
        )
        
        # Update thread
        thread.message_count += 1
        thread.preview = data.get('content')[:100] + ('...' if len(data.get('content', '')) > 100 else '')
        
        db.session.add(message)
        
        # Send actual email via SendGrid
        email_sent = email_service.send_email(
            to_email=contact.email,
            subject=f"Re: {thread.subject}",
            content=data.get('content'),
            from_name="SimpleCRM Team"
        )
        
        if not email_sent:
            current_app.logger.warning(f"Failed to send reply email to {contact.email}")
        
        # Add activity
        activity = Activity(
            id=str(uuid.uuid4()),
            title='Email Sent',
            description=f'Replied to {contact.first_name} {contact.last_name}',
            type='email',
            entity_id=message_id
        )
        db.session.add(activity)
        
        db.session.commit()
        return jsonify({
            'messageId': message_id,
            'emailSent': email_sent
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@emails_bp.route('/email-threads/<thread_id>/messages', methods=['GET'])
def get_thread_messages(thread_id):
    """Get all messages in a thread"""
    try:
        thread = EmailThread.query.get_or_404(thread_id)
        messages = EmailMessage.query.filter_by(thread_id=thread_id).order_by(EmailMessage.timestamp).all()
        return jsonify([message.to_dict() for message in messages])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@emails_bp.route('/email-messages/<message_id>/attachments', methods=['POST'])
def add_message_attachment(message_id):
    """Add an attachment to an email message"""
    try:
        message = EmailMessage.query.get_or_404(message_id)
        data = request.get_json()
        
        attachment_id = str(uuid.uuid4())
        attachment = EmailAttachment(
            id=attachment_id,
            message_id=message_id,
            name=data.get('name'),
            url=data.get('url')
        )
        
        db.session.add(attachment)
        db.session.commit()
        return jsonify(attachment.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@emails_bp.route('/emails/test', methods=['POST'])
def test_email():
    """Test endpoint to verify SendGrid configuration"""
    try:
        data = request.get_json()
        to_email = data.get('to_email')
        
        if not to_email:
            return jsonify({'error': 'to_email is required'}), 400
        
        email_sent = email_service.send_email(
            to_email=to_email,
            subject="SimpleCRM Test Email",
            content="This is a test email from SimpleCRM to verify SendGrid integration.",
            from_name="SimpleCRM Team"
        )
        
        return jsonify({
            'success': email_sent,
            'message': 'Test email sent successfully' if email_sent else 'Failed to send test email'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

