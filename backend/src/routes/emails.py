from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, From, To, Subject, HtmlContent, PlainTextContent, ReplyTo
from src.models.user import User, Contact, EmailSend, Interaction, EmailThread, EmailReply
from src.models.user import db
from datetime import datetime
import uuid
import os
import re
import email
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import html

emails_bp = Blueprint('emails', __name__)

def generate_thread_key(subject, from_email):
    """Generate a consistent thread key for grouping related emails"""
    # Remove common reply prefixes and normalize
    normalized_subject = re.sub(r'^(re:|fwd?:)\s*', '', subject.lower().strip())
    # Create a simple hash-like key
    return f"{normalized_subject}_{from_email.lower()}"

def normalize_subject(subject):
    """Normalize email subject for thread matching"""
    return re.sub(r'^(re:|fwd?:)\s*', '', subject.lower().strip())

def parse_email_content(raw_email):
    """Parse raw MIME email to extract text and HTML content"""
    try:
        # Parse the raw email
        msg = email.message_from_string(raw_email)
        
        text_content = ""
        html_content = ""
        
        if msg.is_multipart():
            # Handle multipart messages
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition", ""))
                
                # Skip attachments
                if "attachment" in content_disposition:
                    continue
                
                if content_type == "text/plain":
                    payload = part.get_payload(decode=True)
                    if payload:
                        text_content = payload.decode('utf-8', errors='ignore')
                        # Clean up quoted-printable encoding
                        text_content = text_content.replace('=\r\n', '').replace('=E2=80=AF', ' ')
                        
                elif content_type == "text/html":
                    payload = part.get_payload(decode=True)
                    if payload:
                        html_content = payload.decode('utf-8', errors='ignore')
                        # Clean up quoted-printable encoding
                        html_content = html_content.replace('=\r\n', '').replace('=E2=80=AF', ' ')
                        # Decode HTML entities
                        html_content = html.unescape(html_content)
        else:
            # Handle single-part messages
            content_type = msg.get_content_type()
            payload = msg.get_payload(decode=True)
            
            if payload:
                content = payload.decode('utf-8', errors='ignore')
                if content_type == "text/plain":
                    text_content = content
                elif content_type == "text/html":
                    html_content = content
        
        # Clean up the content - remove quoted sections and signatures
        if text_content:
            # Split by common reply separators and take the first part
            lines = text_content.split('\n')
            clean_lines = []
            for line in lines:
                # Stop at common reply indicators
                if any(indicator in line.lower() for indicator in [
                    'on ', 'wrote:', '>', 'from:', 'sent:', 'to:', 'subject:'
                ]):
                    break
                clean_lines.append(line)
            text_content = '\n'.join(clean_lines).strip()
        
        if html_content:
            # For HTML, try to extract just the new content before quoted sections
            # Look for gmail_quote or similar patterns
            if 'gmail_quote' in html_content:
                html_content = html_content.split('gmail_quote')[0]
            elif 'blockquote' in html_content:
                html_content = re.split(r'<blockquote[^>]*>', html_content)[0]
            html_content = html_content.strip()
        
        return text_content, html_content
        
    except Exception as e:
        current_app.logger.error(f"Error parsing email content: {str(e)}")
        return "", ""

