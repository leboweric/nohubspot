from flask import Blueprint, request, jsonify, current_app

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
def send_email():
    """Debug version to catch import/model errors"""
    current_app.logger.info("=== EMAIL SEND DEBUG START ===")
    
    try:
        current_app.logger.info("Step 1: Getting request data")
        data = request.get_json()
        current_app.logger.info(f"Request data: {data}")
        
        current_app.logger.info("Step 2: Testing JWT import")
        from flask_jwt_extended import jwt_required, get_jwt_identity
        current_app.logger.info("JWT import successful")
        
        current_app.logger.info("Step 3: Testing database imports")
        from src.models.user import db, User, Contact
        current_app.logger.info("Basic models imported successfully")
        
        current_app.logger.info("Step 4: Testing EmailSend import")
        from src.models.user import EmailSend
        current_app.logger.info("EmailSend imported successfully")
        
        current_app.logger.info("Step 5: Testing Interaction import")
        from src.models.user import Interaction
        current_app.logger.info("Interaction imported successfully")
        
        current_app.logger.info("Step 6: Testing SendGrid imports")
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, From, To, Subject, HtmlContent
        current_app.logger.info("SendGrid imports successful")
        
        current_app.logger.info("Step 7: Testing other imports")
        from datetime import datetime
        import uuid
        import os
        current_app.logger.info("Other imports successful")
        
        current_app.logger.info("Step 8: Testing JWT token")
        current_user_id = get_jwt_identity()
        current_app.logger.info(f"Current user ID: {current_user_id}")
        
        current_app.logger.info("Step 9: All imports and basic operations successful")
        return jsonify({
            'success': True,
            'message': 'All debugging steps passed',
            'user_id': current_user_id
        })
        
    except Exception as e:
        current_app.logger.error(f"ERROR at step: {str(e)}")
        current_app.logger.error(f"Exception type: {type(e)}")
        import traceback
        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({'success': False, 'error': str(e)}), 500

@emails_bp.route('/threads/<thread_id>', methods=['GET'])
def get_email_thread(thread_id):
    """Placeholder thread endpoint"""
    return jsonify({
        'success': True,
        'thread': {'id': thread_id, 'messages': []}
    }), 200

@emails_bp.route('/threads/contact/<contact_id>', methods=['GET'])
def get_contact_threads(contact_id):
    """Placeholder contact threads endpoint"""
    return jsonify({
        'success': True,
        'threads': []
    }), 200

@emails_bp.route('/stats', methods=['GET'])
def get_email_stats():
    """Get email statistics"""
    return jsonify({
        'success': True,
        'stats': {
            'total_sent': 0,
            'total_opened': 0,
            'total_clicked': 0
        }
    }), 200

