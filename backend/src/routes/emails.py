from flask import Blueprint, request, jsonify, g, current_app
from src.models.user import db, EmailSend, EmailPixel, EmailOpen, EmailClick, Contact, Interaction, EmailThread, EmailReply, User, Tenant
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
import email
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import quopri

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

@emails_bp.route('/send', methods=['POST'])
@require_auth
def send_email():
    """Send email to contact with thread tracking"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['contact_id', 'subject', 'content']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'error': {'message': f'{field} is required'}}), 400
        
        # Get contact
        contact = Contact.query.filter_by(
            id=data['contact_id'],
            tenant_id=g.current_tenant_id
        ).first()
        
        if not contact:
            return jsonify({'success': False, 'error': {'message': 'Contact not found'}}), 404
        
        # Get current user and tenant for custom from name
        current_user = User.query.get(g.current_user_id)
        tenant = Tenant.query.get(g.current_tenant_id)
        
        # Create or find email thread
        thread_key = generate_thread_key(data['subject'], contact.email)
        thread = EmailThread.query.filter_by(
            tenant_id=g.current_tenant_id,
            contact_id=contact.id,
            thread_key=thread_key
        ).first()
        
        if not thread:
            # Create new thread
            thread = EmailThread(
                tenant_id=g.current_tenant_id,
                contact_id=contact.id,
                subject=data['subject'],
                thread_key=thread_key
            )
            db.session.add(thread)
            db.session.flush()  # Get thread ID
        
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
        
        # FIXED: Use nothubspot.app domain for reply-to to enable webhook capture
        reply_to_email = f"replies+{contact.id}@nothubspot.app"
        
        # Send email via SendGrid
        send_result = email_service.send_email(
            to_email=contact.email,
            to_name=contact.full_name,
            subject=data['subject'],
            html_content=tracked_content,
            text_content=data.get('text_content'),
            reply_to_email=reply_to_email,  # FIXED: Use nothubspot.app domain
            reply_to_name=current_user.full_name,
            from_name=custom_from_name  # Custom from name with company
        )
        
        if not send_result['success']:
            db.session.rollback()
            return jsonify({
                'success': False, 
                'error': {'message': f'Failed to send email: {send_result["error"]}'}
            }), 500
        
        # Store external message ID if available
        if send_result.get('message_id'):
            email_send.external_message_id = send_result['message_id']
        
        # Update thread activity
        thread.last_activity_at = datetime.utcnow()
        
        # Create interaction record
        interaction = Interaction(
            tenant_id=g.current_tenant_id,
            contact_id=contact.id,
            user_id=g.current_user_id,
            type='email',
            subject=f"Email sent: {data['subject']}",
            content=data['content'],
            direction='outbound',
            status='completed',
            completed_at=datetime.utcnow()
        )
        db.session.add(interaction)
        
        # Commit all changes
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Email sent successfully',
            'email_id': email_send.id,
            'thread_id': thread.id,
            'tracking_pixel': pixel_token
        }), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error sending email: {e}")
        return jsonify({
            'success': False,
            'error': {'message': 'Internal server error'}
        }), 500

def extract_email_content(form_data):
    """Extract and clean email content from SendGrid webhook data"""
    import re
    
    # Get text and HTML content first (these are clean if available)
    text_content = form_data.get('text', '').strip()
    html_content = form_data.get('html', '').strip()
    
    # If we have clean text content, use it
    if text_content:
        current_app.logger.info(f"Using clean text content: '{text_content[:100]}...'")
        return text_content
    
    # If we have clean HTML content, strip HTML tags and use it
    if html_content:
        clean_html = re.sub(r'<[^>]+>', '', html_content)
        clean_html = clean_html.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
        clean_html = clean_html.strip()
        if clean_html:
            current_app.logger.info(f"Using clean HTML content: '{clean_html[:100]}...'")
            return clean_html
    
    # Parse the raw email field using Python's email library
    email_field = form_data.get('email', '').strip()
    if email_field:
        current_app.logger.info(f"Parsing MIME email field (length: {len(email_field)})")
        
        try:
            # Parse the email using Python's email library
            msg = email.message_from_string(email_field)
            
            # Extract text content from multipart message
            extracted_content = None
            
            if msg.is_multipart():
                current_app.logger.info("Email is multipart, extracting text parts")
                for part in msg.walk():
                    content_type = part.get_content_type()
                    content_disposition = str(part.get('Content-Disposition', ''))
                    
                    # Skip attachments
                    if 'attachment' in content_disposition:
                        continue
                    
                    # Look for text/plain content
                    if content_type == 'text/plain':
                        payload = part.get_payload(decode=True)
                        if payload:
                            try:
                                # Decode the payload
                                charset = part.get_content_charset() or 'utf-8'
                                text = payload.decode(charset, errors='ignore')
                                
                                # Handle quoted-printable encoding
                                if part.get('Content-Transfer-Encoding') == 'quoted-printable':
                                    text = quopri.decodestring(text).decode(charset, errors='ignore')
                                
                                # Clean up the text
                                text = text.strip()
                                
                                # Stop at common reply markers
                                lines = text.split('\n')
                                content_lines = []
                                for line in lines:
                                    line = line.strip()
                                    # Stop at quoted reply markers
                                    if line.startswith('On ') and ('wrote:' in line or 'at ' in line):
                                        break
                                    if line.startswith('>'):
                                        break
                                    if line and not line.startswith('--'):
                                        content_lines.append(line)
                                
                                if content_lines:
                                    extracted_content = ' '.join(content_lines).strip()
                                    current_app.logger.info(f"Extracted from text/plain: '{extracted_content[:100]}...'")
                                    break
                            except Exception as e:
                                current_app.logger.warning(f"Error decoding text/plain part: {e}")
                                continue
                    
                    # If no text/plain found, try text/html
                    elif content_type == 'text/html' and not extracted_content:
                        payload = part.get_payload(decode=True)
                        if payload:
                            try:
                                charset = part.get_content_charset() or 'utf-8'
                                html = payload.decode(charset, errors='ignore')
                                
                                # Handle quoted-printable encoding
                                if part.get('Content-Transfer-Encoding') == 'quoted-printable':
                                    html = quopri.decodestring(html).decode(charset, errors='ignore')
                                
                                # Strip HTML tags
                                text = re.sub(r'<[^>]+>', '', html)
                                text = text.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
                                text = re.sub(r'\s+', ' ', text).strip()
                                
                                # Stop at quoted reply markers
                                lines = text.split('\n')
                                content_lines = []
                                for line in lines:
                                    line = line.strip()
                                    if line.startswith('On ') and ('wrote:' in line or 'at ' in line):
                                        break
                                    if line and not line.startswith('--'):
                                        content_lines.append(line)
                                
                                if content_lines:
                                    extracted_content = ' '.join(content_lines).strip()
                                    current_app.logger.info(f"Extracted from text/html: '{extracted_content[:100]}...'")
                            except Exception as e:
                                current_app.logger.warning(f"Error decoding text/html part: {e}")
                                continue
            else:
                # Single part message
                current_app.logger.info("Email is single part")
                payload = msg.get_payload(decode=True)
                if payload:
                    try:
                        charset = msg.get_content_charset() or 'utf-8'
                        text = payload.decode(charset, errors='ignore')
                        
                        # Handle quoted-printable encoding
                        if msg.get('Content-Transfer-Encoding') == 'quoted-printable':
                            text = quopri.decodestring(text).decode(charset, errors='ignore')
                        
                        text = text.strip()
                        if text:
                            extracted_content = text
                            current_app.logger.info(f"Extracted from single part: '{extracted_content[:100]}...'")
                    except Exception as e:
                        current_app.logger.warning(f"Error decoding single part: {e}")
            
            if extracted_content and len(extracted_content) > 3:
                return extracted_content
            
        except Exception as e:
            current_app.logger.error(f"Error parsing MIME email: {e}")
        
        # If MIME parsing failed, try simple text extraction
        current_app.logger.warning("MIME parsing failed, trying simple extraction")
        
        # Look for text/plain content manually
        if 'Content-Type: text/plain' in email_field:
            # Find the text/plain section
            parts = email_field.split('Content-Type: text/plain')
            if len(parts) > 1:
                text_part = parts[1]
                # Find the actual content after headers
                lines = text_part.split('\n')
                content_lines = []
                in_content = False
                
                for line in lines:
                    line = line.strip()
                    
                    # Skip headers until we find content
                    if not in_content:
                        if line == '' or not (':' in line and not line.startswith(' ')):
                            in_content = True
                        continue
                    
                    # Stop at boundaries or quoted replies
                    if line.startswith('--') or line.startswith('On ') and 'wrote:' in line:
                        break
                    
                    if line and not line.startswith('>'):
                        content_lines.append(line)
                
                if content_lines:
                    content = ' '.join(content_lines).strip()
                    # Decode quoted-printable if needed
                    if '=' in content and content.count('=') > 2:
                        try:
                            content = quopri.decodestring(content.encode()).decode('utf-8', errors='ignore')
                        except:
                            pass
                    
                    if content and len(content) > 3:
                        current_app.logger.info(f"Manual extraction successful: '{content[:100]}...'")
                        return content
    
    # Try alternative field names
    for field_name in ['body', 'message', 'content', 'text_body', 'html_body', 'plain']:
        content = form_data.get(field_name, '').strip()
        if content:
            current_app.logger.info(f"Found content in field '{field_name}': '{content[:100]}...'")
            return content
    
    # If no content found
    current_app.logger.warning(f"No email content found. Form data keys: {list(form_data.keys())}")
    return "Email reply received (content not extracted)"

@emails_bp.route('/webhook/inbound', methods=['POST'])
def handle_inbound_email():
    """Handle incoming email replies via SendGrid webhook"""
    try:
        # Get form data from SendGrid webhook
        form_data = request.form.to_dict()
        
        # Log the webhook data for debugging
        current_app.logger.info(f"Webhook form data keys: {list(form_data.keys())}")
        
        # Extract email details
        from_email = form_data.get('from', '')
        to_email = form_data.get('to', '')
        subject = form_data.get('subject', '')
        
        # FIXED: Better email content extraction with MIME parsing
        email_content = extract_email_content(form_data)
        
        # Extract headers for threading
        headers = {}
        for key, value in form_data.items():
            if key.startswith('headers[') and key.endswith(']'):
                header_name = key[8:-1]  # Remove 'headers[' and ']'
                headers[header_name] = value
        
        message_id = headers.get('Message-ID', '')
        in_reply_to = headers.get('In-Reply-To', '')
        references = headers.get('References', '')
        
        current_app.logger.info(f"Received inbound email from {from_email} to {to_email}")
        
        # Parse the to_email to extract contact ID
        # Format: replies+{contact_id}@nothubspot.app
        if '+' in to_email and '@nothubspot.app' in to_email:
            contact_id = to_email.split('+')[1].split('@')[0]
        else:
            current_app.logger.warning(f"Could not parse contact ID from to_email: {to_email}")
            return jsonify({'success': False, 'error': 'Invalid to_email format'}), 400
        
        # Find the contact
        contact = Contact.query.filter_by(id=contact_id).first()
        if not contact:
            current_app.logger.warning(f"Contact not found: {contact_id}")
            return jsonify({'success': False, 'error': 'Contact not found'}), 404
        
        # Find the email thread
        thread_key = generate_thread_key(subject, from_email)
        thread = EmailThread.query.filter_by(
            tenant_id=contact.tenant_id,
            contact_id=contact.id,
            thread_key=thread_key
        ).first()
        
        if not thread:
            # Try to find thread by normalized subject
            normalized_subject = normalize_subject(subject)
            thread = EmailThread.query.filter(
                EmailThread.tenant_id == contact.tenant_id,
                EmailThread.contact_id == contact.id,
                EmailThread.thread_key.like(f"%{normalized_subject}%")
            ).first()
        
        if not thread:
            current_app.logger.warning(f"Thread not found for subject: {subject}")
            return jsonify({'success': False, 'error': 'Thread not found'}), 404
        
        # Create email reply record - FIXED: Use 'references' instead of 'email_references'
        email_reply = EmailReply(
            tenant_id=contact.tenant_id,
            thread_id=thread.id,
            contact_id=contact.id,
            from_email=from_email,
            from_name=form_data.get('from_name', ''),
            subject=subject,
            content_text=form_data.get('text', ''),
            content_html=form_data.get('html', ''),
            message_id=message_id,
            in_reply_to=in_reply_to,
            references=references,  # FIXED: Changed from 'email_references' to 'references'
            webhook_data=form_data,
            is_processed=True
        )
        db.session.add(email_reply)
        
        # Update thread activity
        thread.last_activity_at = datetime.utcnow()
        thread.reply_count += 1
        
        # FIXED: Create interaction record with properly extracted content
        interaction = Interaction(
            tenant_id=contact.tenant_id,
            contact_id=contact.id,
            type='email',
            subject=f"Email reply: {subject}",
            content=email_content,  # FIXED: Use extracted content instead of raw form data
            direction='inbound',
            status='completed',
            completed_at=datetime.utcnow()
        )
        db.session.add(interaction)
        
        db.session.commit()
        
        current_app.logger.info(f"Successfully processed inbound email reply for thread {thread.id}")
        
        return jsonify({
            'success': True,
            'message': 'Email reply processed successfully',
            'reply_id': email_reply.id,
            'thread_id': thread.id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error processing inbound email: {e}")
        return jsonify({
            'success': False,
            'error': {'message': 'Internal server error'}
        }), 500

@emails_bp.route('/threads/<thread_id>', methods=['GET'])
@require_auth
def get_thread(thread_id):
    """Get complete email thread with all emails and replies"""
    try:
        thread = EmailThread.query.filter_by(
            id=thread_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not thread:
            return jsonify({'success': False, 'error': {'message': 'Thread not found'}}), 404
        
        # Get all emails in thread
        emails = EmailSend.query.filter_by(thread_id=thread_id).order_by(EmailSend.sent_at).all()
        
        # Get all replies in thread
        replies = EmailReply.query.filter_by(thread_id=thread_id).order_by(EmailReply.received_at).all()
        
        # Combine and sort by timestamp
        thread_items = []
        
        for email in emails:
            thread_items.append({
                'type': 'email',
                'id': email.id,
                'subject': email.subject,
                'content': email.content,
                'timestamp': email.sent_at.isoformat(),
                'direction': 'outbound'
            })
        
        for reply in replies:
            thread_items.append({
                'type': 'reply',
                'id': reply.id,
                'subject': reply.subject,
                'content': reply.content_text or reply.content_html,
                'from_email': reply.from_email,
                'from_name': reply.from_name,
                'timestamp': reply.received_at.isoformat(),
                'direction': 'inbound'
            })
        
        # Sort by timestamp
        thread_items.sort(key=lambda x: x['timestamp'])
        
        return jsonify({
            'success': True,
            'thread': thread.to_dict(),
            'items': thread_items
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting thread: {e}")
        return jsonify({
            'success': False,
            'error': {'message': 'Internal server error'}
        }), 500

@emails_bp.route('/threads/contact/<contact_id>', methods=['GET'])
@require_auth
def get_contact_threads(contact_id):
    """Get all email threads for a contact"""
    try:
        threads = EmailThread.query.filter_by(
            contact_id=contact_id,
            tenant_id=g.current_tenant_id
        ).order_by(EmailThread.last_activity_at.desc()).all()
        
        return jsonify({
            'success': True,
            'threads': [thread.to_dict() for thread in threads]
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting contact threads: {e}")
        return jsonify({
            'success': False,
            'error': {'message': 'Internal server error'}
        }), 500

@emails_bp.route('/track/pixel/<pixel_token>.png', methods=['GET'])
def track_email_open(pixel_token):
    """Track email opens via tracking pixel"""
    try:
        # Find the pixel
        pixel = EmailPixel.query.filter_by(pixel_token=pixel_token).first()
        
        if pixel:
            # Check if this is a unique open (first time from this IP)
            ip_address = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR'))
            user_agent = request.headers.get('User-Agent', '')
            
            existing_open = EmailOpen.query.filter_by(
                pixel_id=pixel.id,
                ip_address=ip_address
            ).first()
            
            is_unique = existing_open is None
            
            # Record the open
            email_open = EmailOpen(
                pixel_id=pixel.id,
                ip_address=ip_address,
                user_agent=user_agent,
                is_unique=is_unique
            )
            db.session.add(email_open)
            db.session.commit()
        
        # Return 1x1 transparent PNG
        img = Image.new('RGBA', (1, 1), (0, 0, 0, 0))
        img_io = io.BytesIO()
        img.save(img_io, 'PNG')
        img_io.seek(0)
        
        return img_io.getvalue(), 200, {'Content-Type': 'image/png'}
        
    except Exception as e:
        current_app.logger.error(f"Error tracking email open: {e}")
        # Still return the pixel even if tracking fails
        img = Image.new('RGBA', (1, 1), (0, 0, 0, 0))
        img_io = io.BytesIO()
        img.save(img_io, 'PNG')
        img_io.seek(0)
        return img_io.getvalue(), 200, {'Content-Type': 'image/png'}

@emails_bp.route('/stats', methods=['GET'])
@require_auth
def get_email_stats():
    """Get email statistics for the tenant"""
    try:
        # Get email counts
        total_sent = EmailSend.query.filter_by(tenant_id=g.current_tenant_id).count()
        
        # Get open counts
        total_opens = db.session.query(EmailOpen).join(EmailPixel).join(EmailSend).filter(
            EmailSend.tenant_id == g.current_tenant_id
        ).count()
        
        unique_opens = db.session.query(EmailOpen).join(EmailPixel).join(EmailSend).filter(
            EmailSend.tenant_id == g.current_tenant_id,
            EmailOpen.is_unique == True
        ).count()
        
        # Calculate open rate
        open_rate = (unique_opens / total_sent * 100) if total_sent > 0 else 0
        
        return jsonify({
            'success': True,
            'stats': {
                'total_sent': total_sent,
                'total_opens': total_opens,
                'unique_opens': unique_opens,
                'open_rate': round(open_rate, 2)
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Error getting email stats: {e}")
        return jsonify({
            'success': False,
            'error': {'message': 'Internal server error'}
        }), 500