@emails_bp.route('/send', methods=['POST'])
@jwt_required()
def send_email():
    try:
        data = request.get_json()
        current_user_id = get_jwt_identity()
        
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
        
        # Generate thread key and find or create thread
        thread_key = generate_thread_key(data['subject'], contact.email)
        thread = EmailThread.query.filter_by(
            tenant_id=current_user.tenant_id,
            contact_id=contact.id,
            thread_key=thread_key
        ).first()
        
        if not thread:
            thread = EmailThread(
                tenant_id=current_user.tenant_id,
                contact_id=contact.id,
                subject=data['subject'],
                thread_key=thread_key,
                is_active=True
            )
            db.session.add(thread)
            db.session.flush()  # Get the thread ID
        
        # Create email record
        email_id = str(uuid.uuid4())
        email_send = EmailSend(
            id=email_id,
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            contact_id=contact.id,
            thread_id=thread.id,  # Link to thread
            to_email=contact.email,
            to_name=contact.full_name,
            from_email=current_user.email,
            from_name=f"{current_user.full_name} ({current_user.company})" if current_user.company else current_user.full_name,
            subject=data['subject'],
            content=data['content'],
            status='sending'
        )
        db.session.add(email_send)
        
        # Update thread with first email reference
        if not thread.first_email_id:
            thread.first_email_id = email_id
            thread.last_activity_at = datetime.utcnow()
        
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
        
        # Prepare SendGrid email with custom reply-to for webhook capture
        reply_to_email = f"replies+{contact.id}@nothubspot.app"
        
        # Create tracking pixel URL
        tracking_pixel_url = f"{request.host_url}api/emails/track/pixel/{email_id}.png"
        
        # Add tracking pixel to content
        content_with_tracking = data['content'] + f'<img src="{tracking_pixel_url}" width="1" height="1" style="display: none;">'
        
        message = Mail(
            from_email=From(current_user.email, email_send.from_name),
            to_emails=To(contact.email, contact.full_name),
            subject=Subject(data['subject']),
            html_content=HtmlContent(content_with_tracking)
        )
        
        # Set custom reply-to for webhook capture
        message.reply_to = ReplyTo(reply_to_email, email_send.from_name)
        
        # Send email via SendGrid
        sg = SendGridAPIClient(api_key=os.environ.get('SENDGRID_API_KEY'))
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
            'email_id': email_id,
            'thread_id': thread.id
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error sending email: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@emails_bp.route('/track/pixel/<email_id>.png', methods=['GET'])
def track_email_open(email_id):
    try:
        # Remove .png extension
        email_id = email_id.replace('.png', '')
        
        # Find email record
        email_send = EmailSend.query.get(email_id)
        if email_send:
            # Update open tracking
            email_send.opens += 1
            email_send.first_opened_at = email_send.first_opened_at or datetime.utcnow()
            email_send.last_opened_at = datetime.utcnow()
            db.session.commit()
        
        # Return 1x1 transparent pixel
        pixel_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xdb\x00\x00\x00\x00IEND\xaeB`\x82'
        
        return pixel_data, 200, {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
        
    except Exception as e:
        current_app.logger.error(f"Error tracking email open: {str(e)}")
        # Still return pixel even if tracking fails
        pixel_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xdb\x00\x00\x00\x00IEND\xaeB`\x82'
        return pixel_data, 200, {'Content-Type': 'image/png'}

