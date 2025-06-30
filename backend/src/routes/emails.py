from flask import Blueprint, request, jsonify, current_app, g, send_file, redirect
from src.models.user import db, EmailSend, EmailPixel, EmailOpen, EmailClick, Contact, Interaction
from datetime import datetime, timedelta
from functools import wraps
import jwt
import secrets
import os
import io
from PIL import Image
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

emails_bp = Blueprint('emails', __name__)

class EmailService:
    """SendGrid email service for NotHubSpot CRM"""
    
    def __init__(self):
        self.api_key = os.environ.get('SENDGRID_API_KEY')
        self.from_email = os.environ.get('SENDGRID_FROM_EMAIL', 'noreply@nothubspot.app')
        self.from_name = os.environ.get('SENDGRID_FROM_NAME', 'NotHubSpot CRM')
        
    def send_email(self, to_email, to_name, subject, html_content, text_content=None, reply_to_email=None, reply_to_name=None):
        """Send email via SendGrid"""
        if not self.api_key:
            raise Exception("SendGrid API key not configured")
        
        try:
            # Create SendGrid mail object
            from_email = Email(self.from_email, self.from_name)
            to_email_obj = To(to_email, to_name)
            
            # Create mail object
            mail = Mail(
                from_email=from_email,
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
    """Send tracked email"""
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
        
        # Get current user for Reply-To
        from src.models.user import User
        current_user = User.query.get(g.current_user_id)
        if not current_user:
            return jsonify({'success': False, 'error': {'message': 'User not found'}}), 404
        
        # Create email send record
        email_send = EmailSend(
            tenant_id=g.current_tenant_id,
            contact_id=contact.id,
            user_id=g.current_user_id,
            subject=data['subject'],
            content=data['content'],
            email_provider='manual'  # For now, manual sending
        )
        db.session.add(email_send)
        db.session.flush()  # Get email_send ID
        
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
        
        # Send email via SendGrid
        send_result = email_service.send_email(
            to_email=contact.email,
            to_name=contact.full_name,
            subject=data['subject'],
            html_content=tracked_content,
            text_content=data.get('text_content'),  # Optional plain text version
            reply_to_email=current_user.email,      # Replies go to the user
            reply_to_name=current_user.full_name    # User's name in Reply-To
        )
        
        if not send_result['success']:
            db.session.rollback()
            return jsonify({
                'success': False, 
                'error': {'message': f'Failed to send email: {send_result["error"]}'}
            }), 500
        
        # Update email send record with SendGrid info
        email_send.email_provider = 'sendgrid'
        email_send.provider_message_id = send_result.get('message_id')
        email_send.provider_status = 'sent'
        
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
            'data': {
                'email_send': email_send.to_dict(),
                'pixel_token': pixel_token,
                'sendgrid_message_id': send_result.get('message_id'),
                'message': 'Email sent successfully via SendGrid with tracking'
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@emails_bp.route('/', methods=['GET'])
@require_auth
def get_emails():
    """Get sent emails with tracking data"""
    try:
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 25, type=int)
        contact_id = request.args.get('contact_id')
        
        # Limit page size
        limit = min(limit, 100)
        
        # Base query with tenant isolation
        query = EmailSend.query.filter_by(tenant_id=g.current_tenant_id)
        
        if contact_id:
            query = query.filter_by(contact_id=contact_id)
        
        # Order by most recent
        query = query.order_by(EmailSend.sent_at.desc())
        
        # Paginate
        pagination = query.paginate(
            page=page,
            per_page=limit,
            error_out=False
        )
        
        emails = []
        for email in pagination.items:
            email_data = email.to_dict()
            
            # Add tracking stats
            if email.pixel:
                opens = EmailOpen.query.filter_by(pixel_id=email.pixel.id).all()
                unique_opens = EmailOpen.query.filter_by(pixel_id=email.pixel.id, is_unique=True).count()
                
                email_data['tracking'] = {
                    'total_opens': len(opens),
                    'unique_opens': unique_opens,
                    'first_opened': opens[0].opened_at.isoformat() if opens else None,
                    'last_opened': opens[-1].opened_at.isoformat() if opens else None
                }
            
            # Add contact info
            contact = Contact.query.get(email.contact_id)
            if contact:
                email_data['contact'] = {
                    'id': contact.id,
                    'full_name': contact.full_name,
                    'email': contact.email,
                    'company': contact.company
                }
            
            emails.append(email_data)
        
        return jsonify({
            'success': True,
            'data': emails,
            'meta': {
                'page': page,
                'limit': limit,
                'total': pagination.total,
                'pages': pagination.pages
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@emails_bp.route('/<email_id>', methods=['GET'])
@require_auth
def get_email_details(email_id):
    """Get email details with full tracking data"""
    try:
        email = EmailSend.query.filter_by(
            id=email_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not email:
            return jsonify({'success': False, 'error': {'message': 'Email not found'}}), 404
        
        email_data = email.to_dict()
        
        # Add detailed tracking data
        if email.pixel:
            opens = EmailOpen.query.filter_by(pixel_id=email.pixel.id).order_by(EmailOpen.opened_at.desc()).all()
            clicks = EmailClick.query.filter_by(email_send_id=email.id).order_by(EmailClick.clicked_at.desc()).all()
            
            email_data['tracking'] = {
                'opens': [open_event.to_dict() for open_event in opens],
                'clicks': [click.to_dict() for click in clicks],
                'stats': {
                    'total_opens': len(opens),
                    'unique_opens': len([o for o in opens if o.is_unique]),
                    'total_clicks': len(clicks)
                }
            }
        
        # Add contact info
        contact = Contact.query.get(email.contact_id)
        if contact:
            email_data['contact'] = contact.to_dict()
        
        return jsonify({
            'success': True,
            'data': email_data
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

# Public tracking endpoints (no auth required)
@emails_bp.route('/track/pixel/<token>.png', methods=['GET'])
def track_email_open(token):
    """Track email open via pixel"""
    try:
        # Find pixel by token
        pixel = EmailPixel.query.filter_by(pixel_token=token).first()
        
        if pixel:
            # Get client info
            ip_address = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
            user_agent = request.headers.get('User-Agent', '')
            
            # Check if this is a unique open (first open from this IP in last hour)
            one_hour_ago = datetime.utcnow() - timedelta(hours=1)
            recent_open = EmailOpen.query.filter(
                EmailOpen.pixel_id == pixel.id,
                EmailOpen.ip_address == ip_address,
                EmailOpen.opened_at >= one_hour_ago
            ).first()
            
            is_unique = recent_open is None
            
            # Log the open
            email_open = EmailOpen(
                pixel_id=pixel.id,
                ip_address=ip_address,
                user_agent=user_agent,
                is_unique=is_unique
            )
            db.session.add(email_open)
            
            # Update contact lead score for engagement
            if is_unique:
                email_send = EmailSend.query.get(pixel.email_send_id)
                if email_send:
                    contact = Contact.query.get(email_send.contact_id)
                    if contact:
                        contact.lead_score = min(contact.lead_score + 5, 100)  # Cap at 100
                        
                        # Log interaction
                        interaction = Interaction(
                            tenant_id=contact.tenant_id,
                            contact_id=contact.id,
                            type='email',
                            subject='Email opened',
                            content=f'Opened email: {email_send.subject}',
                            direction='inbound',
                            status='completed',
                            completed_at=datetime.utcnow()
                        )
                        db.session.add(interaction)
            
            db.session.commit()
        
        # Return 1x1 transparent PNG
        pixel_image = create_tracking_pixel()
        return send_file(
            pixel_image,
            mimetype='image/png',
            as_attachment=False,
            download_name='pixel.png'
        )
        
    except Exception as e:
        # Always return pixel even if tracking fails
        pixel_image = create_tracking_pixel()
        return send_file(
            pixel_image,
            mimetype='image/png',
            as_attachment=False,
            download_name='pixel.png'
        )

@emails_bp.route('/track/click/<token>', methods=['GET'])
def track_email_click(token):
    """Track email link click and redirect"""
    try:
        url = request.args.get('url')
        if not url:
            return jsonify({'error': 'URL parameter required'}), 400
        
        # Find email by token (you'd need to implement click token generation)
        # For now, we'll use the pixel token as a simple approach
        pixel = EmailPixel.query.filter_by(pixel_token=token).first()
        
        if pixel:
            # Get client info
            ip_address = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
            user_agent = request.headers.get('User-Agent', '')
            
            # Log the click
            email_click = EmailClick(
                email_send_id=pixel.email_send_id,
                url=url,
                ip_address=ip_address,
                user_agent=user_agent
            )
            db.session.add(email_click)
            
            # Update contact lead score for engagement
            email_send = EmailSend.query.get(pixel.email_send_id)
            if email_send:
                contact = Contact.query.get(email_send.contact_id)
                if contact:
                    contact.lead_score = min(contact.lead_score + 10, 100)  # Higher score for clicks
                    
                    # Log interaction
                    interaction = Interaction(
                        tenant_id=contact.tenant_id,
                        contact_id=contact.id,
                        type='email',
                        subject='Email link clicked',
                        content=f'Clicked link in email: {email_send.subject}',
                        direction='inbound',
                        status='completed',
                        completed_at=datetime.utcnow()
                    )
                    db.session.add(interaction)
            
            db.session.commit()
        
        # Redirect to original URL
        return redirect(url)
        
    except Exception as e:
        # Redirect to URL even if tracking fails
        return redirect(url if url else '/')

@emails_bp.route('/stats', methods=['GET'])
@require_auth
def get_email_stats():
    """Get email statistics for dashboard"""
    try:
        # Total emails sent
        total_emails = EmailSend.query.filter_by(tenant_id=g.current_tenant_id).count()
        
        # Emails sent in last 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_emails = EmailSend.query.filter(
            EmailSend.tenant_id == g.current_tenant_id,
            EmailSend.sent_at >= thirty_days_ago
        ).count()
        
        # Total opens
        total_opens = db.session.query(EmailOpen).join(EmailPixel).filter(
            EmailPixel.tenant_id == g.current_tenant_id
        ).count()
        
        # Unique opens
        unique_opens = db.session.query(EmailOpen).join(EmailPixel).filter(
            EmailPixel.tenant_id == g.current_tenant_id,
            EmailOpen.is_unique == True
        ).count()
        
        return jsonify({
            'success': True,
            'data': {
                'total_emails': total_emails,
                'recent_emails': recent_emails,
                'total_opens': total_opens,
                'unique_opens': unique_opens,
                'open_rate': round((unique_opens / total_emails * 100) if total_emails > 0 else 0, 1)
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

