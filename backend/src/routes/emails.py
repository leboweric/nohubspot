from flask import Blueprint, request, jsonify, current_app, g, send_file, redirect
from src.models.user import db, EmailSend, EmailPixel, EmailOpen, EmailClick, Contact, Interaction, EmailThread, EmailReply
from src.models.user import normalize_subject, generate_thread_key, extract_message_id_from_headers, parse_references_header
from datetime import datetime, timedelta
from functools import wraps
import jwt
import secrets
import os
import io
from PIL import Image
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
import json
import re

emails_bp = Blueprint('emails', __name__)

class EmailService:
    """SendGrid email service for NotHubSpot CRM"""
    
    def __init__(self):
        self.api_key = os.environ.get('SENDGRID_API_KEY')
        self.from_email = os.environ.get('SENDGRID_FROM_EMAIL', 'noreply@nothubspot.app')
        self.from_name = os.environ.get('SENDGRID_FROM_NAME', 'NotHubSpot CRM')
        
    def send_email(self, to_email, to_name, subject, html_content, text_content=None, reply_to_email=None, reply_to_name=None, from_email=None, from_name=None):
        """Send email via SendGrid"""
        if not self.api_key:
            raise Exception("SendGrid API key not configured")
        
        try:
            # Use custom from address if provided, otherwise use default
            sender_email = from_email or self.from_email
            sender_name = from_name or self.from_name
            
            # Create SendGrid mail object
            from_email_obj = Email(sender_email, sender_name)
            to_email_obj = To(to_email, to_name)
            
            # Create mail object
            mail = Mail(
                from_email=from_email_obj,
                to_emails=to_email_obj,
                subject=subject,
                html_content=html_content
            )
            
            # Add Reply-To header if provided
            if reply_to_email:
                mail.reply_to = Email(reply_to_email, reply_to_name or reply_to_email)
            
            # Add plain text version if provided
            if text_content:
                mail.content = [
                    Content("text/plain", text_content),
                    Content("text/html", html_content)
                ]
            
            # Send email
            sg = SendGridAPIClient(api_key=self.api_key)
            response = sg.send(mail)
            
            return {
                'success': True,
                'status_code': response.status_code,
                'message_id': response.headers.get('X-Message-Id'),
                'response': response.body
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

# Initialize email service
email_service = EmailService()

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

def create_tracking_pixel():
    """Create a 1x1 transparent PNG pixel"""
    # Create a 1x1 transparent image
    img = Image.new('RGBA', (1, 1), (0, 0, 0, 0))
    img_io = io.BytesIO()
    img.save(img_io, 'PNG')
    img_io.seek(0)
    return img_io

@emails_bp.route('/send', methods=['POST'])
@require_auth
def send_email():
    """Send tracked email with thread support"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['contact_id', 'subject', 'content']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'error': {'message': f'{field} is required'}}), 400
        
        # Verify contact exists and belongs to tenant
        contact = Contact.query.filter_by(
            id=data['contact_id'],
            tenant_id=g.current_tenant_id
        ).first()
        
        if not contact:
            return jsonify({'success': False, 'error': {'message': 'Contact not found'}}), 404
        
        if not contact.email:
            return jsonify({'success': False, 'error': {'message': 'Contact has no email address'}}), 400
        
        # Get current user and tenant for custom from name
        from src.models.user import User, Tenant
        current_user = User.query.get(g.current_user_id)
        if not current_user:
            return jsonify({'success': False, 'error': {'message': 'User not found'}}), 404
        
        tenant = Tenant.query.get(g.current_tenant_id)
        if not tenant:
            return jsonify({'success': False, 'error': {'message': 'Tenant not found'}}), 404
        
        # Find or create email thread
        thread = find_or_create_thread_for_outbound(contact, data['subject'])
        
        # Create email send record
        email_send = EmailSend(
            tenant_id=g.current_tenant_id,
            contact_id=contact.id,
            user_id=g.current_user_id,
            thread_id=thread.id,  # Link to thread
            subject=data['subject'],
            content=data['content'],
            email_provider='manual'  # For now, manual sending
        )
        db.session.add(email_send)
        db.session.flush()  # Get email_send ID
        
        # Update thread if this is the first email
        if not thread.first_email_id:
            thread.first_email_id = email_send.id
        
        # Create tracking pixel
        pixel_token = secrets.token_urlsafe(32)
        pixel = EmailPixel(
            tenant_id=g.current_tenant_id,
            email_send_id=email_send.id,
            pixel_token=pixel_token
        )
        db.session.add(pixel)
        
        # Add tracking pixel to email content
        pixel_url = f"{request.host_url}api/emails/track/pixel/{pixel_token}.png"
        tracked_content = data['content'] + f'<img src="{pixel_url}" width="1" height="1" style="display:none;">'
        
        # Update email content with tracking
        email_send.content = tracked_content
        
        # Create custom from name with company
        custom_from_name = f"{current_user.full_name} ({tenant.name})"
        
        # Send email via SendGrid
        send_result = email_service.send_email(
            to_email=contact.email,
            to_name=contact.full_name,
            subject=data['subject'],
            html_content=tracked_content,
            text_content=data.get('text_content'),
            reply_to_email=current_user.email,
            reply_to_name=current_user.full_name,
            from_name=custom_from_name  # Custom from name with company
        )
        
        if not send_result['success']:
            db.session.rollback()
            return jsonify({
                'success': False, 
                'error': {'message': f'Failed to send email: {send_result["error"]}'}
            }), 500
        
        # Update email send record with SendGrid info
        email_send.email_provider = 'sendgrid'
        email_send.external_message_id = send_result.get('message_id')
        
        # Update thread activity
        thread.last_activity_at = datetime.utcnow()
        
        # Log interaction
        interaction = Interaction(
            tenant_id=g.current_tenant_id,
            contact_id=contact.id,
            user_id=g.current_user_id,
            type='email',
            subject=f'Email sent: {data["subject"]}',
            content=f'Email sent to {contact.email}',
            direction='outbound',
            status='completed',
            completed_at=datetime.utcnow()
        )
        db.session.add(interaction)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Email sent successfully',
            'email_id': email_send.id,
            'thread_id': thread.id,
            'tracking_pixel': pixel_url
        }), 201
        
    except Exception as e:
        current_app.logger.error(f"Error sending email: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'error': {'message': 'Failed to send email'}}), 500

def find_or_create_thread_for_outbound(contact, subject):
    """Find existing thread or create new one for outbound email"""
    try:
        # Generate thread key for matching
        thread_key = generate_thread_key(subject, contact.email)
        
        # Look for existing thread
        existing_thread = EmailThread.query.filter_by(
            tenant_id=contact.tenant_id,
            contact_id=contact.id,
            thread_key=thread_key,
            is_active=True
        ).first()
        
        if existing_thread:
            return existing_thread
        
        # Create new thread
        new_thread = EmailThread(
            tenant_id=contact.tenant_id,
            contact_id=contact.id,
            subject=subject,
            thread_key=thread_key,
            last_activity_at=datetime.utcnow(),
            reply_count=0,
            is_active=True
        )
        
        db.session.add(new_thread)
        db.session.flush()  # Get the ID without committing
        
        return new_thread
        
    except Exception as e:
        current_app.logger.error(f"Error finding/creating thread: {str(e)}")
        raise

# SendGrid Webhook Handler for Inbound Emails
@emails_bp.route('/webhook/inbound', methods=['POST'])
def handle_inbound_email():
    """Handle incoming email webhook from SendGrid Inbound Parse"""
    try:
        # Get the raw email data from SendGrid
        email_data = request.form.to_dict()
        
        # Extract basic email information
        from_email = email_data.get('from', '').strip()
        to_email = email_data.get('to', '').strip()
        subject = email_data.get('subject', '').strip()
        text_content = email_data.get('text', '')
        html_content = email_data.get('html', '')
        
        # Extract email headers
        headers = {}
        for key, value in email_data.items():
            if key.startswith('headers['):
                header_name = key[8:-1]  # Remove 'headers[' and ']'
                headers[header_name] = value
        
        # Extract threading information
        message_id = extract_message_id_from_headers(headers)
        in_reply_to = headers.get('In-Reply-To', '')
        references = headers.get('References', '')
        
        # Log the incoming email for debugging
        current_app.logger.info(f"Received inbound email from {from_email} to {to_email} with subject: {subject}")
        
        # Find the contact by email
        contact = Contact.query.filter_by(email=from_email).first()
        if not contact:
            current_app.logger.warning(f"No contact found for email: {from_email}")
            return jsonify({'success': True, 'message': 'Email received but no matching contact'}), 200
        
        # Find or create email thread
        thread = find_or_create_thread_for_inbound(contact, subject, to_email)
        if not thread:
            current_app.logger.error(f"Failed to find or create thread for contact {contact.id}")
            return jsonify({'success': False, 'error': 'Failed to process thread'}), 500
        
        # Create email reply record
        email_reply = EmailReply(
            tenant_id=contact.tenant_id,
            thread_id=thread.id,
            contact_id=contact.id,
            from_email=from_email,
            from_name=email_data.get('from_name', ''),
            subject=subject,
            content_text=text_content,
            content_html=html_content,
            message_id=message_id,
            in_reply_to=in_reply_to,
            references=references,
            received_at=datetime.utcnow(),
            is_processed=True,
            webhook_data=email_data
        )
        
        # Try to find the original email this is replying to
        if in_reply_to:
            original_email = EmailSend.query.filter_by(
                external_message_id=in_reply_to,
                tenant_id=contact.tenant_id
            ).first()
            if original_email:
                email_reply.original_email_id = original_email.id
        
        # Save the reply
        db.session.add(email_reply)
        
        # Update thread statistics
        thread.reply_count += 1
        thread.last_activity_at = datetime.utcnow()
        
        # Create interaction record for timeline
        interaction = Interaction(
            tenant_id=contact.tenant_id,
            contact_id=contact.id,
            type='email',
            subject=f"Reply: {subject}",
            content=text_content[:500] + ('...' if len(text_content) > 500 else ''),
            direction='inbound',
            status='completed',
            completed_at=datetime.utcnow()
        )
        db.session.add(interaction)
        
        # Commit all changes
        db.session.commit()
        
        current_app.logger.info(f"Successfully processed email reply from {from_email} for thread {thread.id}")
        
        return jsonify({
            'success': True,
            'message': 'Email reply processed successfully',
            'thread_id': thread.id,
            'reply_id': email_reply.id
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error processing inbound email: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'Failed to process email',
            'details': str(e)
        }), 500

def find_or_create_thread_for_inbound(contact, subject, to_email):
    """Find existing thread or create new one for inbound email conversation"""
    try:
        # Generate thread key for matching
        thread_key = generate_thread_key(subject, contact.email)
        
        # Look for existing thread
        existing_thread = EmailThread.query.filter_by(
            tenant_id=contact.tenant_id,
            contact_id=contact.id,
            thread_key=thread_key,
            is_active=True
        ).first()
        
        if existing_thread:
            return existing_thread
        
        # Create new thread
        new_thread = EmailThread(
            tenant_id=contact.tenant_id,
            contact_id=contact.id,
            subject=subject,
            thread_key=thread_key,
            last_activity_at=datetime.utcnow(),
            reply_count=0,
            is_active=True
        )
        
        db.session.add(new_thread)
        db.session.flush()  # Get the ID without committing
        
        return new_thread
        
    except Exception as e:
        current_app.logger.error(f"Error finding/creating thread: {str(e)}")
        return None

# Thread API Endpoints
@emails_bp.route('/threads/<thread_id>', methods=['GET'])
@require_auth
def get_email_thread(thread_id):
    """Get complete email thread with all messages"""
    try:
        # Get the thread
        thread = EmailThread.query.filter_by(
            id=thread_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not thread:
            return jsonify({'success': False, 'error': {'message': 'Thread not found'}}), 404
        
        # Get all emails in the thread (sent emails)
        sent_emails = EmailSend.query.filter_by(
            thread_id=thread_id,
            tenant_id=g.current_tenant_id
        ).order_by(EmailSend.sent_at.asc()).all()
        
        # Get all replies in the thread
        replies = EmailReply.query.filter_by(
            thread_id=thread_id,
            tenant_id=g.current_tenant_id
        ).order_by(EmailReply.received_at.asc()).all()
        
        # Combine and sort all messages chronologically
        messages = []
        
        # Add sent emails
        for email in sent_emails:
            # Get user info
            from src.models.user import User
            user = User.query.get(email.user_id)
            
            messages.append({
                'id': email.id,
                'type': 'sent',
                'subject': email.subject,
                'content': email.content,
                'timestamp': email.sent_at.isoformat(),
                'from_user': True,
                'user_id': email.user_id,
                'user_name': user.full_name if user else 'Unknown User'
            })
        
        # Add replies
        for reply in replies:
            messages.append({
                'id': reply.id,
                'type': 'reply',
                'subject': reply.subject,
                'content': reply.content_text or reply.content_html,
                'timestamp': reply.received_at.isoformat(),
                'from_user': False,
                'from_email': reply.from_email,
                'from_name': reply.from_name
            })
        
        # Sort by timestamp
        messages.sort(key=lambda x: x['timestamp'])
        
        return jsonify({
            'success': True,
            'thread': thread.to_dict(),
            'messages': messages
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting email thread: {str(e)}")
        return jsonify({'success': False, 'error': {'message': 'Failed to get thread'}}), 500

@emails_bp.route('/threads/contact/<contact_id>', methods=['GET'])
@require_auth
def get_contact_threads(contact_id):
    """Get all email threads for a specific contact"""
    try:
        # Verify contact belongs to current tenant
        contact = Contact.query.filter_by(
            id=contact_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not contact:
            return jsonify({'success': False, 'error': {'message': 'Contact not found'}}), 404
        
        # Get all threads for this contact
        threads = EmailThread.query.filter_by(
            contact_id=contact_id,
            tenant_id=g.current_tenant_id,
            is_active=True
        ).order_by(EmailThread.last_activity_at.desc()).all()
        
        # Add message counts and latest activity for each thread
        thread_data = []
        for thread in threads:
            sent_count = EmailSend.query.filter_by(thread_id=thread.id).count()
            reply_count = thread.reply_count
            
            thread_dict = thread.to_dict()
            thread_dict['total_messages'] = sent_count + reply_count
            thread_dict['sent_count'] = sent_count
            
            thread_data.append(thread_dict)
        
        return jsonify({
            'success': True,
            'threads': thread_data
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting contact threads: {str(e)}")
        return jsonify({'success': False, 'error': {'message': 'Failed to get threads'}}), 500

# Existing tracking endpoints (unchanged)
@emails_bp.route('/track/pixel/<pixel_token>.png', methods=['GET'])
def track_pixel(pixel_token):
    """Track email open via pixel"""
    try:
        # Find the pixel
        pixel = EmailPixel.query.filter_by(pixel_token=pixel_token).first()
        if not pixel:
            # Return a 1x1 transparent pixel even if not found
            return send_file(io.BytesIO(create_tracking_pixel().read()), mimetype='image/png')
        
        # Check if this is a unique open
        existing_open = EmailOpen.query.filter_by(pixel_id=pixel.id).first()
        is_unique = existing_open is None
        
        # Record the open
        email_open = EmailOpen(
            pixel_id=pixel.id,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent', ''),
            is_unique=is_unique
        )
        db.session.add(email_open)
        
        # Update contact lead score for unique opens
        if is_unique:
            contact = Contact.query.get(pixel.email_send.contact_id)
            if contact:
                contact.lead_score += 5  # Add 5 points for email open
        
        db.session.commit()
        
        # Return 1x1 transparent pixel
        return send_file(create_tracking_pixel(), mimetype='image/png')
        
    except Exception as e:
        current_app.logger.error(f"Error tracking pixel: {str(e)}")
        # Always return a pixel, even on error
        return send_file(create_tracking_pixel(), mimetype='image/png')

@emails_bp.route('/track/click', methods=['GET'])
def track_click():
    """Track email link click"""
    try:
        email_id = request.args.get('email_id')
        url = request.args.get('url')
        
        if not email_id or not url:
            return redirect('https://example.com')  # Fallback URL
        
        # Record the click
        email_click = EmailClick(
            email_send_id=email_id,
            url=url,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent', '')
        )
        db.session.add(email_click)
        
        # Update contact lead score
        email_send = EmailSend.query.get(email_id)
        if email_send:
            contact = Contact.query.get(email_send.contact_id)
            if contact:
                contact.lead_score += 10  # Add 10 points for link click
        
        db.session.commit()
        
        # Redirect to the actual URL
        return redirect(url)
        
    except Exception as e:
        current_app.logger.error(f"Error tracking click: {str(e)}")
        return redirect('https://example.com')  # Fallback URL

@emails_bp.route('/analytics', methods=['GET'])
@require_auth
def get_email_analytics():
    """Get email analytics for the tenant"""
    try:
        # Get date range from query params
        days = int(request.args.get('days', 30))
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get email sends in date range
        email_sends = EmailSend.query.filter(
            EmailSend.tenant_id == g.current_tenant_id,
            EmailSend.sent_at >= start_date
        ).all()
        
        # Calculate metrics
        total_sent = len(email_sends)
        
        # Get opens
        email_ids = [email.id for email in email_sends]
        total_opens = EmailOpen.query.join(EmailPixel).filter(
            EmailPixel.email_send_id.in_(email_ids)
        ).count()
        
        unique_opens = EmailOpen.query.join(EmailPixel).filter(
            EmailPixel.email_send_id.in_(email_ids),
            EmailOpen.is_unique == True
        ).count()
        
        # Get clicks
        total_clicks = EmailClick.query.filter(
            EmailClick.email_send_id.in_(email_ids)
        ).count()
        
        # Calculate rates
        open_rate = (unique_opens / total_sent * 100) if total_sent > 0 else 0
        click_rate = (total_clicks / total_sent * 100) if total_sent > 0 else 0
        
        return jsonify({
            'success': True,
            'analytics': {
                'total_sent': total_sent,
                'total_opens': total_opens,
                'unique_opens': unique_opens,
                'total_clicks': total_clicks,
                'open_rate': round(open_rate, 2),
                'click_rate': round(click_rate, 2),
                'date_range_days': days
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting analytics: {str(e)}")
        return jsonify({'success': False, 'error': {'message': 'Failed to get analytics'}}), 500

