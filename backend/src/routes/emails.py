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
import html

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
            from_email=email_service.from_email,
            to_email=contact.email
        )
        db.session.add(email_send)
        db.session.flush()  # Get email_send ID
        
        # Create tracking pixel
        pixel_token = secrets.token_urlsafe(32)
        pixel = EmailPixel(
            tenant_id=g.current_tenant_id,
            email_send_id=email_send.id,
            tracking_token=pixel_token
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
            email_send.sendgrid_message_id = send_result['message_id']
        
        # Update thread activity
        thread.last_message_at = datetime.utcnow()
        thread.message_count += 1
        
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
    """
    Extract clean email reply content from SendGrid webhook data.
    
    This function handles the complex MIME parsing needed to extract just the 
    user's reply text from SendGrid's webhook payload, ignoring headers,
    signatures, and quoted content.
    """
    current_app.logger.info(f"Starting email extraction from form data keys: {list(form_data.keys())}")
    
    # PRIORITY 1: Try SendGrid's clean fields first
    text_content = form_data.get('text', '').strip()
    html_content = form_data.get('html', '').strip()
    
    if text_content and len(text_content) > 3:
        cleaned = clean_reply_text(text_content)
        if cleaned and len(cleaned) > 3:
            current_app.logger.info(f"SUCCESS: Used SendGrid 'text' field: '{cleaned}'")
            return cleaned
    
    if html_content and len(html_content) > 3:
        plain_text = html_to_text(html_content)
        cleaned = clean_reply_text(plain_text)
        if cleaned and len(cleaned) > 3:
            current_app.logger.info(f"SUCCESS: Used SendGrid 'html' field: '{cleaned}'")
            return cleaned
    
    # PRIORITY 2: Parse the raw MIME email field
    raw_email = form_data.get('email', '').strip()
    if raw_email:
        current_app.logger.info(f"Parsing raw MIME email (length: {len(raw_email)})")
        
        try:
            # Parse using Python's email library
            msg = email.message_from_string(raw_email)
            
            # Extract content based on message structure
            if msg.is_multipart():
                extracted_content = extract_from_multipart(msg)
            else:
                extracted_content = extract_from_single_part(msg)
            
            if extracted_content and len(extracted_content) > 3:
                cleaned = clean_reply_text(extracted_content)
                if cleaned and len(cleaned) > 3:
                    current_app.logger.info(f"SUCCESS: Extracted from MIME: '{cleaned}'")
                    return cleaned
                    
        except Exception as e:
            current_app.logger.error(f"MIME parsing failed: {e}")
            
            # FALLBACK: Manual text extraction from raw email
            manual_content = manual_text_extraction(raw_email)
            if manual_content and len(manual_content) > 3:
                cleaned = clean_reply_text(manual_content)
                if cleaned and len(cleaned) > 3:
                    current_app.logger.info(f"SUCCESS: Manual extraction: '{cleaned}'")
                    return cleaned
    
    # PRIORITY 3: Try alternative field names
    for field_name in ['body', 'message', 'content', 'plain', 'text_body']:
        content = form_data.get(field_name, '').strip()
        if content and len(content) > 3:
            cleaned = clean_reply_text(content)
            if cleaned and len(cleaned) > 3:
                current_app.logger.info(f"SUCCESS: Found in '{field_name}': '{cleaned}'")
                return cleaned
    
    # If all else fails, return a default message
    current_app.logger.warning("FAILED: Could not extract email content from any source")
    return "Email reply received (content extraction failed)"

def extract_from_multipart(msg):
    """Extract content from multipart MIME message"""
    current_app.logger.info("Processing multipart message")
    
    # First pass: Look for text/plain parts
    for part in msg.walk():
        if part.get_content_type() == 'text/plain':
            content = decode_part_safely(part)
            if content and len(content.strip()) > 3:
                current_app.logger.info(f"Found text/plain content: '{content[:50]}...'")
                return content
    
    # Second pass: Look for text/html parts if no plain text found
    for part in msg.walk():
        if part.get_content_type() == 'text/html':
            content = decode_part_safely(part)
            if content and len(content.strip()) > 3:
                plain_content = html_to_text(content)
                if plain_content and len(plain_content.strip()) > 3:
                    current_app.logger.info(f"Found text/html content: '{plain_content[:50]}...'")
                    return plain_content
    
    return None

def extract_from_single_part(msg):
    """Extract content from single-part MIME message"""
    current_app.logger.info("Processing single-part message")
    
    content = decode_part_safely(msg)
    if not content:
        return None
    
    # If it's HTML, convert to text
    if msg.get_content_type() == 'text/html':
        content = html_to_text(content)
    
    return content if content and len(content.strip()) > 3 else None

def decode_part_safely(part):
    """Safely decode a MIME part with proper charset and encoding handling"""
    try:
        payload = part.get_payload(decode=True)
        if not payload:
            return None
        
        # Determine charset
        charset = part.get_content_charset() or 'utf-8'
        
        # Decode bytes to string
        try:
            text = payload.decode(charset, errors='ignore')
        except (UnicodeDecodeError, LookupError):
            # Fallback charsets
            for fallback_charset in ['utf-8', 'latin1', 'ascii']:
                try:
                    text = payload.decode(fallback_charset, errors='ignore')
                    break
                except:
                    continue
            else:
                return None
        
        # Handle quoted-printable transfer encoding
        transfer_encoding = part.get('Content-Transfer-Encoding', '').lower()
        if transfer_encoding == 'quoted-printable':
            try:
                # Decode quoted-printable
                text = quopri.decodestring(text.encode('utf-8')).decode('utf-8', errors='ignore')
            except Exception as e:
                current_app.logger.warning(f"Quoted-printable decode failed: {e}")
        
        return text.strip() if text else None
        
    except Exception as e:
        current_app.logger.warning(f"Part decode failed: {e}")
        return None

def html_to_text(html_content):
    """Convert HTML content to plain text"""
    if not html_content:
        return ""
    
    # Decode HTML entities
    text = html.unescape(html_content)
    
    # Remove script and style elements
    text = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', text, flags=re.DOTALL | re.IGNORECASE)
    
    # Replace common block elements with newlines
    text = re.sub(r'<(div|p|br|hr)[^>]*>', '\n', text, flags=re.IGNORECASE)
    
    # Remove all remaining HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    
    # Clean up whitespace
    text = re.sub(r'\s+', ' ', text)
    
    return text.strip()

def manual_text_extraction(raw_email):
    """Manual extraction fallback for when MIME parsing fails"""
    current_app.logger.info("Attempting manual text extraction")
    
    # Look for text/plain sections
    text_plain_pattern = r'Content-Type:\s*text/plain[^\r\n]*\r?\n\r?\n(.*?)(?=\r?\n--|\Z)'
    matches = re.findall(text_plain_pattern, raw_email, re.DOTALL | re.IGNORECASE)
    
    for match in matches:
        # Clean up the match
        content = match.replace('\r\n', '\n').replace('\\n', '\n')
        
        # Decode quoted-printable if present
        if '=' in content and content.count('=') > 2:
            try:
                content = quopri.decodestring(content.encode('utf-8')).decode('utf-8', errors='ignore')
            except:
                pass
        
        if content and len(content.strip()) > 3:
            current_app.logger.info(f"Manual extraction found: '{content[:50]}...'")
            return content.strip()
    
    return None

def clean_reply_text(content):
    """
    Clean reply text by removing quoted content, signatures, and email artifacts.
    
    This is the core function that extracts just the user's actual reply.
    """
    if not content or len(content.strip()) < 3:
        return ""
    
    # Split into lines for processing
    lines = content.split('\n')
    clean_lines = []
    
    for line in lines:
        line = line.strip()
        
        # Skip empty lines at the beginning
        if not clean_lines and not line:
            continue
        
        # STOP CONDITIONS - These indicate end of actual reply content
        
        # Email headers (From:, To:, Subject:, etc.)
        if re.match(r'^(From|To|Cc|Bcc|Subject|Date|Sent|Received):\s', line, re.IGNORECASE):
            break
        
        # Quoted reply markers
        if line.startswith('>') or line.startswith('&gt;'):
            break
        
        # Common reply attribution lines
        if re.match(r'^On\s+.+\s+wrote:?$', line, re.IGNORECASE):
            break
        
        # Handle attribution lines that don't end with "wrote:"
        if re.match(r'^On\s+\w+,\s+\w+\s+\d+,\s+\d+\s+at\s+\d+:', line, re.IGNORECASE):
            break
            
        if re.match(r'^.+\s+wrote:?$', line, re.IGNORECASE) and len(line) > 20:
            break
        
        # Email signatures
        if line in ['--', '---'] or (line.startswith('--') and len(line) <= 5):
            break
        
        # Mobile signatures
        mobile_sigs = [
            'sent from', 'get outlook', 'sent from my', 'this email',
            'download', 'unsubscribe', 'privacy policy'
        ]
        if any(sig in line.lower() for sig in mobile_sigs):
            break
        
        # Content-Transfer-Encoding artifacts (this was causing your issue!)
        if 'content-transfer-encoding' in line.lower():
            continue
        
        # MIME boundary markers
        if line.startswith('--') and (len(line) > 10 and '=' in line):
            break
        
        # Add the clean line
        if line:
            clean_lines.append(line)
    
    # Join the clean lines
    result = ' '.join(clean_lines).strip()
    
    # Final cleanup
    # Remove quoted-printable artifacts like =E2=80=AF
    result = re.sub(r'=([A-F0-9]{2})', '', result)
    
    # Remove excessive whitespace
    result = re.sub(r'\s+', ' ', result)
    
    # Remove common email artifacts
    result = re.sub(r'Content-Type:[^\r\n]*', '', result, flags=re.IGNORECASE)
    result = re.sub(r'Content-Transfer-Encoding:[^\r\n]*', '', result, flags=re.IGNORECASE)
    
    return result.strip() if len(result.strip()) > 3 else ""

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
        
        # IMPROVED: Better email content extraction with proper encoding handling
        email_content = extract_email_content(form_data)
        
        # Log the extracted content for debugging
        current_app.logger.info(f"Extracted email content: '{email_content[:200]}...'")
        
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
        
        # Create email reply record with cleaned content
        email_reply = EmailReply(
            tenant_id=contact.tenant_id,
            thread_id=thread.id,
            contact_id=contact.id,
            from_email=from_email,
            subject=subject,
            content=email_content,  # Store the cleaned content here
            message_id=message_id
        )
        db.session.add(email_reply)
        
        # Update thread activity
        thread.last_message_at = datetime.utcnow()
        thread.message_count += 1
        
        # Create interaction record with cleaned content
        interaction = Interaction(
            tenant_id=contact.tenant_id,
            contact_id=contact.id,
            type='email',
            subject=f"Email reply: {subject}",
            content=email_content,  # Use the cleaned content
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
            'thread_id': thread.id,
            'extracted_content': email_content  # Include in response for debugging
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
                'timestamp': email.sent_at.isoformat() if email.sent_at else email.created_at.isoformat(),
                'direction': 'outbound'
            })
        
        for reply in replies:
            thread_items.append({
                'type': 'reply',
                'id': reply.id,
                'subject': reply.subject,
                'content': reply.content,
                'from_email': reply.from_email,
                'timestamp': reply.received_at.isoformat() if reply.received_at else reply.created_at.isoformat(),
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
        ).order_by(EmailThread.last_message_at.desc()).all()
        
        # Add reply count to each thread
        for thread in threads:
            thread.reply_count = EmailReply.query.filter_by(thread_id=thread.id).count()
            thread.last_activity_at = thread.last_message_at
        
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
        pixel = EmailPixel.query.filter_by(tracking_token=pixel_token).first()
        
        if pixel:
            # Record the open
            ip_address = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR'))
            user_agent = request.headers.get('User-Agent', '')
            
            email_open = EmailOpen(
                tenant_id=pixel.tenant_id,
                email_send_id=pixel.email_send_id,
                ip_address=ip_address,
                user_agent=user_agent
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
    """Get email statistics for dashboard"""
    try:
        tenant_id = g.current_tenant_id
        
        # Get basic email stats - using only columns that exist
        total_emails = EmailSend.query.filter_by(tenant_id=tenant_id).count()
        
        # Get recent emails (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_emails = EmailSend.query.filter(
            EmailSend.tenant_id == tenant_id,
            EmailSend.created_at >= thirty_days_ago
        ).count()
        
        # Get open count using simple approach
        total_opens = EmailOpen.query.join(EmailPixel).join(EmailSend).filter(
            EmailSend.tenant_id == tenant_id
        ).count()
        
        # Calculate open rate
        open_rate = (total_opens / total_emails * 100) if total_emails > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'total_emails': total_emails,
                'recent_emails': recent_emails,
                'open_rate': round(open_rate, 1)
            }
        })
    except Exception as e:
        current_app.logger.error(f'Error getting email stats: {str(e)}')
        return jsonify({'success': False, 'message': 'Failed to get email stats'}), 500
