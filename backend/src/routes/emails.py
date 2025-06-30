from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, From, To, Subject, HtmlContent, PlainTextContent, ReplyTo
from src.models.user import User, Contact, EmailSend, Interaction, EmailThread, EmailReply, db
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
                        try:
                            text_content = payload.decode('utf-8')
                        except UnicodeDecodeError:
                            text_content = payload.decode('latin-1')
                        # Clean up quoted content
                        text_content = clean_quoted_content(text_content)
                        break
                        
                elif content_type == "text/html":
                    payload = part.get_payload(decode=True)
                    if payload:
                        try:
                            html_content = payload.decode('utf-8')
                        except UnicodeDecodeError:
                            html_content = payload.decode('latin-1')
                        # Extract text from HTML and clean
                        text_from_html = html.unescape(re.sub('<[^<]+?>', '', html_content))
                        text_content = clean_quoted_content(text_from_html)
        else:
            # Handle single part messages
            content_type = msg.get_content_type()
            payload = msg.get_payload(decode=True)
            
            if payload:
                try:
                    content = payload.decode('utf-8')
                except UnicodeDecodeError:
                    content = payload.decode('latin-1')
                
                if content_type == "text/html":
                    html_content = content
                    # Extract text from HTML
                    text_content = html.unescape(re.sub('<[^<]+?>', '', content))
                else:
                    text_content = content
                
                text_content = clean_quoted_content(text_content)
        
        return text_content.strip(), html_content.strip()
        
    except Exception as e:
        current_app.logger.error(f"Error parsing email content: {str(e)}")
        return "", ""

def clean_quoted_content(content):
    """Remove quoted content from email replies"""
    if not content:
        return ""
    
    # Split by lines
    lines = content.split('\n')
    cleaned_lines = []
    
    for line in lines:
        line = line.strip()
        # Stop at common reply indicators
        if (line.startswith('On ') and ('wrote:' in line or 'sent:' in line)) or \
           line.startswith('From:') or \
           line.startswith('Sent:') or \
           line.startswith('To:') or \
           line.startswith('Subject:') or \
           line.startswith('-----Original Message-----') or \
           line.startswith('________________________________'):
            break
        cleaned_lines.append(line)
    
    return '\n'.join(cleaned_lines).strip()

