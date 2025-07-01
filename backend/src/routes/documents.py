from flask import Blueprint, request, jsonify, g, current_app, send_file
from src.models.user import db, ContactDocument, Contact, Interaction, User
from datetime import datetime
from functools import wraps
import jwt
import os
import uuid
from werkzeug.utils import secure_filename
import mimetypes

documents_bp = Blueprint('documents', __name__)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', 'documents')
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_EXTENSIONS = {
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 
    'png', 'jpg', 'jpeg', 'gif', 'txt', 'csv'
}

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

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_type_from_filename(filename):
    """Determine file type based on filename"""
    extension = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    
    if extension == 'pdf':
        return 'proposal'  # Default PDFs to proposals
    elif extension in ['doc', 'docx']:
        return 'quote'  # Default Word docs to quotes
    elif extension in ['xls', 'xlsx']:
        return 'quote'  # Excel files are often quotes
    elif extension in ['ppt', 'pptx']:
        return 'presentation'
    elif extension in ['png', 'jpg', 'jpeg', 'gif']:
        return 'image'
    else:
        return 'other'

@documents_bp.route('/contact/<contact_id>', methods=['GET'])
@require_auth
def get_contact_documents(contact_id):
    """Get all documents for a contact"""
    try:
        # Verify contact exists and belongs to tenant
        contact = Contact.query.filter_by(
            id=contact_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not contact:
            return jsonify({'success': False, 'error': {'message': 'Contact not found'}}), 404
        
        # Get documents
        documents = ContactDocument.query.filter_by(
            contact_id=contact_id,
            tenant_id=g.current_tenant_id
        ).order_by(ContactDocument.created_at.desc()).all()
        
        return jsonify({
            'success': True,
            'data': [doc.to_dict() for doc in documents]
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting contact documents: {e}")
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@documents_bp.route('/contact/<contact_id>/upload', methods=['POST'])
@require_auth
def upload_document(contact_id):
    """Upload a document for a contact"""
    try:
        # Verify contact exists and belongs to tenant
        contact = Contact.query.filter_by(
            id=contact_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not contact:
            return jsonify({'success': False, 'error': {'message': 'Contact not found'}}), 404
        
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': {'message': 'No file provided'}}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': {'message': 'No file selected'}}), 400
        
        # Validate file
        if not allowed_file(file.filename):
            return jsonify({
                'success': False, 
                'error': {'message': f'File type not allowed. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'}
            }), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({
                'success': False, 
                'error': {'message': f'File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB'}
            }), 400
        
        # Get form data
        title = request.form.get('title', '')
        description = request.form.get('description', '')
        file_type = request.form.get('file_type', '')
        
        # Auto-detect file type if not provided
        if not file_type:
            file_type = get_file_type_from_filename(file.filename)
        
        # Generate unique filename
        original_filename = secure_filename(file.filename)
        file_extension = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else ''
        unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
        
        # Create directory structure
        tenant_dir = os.path.join(UPLOAD_FOLDER, g.current_tenant_id)
        contact_dir = os.path.join(tenant_dir, contact_id)
        os.makedirs(contact_dir, exist_ok=True)
        
        # Save file
        file_path = os.path.join(contact_dir, unique_filename)
        file.save(file_path)
        
        # Get MIME type
        mime_type, _ = mimetypes.guess_type(original_filename)
        if not mime_type:
            mime_type = 'application/octet-stream'
        
        # Create database record
        document = ContactDocument(
            tenant_id=g.current_tenant_id,
            contact_id=contact_id,
            user_id=g.current_user_id,
            filename=unique_filename,
            original_filename=original_filename,
            file_path=file_path,
            file_size=file_size,
            file_type=file_type,
            mime_type=mime_type,
            title=title or original_filename,
            description=description,
            status='draft'
        )
        
        db.session.add(document)
        db.session.commit()
        
        # Log interaction
        interaction = Interaction(
            tenant_id=g.current_tenant_id,
            contact_id=contact_id,
            user_id=g.current_user_id,
            type='document',
            subject=f'Document uploaded: {document.title}',
            content=f'Uploaded {file_type} document: {original_filename} ({document.file_size_formatted})',
            direction='outbound',
            status='completed',
            completed_at=datetime.utcnow()
        )
        db.session.add(interaction)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': document.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error uploading document: {e}")
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@documents_bp.route('/<document_id>', methods=['GET'])
@require_auth
def get_document(document_id):
    """Get document details"""
    try:
        document = ContactDocument.query.filter_by(
            id=document_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not document:
            return jsonify({'success': False, 'error': {'message': 'Document not found'}}), 404
        
        return jsonify({
            'success': True,
            'data': document.to_dict()
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting document: {e}")
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@documents_bp.route('/<document_id>/download', methods=['GET'])
@require_auth
def download_document(document_id):
    """Download a document"""
    try:
        document = ContactDocument.query.filter_by(
            id=document_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not document:
            return jsonify({'success': False, 'error': {'message': 'Document not found'}}), 404
        
        # Check if file exists
        if not os.path.exists(document.file_path):
            return jsonify({'success': False, 'error': {'message': 'File not found on disk'}}), 404
        
        # Update viewed timestamp if not already viewed
        if not document.viewed_at:
            document.viewed_at = datetime.utcnow()
            if document.status == 'sent':
                document.status = 'viewed'
            db.session.commit()
        
        return send_file(
            document.file_path,
            as_attachment=True,
            download_name=document.original_filename,
            mimetype=document.mime_type
        )
        
    except Exception as e:
        current_app.logger.error(f"Error downloading document: {e}")
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@documents_bp.route('/<document_id>/status', methods=['PUT'])
@require_auth
def update_document_status(document_id):
    """Update document status"""
    try:
        document = ContactDocument.query.filter_by(
            id=document_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not document:
            return jsonify({'success': False, 'error': {'message': 'Document not found'}}), 404
        
        data = request.get_json()
        new_status = data.get('status')
        
        if not new_status:
            return jsonify({'success': False, 'error': {'message': 'Status is required'}}), 400
        
        valid_statuses = ['draft', 'sent', 'viewed', 'signed', 'rejected']
        if new_status not in valid_statuses:
            return jsonify({
                'success': False, 
                'error': {'message': f'Invalid status. Valid options: {", ".join(valid_statuses)}'}
            }), 400
        
        # Update status and timestamps
        old_status = document.status
        document.status = new_status
        
        if new_status == 'sent' and not document.sent_at:
            document.sent_at = datetime.utcnow()
        elif new_status == 'viewed' and not document.viewed_at:
            document.viewed_at = datetime.utcnow()
        elif new_status == 'signed' and not document.signed_at:
            document.signed_at = datetime.utcnow()
        
        db.session.commit()
        
        # Log interaction
        interaction = Interaction(
            tenant_id=g.current_tenant_id,
            contact_id=document.contact_id,
            user_id=g.current_user_id,
            type='document',
            subject=f'Document status updated: {document.title}',
            content=f'Status changed from "{old_status}" to "{new_status}"',
            direction='outbound',
            status='completed',
            completed_at=datetime.utcnow()
        )
        db.session.add(interaction)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': document.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating document status: {e}")
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@documents_bp.route('/<document_id>', methods=['PUT'])
@require_auth
def update_document(document_id):
    """Update document metadata"""
    try:
        document = ContactDocument.query.filter_by(
            id=document_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not document:
            return jsonify({'success': False, 'error': {'message': 'Document not found'}}), 404
        
        data = request.get_json()
        
        # Update allowed fields
        if 'title' in data:
            document.title = data['title']
        if 'description' in data:
            document.description = data['description']
        if 'file_type' in data:
            valid_types = ['quote', 'proposal', 'contract', 'presentation', 'image', 'other']
            if data['file_type'] in valid_types:
                document.file_type = data['file_type']
        
        document.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': document.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating document: {e}")
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@documents_bp.route('/<document_id>', methods=['DELETE'])
@require_auth
def delete_document(document_id):
    """Delete a document"""
    try:
        document = ContactDocument.query.filter_by(
            id=document_id,
            tenant_id=g.current_tenant_id
        ).first()
        
        if not document:
            return jsonify({'success': False, 'error': {'message': 'Document not found'}}), 404
        
        # Delete file from disk
        if os.path.exists(document.file_path):
            os.remove(document.file_path)
        
        # Delete database record
        contact_id = document.contact_id
        document_title = document.title
        
        db.session.delete(document)
        db.session.commit()
        
        # Log interaction
        interaction = Interaction(
            tenant_id=g.current_tenant_id,
            contact_id=contact_id,
            user_id=g.current_user_id,
            type='document',
            subject=f'Document deleted: {document_title}',
            content=f'Document "{document_title}" was deleted',
            direction='outbound',
            status='completed',
            completed_at=datetime.utcnow()
        )
        db.session.add(interaction)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': {'message': 'Document deleted successfully'}
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting document: {e}")
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@documents_bp.route('/stats', methods=['GET'])
@require_auth
def get_document_stats():
    """Get document statistics for dashboard"""
    try:
        # Total documents
        total_documents = ContactDocument.query.filter_by(tenant_id=g.current_tenant_id).count()
        
        # Documents by status
        draft_count = ContactDocument.query.filter_by(tenant_id=g.current_tenant_id, status='draft').count()
        sent_count = ContactDocument.query.filter_by(tenant_id=g.current_tenant_id, status='sent').count()
        viewed_count = ContactDocument.query.filter_by(tenant_id=g.current_tenant_id, status='viewed').count()
        signed_count = ContactDocument.query.filter_by(tenant_id=g.current_tenant_id, status='signed').count()
        
        # Documents by type
        quotes_count = ContactDocument.query.filter_by(tenant_id=g.current_tenant_id, file_type='quote').count()
        proposals_count = ContactDocument.query.filter_by(tenant_id=g.current_tenant_id, file_type='proposal').count()
        contracts_count = ContactDocument.query.filter_by(tenant_id=g.current_tenant_id, file_type='contract').count()
        
        return jsonify({
            'success': True,
            'data': {
                'total_documents': total_documents,
                'by_status': {
                    'draft': draft_count,
                    'sent': sent_count,
                    'viewed': viewed_count,
                    'signed': signed_count
                },
                'by_type': {
                    'quotes': quotes_count,
                    'proposals': proposals_count,
                    'contracts': contracts_count
                }
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting document stats: {e}")
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

