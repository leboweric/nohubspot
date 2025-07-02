from flask import Blueprint, request, jsonify
from src.models.user import db
from src.models.attachment import Attachment
from src.models.company import Company
from src.models.activity import Activity
import uuid
import os
from werkzeug.utils import secure_filename

attachments_bp = Blueprint('attachments', __name__)

# Configure upload settings
UPLOAD_FOLDER = 'uploads'
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@attachments_bp.route('/attachments', methods=['GET'])
def get_attachments():
    """Get all attachments, optionally filtered by company"""
    try:
        company_id = request.args.get('company_id')
        if company_id:
            attachments = Attachment.query.filter_by(company_id=company_id).all()
        else:
            attachments = Attachment.query.all()
        return jsonify([attachment.to_dict() for attachment in attachments])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@attachments_bp.route('/attachments/<attachment_id>', methods=['GET'])
def get_attachment(attachment_id):
    """Get a specific attachment by ID"""
    try:
        attachment = Attachment.query.get_or_404(attachment_id)
        return jsonify(attachment.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@attachments_bp.route('/attachments', methods=['POST'])
def upload_attachment():
    """Upload a new attachment"""
    try:
        # Check if file is in request
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Get form data
        company_id = request.form.get('companyId')
        description = request.form.get('description', '')
        
        # Verify company exists
        company = Company.query.get(company_id)
        if not company:
            return jsonify({'error': 'Company not found'}), 404
        
        # Validate file
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed'}), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({'error': 'File too large (max 100MB)'}), 400
        
        # Create upload directory if it doesn't exist
        upload_dir = os.path.join(os.path.dirname(__file__), '..', 'static', UPLOAD_FOLDER)
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save file
        filename = secure_filename(file.filename)
        attachment_id = str(uuid.uuid4())
        file_extension = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
        saved_filename = f"{attachment_id}.{file_extension}"
        file_path = os.path.join(upload_dir, saved_filename)
        file.save(file_path)
        
        # Create attachment record
        attachment = Attachment(
            id=attachment_id,
            name=filename,
            description=description,
            size=file_size,
            type=file.content_type,
            url=f"/uploads/{saved_filename}",
            company_id=company_id
        )
        
        db.session.add(attachment)
        
        # Add activity
        activity = Activity(
            id=str(uuid.uuid4()),
            title='Attachment Uploaded',
            description=f'Uploaded {filename}',
            type='attachment',
            entity_id=attachment_id
        )
        db.session.add(activity)
        
        db.session.commit()
        return jsonify(attachment.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@attachments_bp.route('/attachments/<attachment_id>', methods=['DELETE'])
def delete_attachment(attachment_id):
    """Delete an attachment"""
    try:
        attachment = Attachment.query.get_or_404(attachment_id)
        
        # Delete file from filesystem
        file_path = os.path.join(os.path.dirname(__file__), '..', 'static', attachment.url.lstrip('/'))
        if os.path.exists(file_path):
            os.remove(file_path)
        
        db.session.delete(attachment)
        db.session.commit()
        return jsonify({'message': 'Attachment deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

