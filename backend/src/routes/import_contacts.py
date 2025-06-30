from flask import Blueprint, request, jsonify, current_app, g
from src.models.user import db, Contact, User
from datetime import datetime
from functools import wraps
import jwt
import pandas as pd
import io
import uuid
import re

import_bp = Blueprint('import', __name__)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = User.query.filter_by(id=data['user_id']).first()
            if not current_user:
                return jsonify({'message': 'Invalid token'}), 401
            g.current_user = current_user
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
        
        return f(*args, **kwargs)
    return decorated

def validate_email(email):
    """Simple email validation"""
    if not email or not isinstance(email, str):
        return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def clean_phone(phone):
    """Clean and format phone number"""
    if not phone or pd.isna(phone):
        return None
    phone_str = str(phone).strip()
    if not phone_str or phone_str.lower() in ['nan', 'none', '']:
        return None
    return phone_str

def process_import_data(df):
    """Process and validate import data"""
    results = {
        'total': len(df),
        'successful': 0,
        'failed': 0,
        'errors': [],
        'contacts': []
    }
    
    # Common column mappings (case insensitive)
    column_mappings = {
        'first_name': ['first name', 'firstname', 'first', 'fname', 'given name'],
        'last_name': ['last name', 'lastname', 'last', 'lname', 'surname', 'family name'],
        'email': ['email', 'email address', 'e-mail', 'mail'],
        'phone': ['phone', 'phone number', 'telephone', 'tel', 'mobile', 'cell'],
        'company': ['company', 'organization', 'org', 'business', 'employer'],
        'job_title': ['job title', 'title', 'position', 'role', 'job', 'designation']
    }
    
    # Normalize column names
    df.columns = df.columns.str.lower().str.strip()
    
    # Map columns
    mapped_columns = {}
    for standard_col, variations in column_mappings.items():
        for col in df.columns:
            if col in variations or col == standard_col:
                mapped_columns[standard_col] = col
                break
    
    # Process each row
    for index, row in df.iterrows():
        try:
            # Extract data using mapped columns
            first_name = str(row.get(mapped_columns.get('first_name', ''), '')).strip() if mapped_columns.get('first_name') else ''
            last_name = str(row.get(mapped_columns.get('last_name', ''), '')).strip() if mapped_columns.get('last_name') else ''
            email = str(row.get(mapped_columns.get('email', ''), '')).strip() if mapped_columns.get('email') else ''
            phone = clean_phone(row.get(mapped_columns.get('phone', ''))) if mapped_columns.get('phone') else None
            company = str(row.get(mapped_columns.get('company', ''), '')).strip() if mapped_columns.get('company') else ''
            job_title = str(row.get(mapped_columns.get('job_title', ''), '')).strip() if mapped_columns.get('job_title') else ''
            
            # Clean empty strings
            first_name = first_name if first_name and first_name.lower() not in ['nan', 'none', ''] else ''
            last_name = last_name if last_name and last_name.lower() not in ['nan', 'none', ''] else ''
            email = email if email and email.lower() not in ['nan', 'none', ''] else ''
            company = company if company and company.lower() not in ['nan', 'none', ''] else ''
            job_title = job_title if job_title and job_title.lower() not in ['nan', 'none', ''] else ''
            
            # Validation
            if not first_name and not last_name and not email:
                results['errors'].append(f"Row {index + 2}: Must have at least a name or email")
                results['failed'] += 1
                continue
            
            if email and not validate_email(email):
                results['errors'].append(f"Row {index + 2}: Invalid email format: {email}")
                results['failed'] += 1
                continue
            
            # Check for duplicate email in current tenant
            if email:
                existing_contact = Contact.query.filter_by(
                    email=email, 
                    tenant_id=g.current_user.tenant_id
                ).first()
                if existing_contact:
                    results['errors'].append(f"Row {index + 2}: Contact with email {email} already exists")
                    results['failed'] += 1
                    continue
            
            # Create contact data
            contact_data = {
                'id': str(uuid.uuid4()),
                'first_name': first_name,
                'last_name': last_name,
                'email': email,
                'phone': phone,
                'company': company,
                'job_title': job_title,
                'status': 'active',
                'tenant_id': g.current_user.tenant_id,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            
            results['contacts'].append(contact_data)
            results['successful'] += 1
            
        except Exception as e:
            results['errors'].append(f"Row {index + 2}: Error processing row - {str(e)}")
            results['failed'] += 1
    
    return results

@import_bp.route('/contacts', methods=['POST'])
@token_required
def import_contacts():
    """Import contacts from CSV or Excel file"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Check file type
        filename = file.filename.lower()
        if not (filename.endswith('.csv') or filename.endswith('.xlsx') or filename.endswith('.xls')):
            return jsonify({'error': 'Only CSV and Excel files are supported'}), 400
        
        # Read file
        try:
            file_content = file.read()
            if filename.endswith('.csv'):
                # Try different encodings for CSV
                for encoding in ['utf-8', 'latin-1', 'cp1252']:
                    try:
                        df = pd.read_csv(io.BytesIO(file_content), encoding=encoding)
                        break
                    except UnicodeDecodeError:
                        continue
                else:
                    return jsonify({'error': 'Unable to read CSV file. Please check the file encoding.'}), 400
            else:
                df = pd.read_excel(io.BytesIO(file_content))
        except Exception as e:
            return jsonify({'error': f'Error reading file: {str(e)}'}), 400
        
        if df.empty:
            return jsonify({'error': 'File is empty or has no valid data'}), 400
        
        # Process the data
        results = process_import_data(df)
        
        # Save successful contacts to database
        try:
            for contact_data in results['contacts']:
                contact = Contact(**contact_data)
                db.session.add(contact)
            
            db.session.commit()
            
            return jsonify({
                'message': 'Import completed',
                'total': results['total'],
                'successful': results['successful'],
                'failed': results['failed'],
                'errors': results['errors'][:10]  # Limit errors to first 10
            }), 200
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Database error: {str(e)}'}), 500
    
    except Exception as e:
        return jsonify({'error': f'Import failed: {str(e)}'}), 500

@import_bp.route('/template', methods=['GET'])
@token_required
def download_template():
    """Download CSV template for contact import"""
    template_data = {
        'First Name': ['John', 'Jane'],
        'Last Name': ['Doe', 'Smith'],
        'Email': ['john.doe@company.com', 'jane.smith@company.com'],
        'Phone': ['+1 (555) 123-4567', '+1 (555) 987-6543'],
        'Company': ['Acme Corp', 'Tech Solutions'],
        'Job Title': ['Marketing Manager', 'Sales Director']
    }
    
    df = pd.DataFrame(template_data)
    
    # Create CSV string
    csv_string = df.to_csv(index=False)
    
    return jsonify({
        'filename': 'contact_import_template.csv',
        'content': csv_string
    }), 200

