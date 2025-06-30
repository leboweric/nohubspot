from flask import Blueprint, jsonify

emails_bp = Blueprint('emails', __name__)

@emails_bp.route('/health', methods=['GET'])
def emails_health():
    """Simple health check to verify emails blueprint is loading"""
    return jsonify({
        'success': True, 
        'message': 'Emails blueprint is working',
        'endpoint': 'emails_health'
    }), 200

@emails_bp.route('/send', methods=['POST'])
def send_email():
    """Minimal send endpoint that just returns success"""
    return jsonify({
        'success': True,
        'message': 'Minimal send endpoint reached'
    }), 200

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