@emails_bp.route('/webhook/inbound', methods=['POST'])
def handle_inbound_email():
    try:
        # Get form data from SendGrid
        form_data = request.form.to_dict()
        
        # Extract email details
        from_email = form_data.get('from', '')
        to_email = form_data.get('to', '')
        subject = form_data.get('subject', '')
        
        # NEW: Parse content from raw email instead of expecting parsed fields
        raw_email = form_data.get('email', '')
        if raw_email:
            text_content, html_content = parse_email_content(raw_email)
        else:
            # Fallback to parsed fields if available
            text_content = form_data.get('text', '')
            html_content = form_data.get('html', '')
        
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
        current_app.logger.info(f"Extracted content - Text: {len(text_content)} chars, HTML: {len(html_content)} chars")
        
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
        
        # Create email reply record with parsed content
        email_reply = EmailReply(
            tenant_id=contact.tenant_id,
            thread_id=thread.id,
            contact_id=contact.id,
            from_email=from_email,
            from_name=form_data.get('from_name', ''),
            subject=subject,
            content_text=text_content,  # Now contains actual parsed content
            content_html=html_content,  # Now contains actual parsed content
            message_id=message_id,
            in_reply_to=in_reply_to,
            references=references,
            webhook_data=form_data,
            is_processed=True
        )
        db.session.add(email_reply)
        
        # Update thread activity
        thread.last_activity_at = datetime.utcnow()
        thread.reply_count += 1
        
        # Create interaction record for the reply
        interaction = Interaction(
            tenant_id=contact.tenant_id,
            contact_id=contact.id,
            type='email',
            subject=f"Email reply: {subject}",
            content=text_content or html_content,
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
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error processing inbound email: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@emails_bp.route('/threads/<thread_id>', methods=['GET'])
@jwt_required()
def get_email_thread(thread_id):
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        # Get the thread
        thread = EmailThread.query.filter_by(
            id=thread_id,
            tenant_id=current_user.tenant_id
        ).first()
        
        if not thread:
            return jsonify({'success': False, 'error': 'Thread not found'}), 404
        
        # Get all emails and replies for this thread
        emails = EmailSend.query.filter_by(thread_id=thread_id).all()
        replies = EmailReply.query.filter_by(thread_id=thread_id).all()
        
        # Combine and sort by timestamp
        thread_items = []
        
        for email in emails:
            thread_items.append({
                'id': email.id,
                'type': 'email',
                'direction': 'outbound',
                'from_name': email.from_name,
                'from_email': email.from_email,
                'subject': email.subject,
                'content': email.content,
                'timestamp': email.sent_at or email.created_at
            })
        
        for reply in replies:
            thread_items.append({
                'id': reply.id,
                'type': 'reply',
                'direction': 'inbound',
                'from_name': reply.from_name,
                'from_email': reply.from_email,
                'subject': reply.subject,
                'content': reply.content_text or reply.content_html,
                'timestamp': reply.received_at
            })
        
        # Sort by timestamp
        thread_items.sort(key=lambda x: x['timestamp'])
        
        return jsonify({
            'success': True,
            'thread': {
                'id': thread.id,
                'subject': thread.subject,
                'created_at': thread.created_at,
                'last_activity_at': thread.last_activity_at,
                'reply_count': thread.reply_count
            },
            'items': thread_items
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting email thread: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@emails_bp.route('/threads/contact/<contact_id>', methods=['GET'])
@jwt_required()
def get_contact_threads(contact_id):
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        # Get all threads for this contact
        threads = EmailThread.query.filter_by(
            contact_id=contact_id,
            tenant_id=current_user.tenant_id,
            is_active=True
        ).order_by(EmailThread.last_activity_at.desc()).all()
        
        thread_list = []
        for thread in threads:
            thread_list.append({
                'id': thread.id,
                'subject': thread.subject,
                'created_at': thread.created_at,
                'last_activity_at': thread.last_activity_at,
                'reply_count': thread.reply_count
            })
        
        return jsonify({
            'success': True,
            'threads': thread_list
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting contact threads: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@emails_bp.route('/<email_id>', methods=['GET'])
@jwt_required()
def get_email_details(email_id):
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        email_send = EmailSend.query.filter_by(
            id=email_id,
            tenant_id=current_user.tenant_id
        ).first()
        
        if not email_send:
            return jsonify({'success': False, 'error': 'Email not found'}), 404
        
        return jsonify({
            'success': True,
            'data': {
                'id': email_send.id,
                'to_email': email_send.to_email,
                'to_name': email_send.to_name,
                'from_email': email_send.from_email,
                'from_name': email_send.from_name,
                'subject': email_send.subject,
                'content': email_send.content,
                'status': email_send.status,
                'sent_at': email_send.sent_at,
                'opens': email_send.opens,
                'clicks': email_send.clicks,
                'first_opened_at': email_send.first_opened_at,
                'last_opened_at': email_send.last_opened_at
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting email details: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@emails_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_email_stats():
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        # Get email statistics
        total_sent = EmailSend.query.filter_by(
            tenant_id=current_user.tenant_id,
            status='sent'
        ).count()
        
        total_opens = db.session.query(db.func.sum(EmailSend.opens)).filter_by(
            tenant_id=current_user.tenant_id,
            status='sent'
        ).scalar() or 0
        
        total_clicks = db.session.query(db.func.sum(EmailSend.clicks)).filter_by(
            tenant_id=current_user.tenant_id,
            status='sent'
        ).scalar() or 0
        
        return jsonify({
            'success': True,
            'data': {
                'total_sent': total_sent,
                'total_opens': total_opens,
                'total_clicks': total_clicks,
                'open_rate': round((total_opens / total_sent * 100) if total_sent > 0 else 0, 1),
                'click_rate': round((total_clicks / total_sent * 100) if total_sent > 0 else 0, 1)
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting email stats: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