@emails_bp.route('/send', methods=['POST'])
@jwt_required()
def send_email():
    current_app.logger.info("=== EMAIL SEND REQUEST STARTED ===")
    
    try:
        data = request.get_json()
        current_app.logger.info(f"Request data received: {data}")
        
        current_user_id = get_jwt_identity()
        current_app.logger.info(f"Current user ID: {current_user_id}")
        
        # Validate required fields
        required_fields = ['contact_id', 'to', 'subject', 'content']
        for field in required_fields:
            if field not in data:
                current_app.logger.error(f"Missing required field: {field}")
                return jsonify({'success': False, 'error': f'Missing required field: {field}'}), 422
        
        current_app.logger.info("All required fields present")
        
        # Get current user
        current_user = User.query.get(current_user_id)
        if not current_user:
            current_app.logger.error(f"User not found: {current_user_id}")
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        current_app.logger.info(f"Current user found: {current_user.email}")
        
        # Get contact
        contact = Contact.query.filter_by(
            id=data['contact_id'],
            tenant_id=current_user.tenant_id
        ).first()
        
        if not contact:
            current_app.logger.error(f"Contact not found: {data['contact_id']}")
            return jsonify({'success': False, 'error': 'Contact not found'}), 404
        
        current_app.logger.info(f"Contact found: {contact.email}")
        
        # Generate thread key and find or create thread
        thread_key = generate_thread_key(data['subject'], contact.email)
        current_app.logger.info(f"Generated thread key: {thread_key}")
        
        thread = EmailThread.query.filter_by(
            tenant_id=current_user.tenant_id,
            contact_id=contact.id,
            thread_key=thread_key
        ).first()
        
        if not thread:
            current_app.logger.info("Creating new email thread")
            thread = EmailThread(
                tenant_id=current_user.tenant_id,
                contact_id=contact.id,
                subject=data['subject'],
                thread_key=thread_key,
                is_active=True
            )
            db.session.add(thread)
            db.session.flush()  # Get the thread ID
            current_app.logger.info(f"New thread created with ID: {thread.id}")
        else:
            current_app.logger.info(f"Using existing thread ID: {thread.id}")
        
        # Create email record
        email_id = str(uuid.uuid4())
        current_app.logger.info(f"Generated email ID: {email_id}")
        
        email_send = EmailSend(
            id=email_id,
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            contact_id=contact.id,
            thread_id=thread.id,  # Link to thread
            to_email=data['to'],  # Use the 'to' field from frontend
            to_name=contact.full_name,
            from_email=current_user.email,
            from_name=f"{current_user.full_name} ({current_user.company})" if current_user.company else current_user.full_name,
            subject=data['subject'],
            content=data['content'],
            status='sending'
        )
        db.session.add(email_send)
        current_app.logger.info("Email record created")
        
        # Update thread with first email reference
        if not thread.first_email_id:
            thread.first_email_id = email_id
            thread.last_activity_at = datetime.utcnow()
            current_app.logger.info("Updated thread with first email reference")
        
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
        current_app.logger.info("Interaction record created")
        
        # Prepare SendGrid email with custom reply-to for webhook capture
        reply_to_email = f"replies+{contact.id}@nothubspot.app"
        current_app.logger.info(f"Reply-to email: {reply_to_email}")
        
        # Create tracking pixel URL
        tracking_pixel_url = f"{request.host_url}api/emails/track/pixel/{email_id}.png"
        current_app.logger.info(f"Tracking pixel URL: {tracking_pixel_url}")
        
        # Add tracking pixel to content
        content_with_tracking = data['content'] + f'<img src="{tracking_pixel_url}" width="1" height="1" style="display: none;">'
        
        message = Mail(
            from_email=From(current_user.email, email_send.from_name),
            to_emails=To(data['to'], contact.full_name),  # Use the 'to' field
            subject=Subject(data['subject']),
            html_content=HtmlContent(content_with_tracking)
        )
        
        # Set custom reply-to for webhook capture
        message.reply_to = ReplyTo(reply_to_email, email_send.from_name)
        current_app.logger.info("SendGrid message prepared")
        
        # Send email via SendGrid
        sendgrid_api_key = os.environ.get('SENDGRID_API_KEY')
        if not sendgrid_api_key:
            current_app.logger.error("SENDGRID_API_KEY not found in environment")
            return jsonify({'success': False, 'error': 'SendGrid API key not configured'}), 500
        
        current_app.logger.info("Sending email via SendGrid...")
        sg = SendGridAPIClient(api_key=sendgrid_api_key)
        response = sg.send(message)
        
        current_app.logger.info(f"SendGrid response status: {response.status_code}")
        current_app.logger.info(f"SendGrid response headers: {dict(response.headers)}")
        
        if response.status_code in [200, 202]:
            email_send.status = 'sent'
            email_send.sent_at = datetime.utcnow()
            email_send.sendgrid_message_id = response.headers.get('X-Message-Id', '')
            current_app.logger.info("Email sent successfully")
        else:
            email_send.status = 'failed'
            email_send.error_message = f"SendGrid error: {response.status_code}"
            current_app.logger.error(f"SendGrid error: {response.status_code}")
        
        db.session.commit()
        current_app.logger.info("Database committed")
        
        current_app.logger.info("=== EMAIL SEND REQUEST COMPLETED ===")
        return jsonify({
            'success': True,
            'message': 'Email sent successfully',
            'email_id': email_id,
            'thread_id': thread.id
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error sending email: {str(e)}")
        current_app.logger.error(f"Exception type: {type(e)}")
        import traceback
        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
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
    """Handle inbound emails from SendGrid webhook"""
    try:
        current_app.logger.info("=== INBOUND EMAIL WEBHOOK ===")
        
        # Get form data from SendGrid
        form_data = request.form
        current_app.logger.info(f"Webhook form data keys: {list(form_data.keys())}")
        
        # Extract email details
        to_email = form_data.get('to', '')
        from_email = form_data.get('from', '')
        subject = form_data.get('subject', '')
        raw_email = form_data.get('email', '')
        
        current_app.logger.info(f"Received inbound email from {from_email} to {to_email}")
        current_app.logger.info(f"Subject: {subject}")
        
        # Parse email content from raw MIME
        text_content, html_content = parse_email_content(raw_email)
        current_app.logger.info(f"Parsed content length - Text: {len(text_content)}, HTML: {len(html_content)}")
        
        # Extract contact ID from to_email
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
            current_app.logger.warning(f"Thread not found for key: {thread_key}")
            return jsonify({'success': False, 'error': 'Thread not found'}), 404
        
        # Create email reply record
        reply_id = str(uuid.uuid4())
        email_reply = EmailReply(
            id=reply_id,
            tenant_id=contact.tenant_id,
            thread_id=thread.id,
            contact_id=contact.id,
            from_email=from_email,
            from_name=form_data.get('from_name', ''),
            subject=subject,
            content_text=text_content,
            content_html=html_content,
            message_id=form_data.get('message-id', ''),
            in_reply_to=form_data.get('in-reply-to', ''),
            references=form_data.get('references', ''),
            received_at=datetime.utcnow(),
            is_processed=True,
            webhook_data=dict(form_data)
        )
        db.session.add(email_reply)
        
        # Update thread
        thread.reply_count += 1
        thread.last_activity_at = datetime.utcnow()
        
        # Create interaction record
        interaction = Interaction(
            tenant_id=contact.tenant_id,
            contact_id=contact.id,
            type='email',
            subject=f"Email reply: {subject}",
            content=text_content,
            direction='inbound',
            status='completed',
            completed_at=datetime.utcnow()
        )
        db.session.add(interaction)
        
        db.session.commit()
        
        current_app.logger.info(f"Successfully processed inbound email reply for thread {thread.id}")
        return jsonify({'success': True, 'message': 'Email reply processed'})
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error processing inbound email: {str(e)}")
        import traceback
        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

@emails_bp.route('/threads/<thread_id>', methods=['GET'])
@jwt_required()
def get_email_thread(thread_id):
    """Get complete email thread with all messages"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        # Get thread
        thread = EmailThread.query.filter_by(
            id=thread_id,
            tenant_id=current_user.tenant_id
        ).first()
        
        if not thread:
            return jsonify({'success': False, 'error': 'Thread not found'}), 404
        
        # Get all emails in thread
        sent_emails = EmailSend.query.filter_by(thread_id=thread_id).order_by(EmailSend.sent_at).all()
        replies = EmailReply.query.filter_by(thread_id=thread_id).order_by(EmailReply.received_at).all()
        
        # Combine and sort by timestamp
        messages = []
        
        for email in sent_emails:
            messages.append({
                'id': email.id,
                'type': 'sent',
                'from_email': email.from_email,
                'from_name': email.from_name,
                'to_email': email.to_email,
                'to_name': email.to_name,
                'subject': email.subject,
                'content': email.content,
                'timestamp': email.sent_at.isoformat() if email.sent_at else email.created_at.isoformat(),
                'status': email.status
            })
        
        for reply in replies:
            messages.append({
                'id': reply.id,
                'type': 'reply',
                'from_email': reply.from_email,
                'from_name': reply.from_name,
                'subject': reply.subject,
                'content': reply.content_text,
                'timestamp': reply.received_at.isoformat(),
                'status': 'received'
            })
        
        # Sort by timestamp
        messages.sort(key=lambda x: x['timestamp'])
        
        return jsonify({
            'success': True,
            'thread': {
                'id': thread.id,
                'subject': thread.subject,
                'contact_id': thread.contact_id,
                'reply_count': thread.reply_count,
                'last_activity_at': thread.last_activity_at.isoformat(),
                'messages': messages
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting email thread: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@emails_bp.route('/threads/contact/<contact_id>', methods=['GET'])
@jwt_required()
def get_contact_threads(contact_id):
    """Get all email threads for a contact"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        # Get all threads for contact
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
                'reply_count': thread.reply_count,
                'last_activity_at': thread.last_activity_at.isoformat(),
                'created_at': thread.created_at.isoformat()
            })
        
        return jsonify({
            'success': True,
            'threads': thread_list
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting contact threads: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

