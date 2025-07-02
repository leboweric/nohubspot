import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
from flask import current_app
import logging

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.api_key = None
        self.from_email = None
        self.client = None
    
    def initialize(self, api_key, from_email):
        """Initialize the email service with SendGrid credentials"""
        self.api_key = api_key
        self.from_email = from_email
        if api_key:
            self.client = SendGridAPIClient(api_key)
    
    def send_email(self, to_email, subject, content, from_name="SimpleCRM"):
        """Send an email using SendGrid"""
        if not self.client:
            logger.warning("SendGrid not configured - email not sent")
            return False
        
        try:
            from_email_obj = Email(self.from_email, from_name)
            to_email_obj = To(to_email)
            content_obj = Content("text/plain", content)
            
            mail = Mail(from_email_obj, to_email_obj, subject, content_obj)
            
            response = self.client.send(mail)
            
            if response.status_code in [200, 201, 202]:
                logger.info(f"Email sent successfully to {to_email}")
                return True
            else:
                logger.error(f"Failed to send email: {response.status_code} - {response.body}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending email: {str(e)}")
            return False
    
    def send_html_email(self, to_email, subject, html_content, text_content=None, from_name="SimpleCRM"):
        """Send an HTML email using SendGrid"""
        if not self.client:
            logger.warning("SendGrid not configured - email not sent")
            return False
        
        try:
            from_email_obj = Email(self.from_email, from_name)
            to_email_obj = To(to_email)
            
            mail = Mail(
                from_email=from_email_obj,
                to_emails=to_email_obj,
                subject=subject,
                html_content=html_content
            )
            
            if text_content:
                mail.content = [
                    Content("text/plain", text_content),
                    Content("text/html", html_content)
                ]
            
            response = self.client.send(mail)
            
            if response.status_code in [200, 201, 202]:
                logger.info(f"HTML email sent successfully to {to_email}")
                return True
            else:
                logger.error(f"Failed to send HTML email: {response.status_code} - {response.body}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending HTML email: {str(e)}")
            return False

# Global email service instance
email_service = EmailService()

def init_email_service(app):
    """Initialize the email service with app configuration"""
    api_key = app.config.get('SENDGRID_API_KEY')
    from_email = app.config.get('SENDGRID_FROM_EMAIL')
    email_service.initialize(api_key, from_email)
    return email_service

