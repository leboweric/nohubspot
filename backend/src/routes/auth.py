from flask import Blueprint, request, jsonify, current_app
from src.models.user import db, User, Tenant, UserSession
from datetime import datetime, timedelta
import jwt
import secrets
import hashlib

auth_bp = Blueprint('auth', __name__)

def generate_tokens(user):
    """Generate JWT access and refresh tokens"""
    # Access token (15 minutes)
    access_payload = {
        'user_id': user.id,
        'tenant_id': user.tenant_id,
        'email': user.email,
        'role': user.role,
        'exp': datetime.utcnow() + timedelta(minutes=15)
    }
    access_token = jwt.encode(access_payload, current_app.config['SECRET_KEY'], algorithm='HS256')
    
    # Refresh token (7 days)
    refresh_payload = {
        'user_id': user.id,
        'tenant_id': user.tenant_id,
        'exp': datetime.utcnow() + timedelta(days=7)
    }
    refresh_token = jwt.encode(refresh_payload, current_app.config['SECRET_KEY'], algorithm='HS256')
    
    # Store refresh token in database
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    session = UserSession(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.session.add(session)
    db.session.commit()
    
    return access_token, refresh_token

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register new tenant and admin user"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['company_name', 'subdomain', 'first_name', 'last_name', 'email', 'password']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'error': {'message': f'{field} is required'}}), 400
        
        # Check if subdomain already exists
        if Tenant.query.filter_by(subdomain=data['subdomain']).first():
            return jsonify({'success': False, 'error': {'message': 'Subdomain already exists'}}), 400
        
        # Create tenant
        tenant = Tenant(
            name=data['company_name'],
            subdomain=data['subdomain']
        )
        db.session.add(tenant)
        db.session.flush()  # Get tenant ID
        
        # Check if email already exists for this tenant (shouldn't happen on registration)
        if User.query.filter_by(tenant_id=tenant.id, email=data['email']).first():
            return jsonify({'success': False, 'error': {'message': 'Email already exists'}}), 400
        
        # Create admin user
        user = User(
            tenant_id=tenant.id,
            email=data['email'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            role='admin'
        )
        user.set_password(data['password'])
        db.session.add(user)
        db.session.commit()
        
        # Generate tokens
        access_token, refresh_token = generate_tokens(user)
        
        return jsonify({
            'success': True,
            'data': {
                'user': user.to_dict(),
                'tenant': tenant.to_dict(),
                'access_token': access_token,
                'refresh_token': refresh_token
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """User login"""
    try:
        data = request.get_json()
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'success': False, 'error': {'message': 'Email and password are required'}}), 400
        
        # Find user by email (across all tenants)
        user = User.query.filter_by(email=data['email'], is_active=True).first()
        
        if not user or not user.check_password(data['password']):
            return jsonify({'success': False, 'error': {'message': 'Invalid email or password'}}), 401
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Generate tokens
        access_token, refresh_token = generate_tokens(user)
        
        return jsonify({
            'success': True,
            'data': {
                'user': user.to_dict(),
                'tenant': user.tenant.to_dict(),
                'access_token': access_token,
                'refresh_token': refresh_token
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@auth_bp.route('/refresh', methods=['POST'])
def refresh():
    """Refresh access token"""
    try:
        data = request.get_json()
        refresh_token = data.get('refresh_token')
        
        if not refresh_token:
            return jsonify({'success': False, 'error': {'message': 'Refresh token is required'}}), 400
        
        # Verify refresh token
        try:
            payload = jwt.decode(refresh_token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'error': {'message': 'Refresh token expired'}}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'error': {'message': 'Invalid refresh token'}}), 401
        
        # Check if token exists in database
        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        session = UserSession.query.filter_by(
            user_id=payload['user_id'],
            token_hash=token_hash
        ).first()
        
        if not session or session.expires_at < datetime.utcnow():
            return jsonify({'success': False, 'error': {'message': 'Invalid or expired refresh token'}}), 401
        
        # Get user
        user = User.query.get(payload['user_id'])
        if not user or not user.is_active:
            return jsonify({'success': False, 'error': {'message': 'User not found or inactive'}}), 401
        
        # Generate new access token
        access_payload = {
            'user_id': user.id,
            'tenant_id': user.tenant_id,
            'email': user.email,
            'role': user.role,
            'exp': datetime.utcnow() + timedelta(minutes=15)
        }
        access_token = jwt.encode(access_payload, current_app.config['SECRET_KEY'], algorithm='HS256')
        
        return jsonify({
            'success': True,
            'data': {
                'access_token': access_token
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Logout user and invalidate refresh token"""
    try:
        data = request.get_json()
        refresh_token = data.get('refresh_token')
        
        if refresh_token:
            # Remove refresh token from database
            token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
            session = UserSession.query.filter_by(token_hash=token_hash).first()
            if session:
                db.session.delete(session)
                db.session.commit()
        
        return jsonify({'success': True, 'data': {'message': 'Logged out successfully'}})
        
    except Exception as e:
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    """Get current user info"""
    try:
        # This route will use the auth middleware to get current user
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'success': False, 'error': {'message': 'Authorization header required'}}), 401
        
        token = auth_header.split(' ')[1]
        
        try:
            payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'error': {'message': 'Token expired'}}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'error': {'message': 'Invalid token'}}), 401
        
        user = User.query.get(payload['user_id'])
        if not user or not user.is_active:
            return jsonify({'success': False, 'error': {'message': 'User not found or inactive'}}), 401
        
        return jsonify({
            'success': True,
            'data': {
                'user': user.to_dict(),
                'tenant': user.tenant.to_dict()
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Request password reset"""
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'success': False, 'error': {'message': 'Email is required'}}), 400
        
        # Find user by email
        user = User.query.filter_by(email=email, is_active=True).first()
        
        # Always return success to prevent email enumeration
        if not user:
            return jsonify({
                'success': True, 
                'data': {'message': 'If an account exists with this email, you will receive password reset instructions.'}
            })
        
        # Generate reset token (valid for 1 hour)
        reset_token = secrets.token_urlsafe(32)
        reset_token_hash = hashlib.sha256(reset_token.encode()).hexdigest()
        
        # Store reset token in user record
        user.reset_token_hash = reset_token_hash
        user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
        db.session.commit()
        
        # In a real app, you would send an email here
        # For demo purposes, we'll return the token (remove this in production!)
        return jsonify({
            'success': True,
            'data': {
                'message': 'If an account exists with this email, you will receive password reset instructions.',
                'reset_token': reset_token  # Remove this in production!
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Reset password with token"""
    try:
        data = request.get_json()
        reset_token = data.get('reset_token')
        new_password = data.get('new_password')
        
        if not reset_token or not new_password:
            return jsonify({'success': False, 'error': {'message': 'Reset token and new password are required'}}), 400
        
        if len(new_password) < 6:
            return jsonify({'success': False, 'error': {'message': 'Password must be at least 6 characters long'}}), 400
        
        # Hash the provided token
        reset_token_hash = hashlib.sha256(reset_token.encode()).hexdigest()
        
        # Find user with matching reset token
        user = User.query.filter_by(
            reset_token_hash=reset_token_hash,
            is_active=True
        ).first()
        
        if not user or not user.reset_token_expires or user.reset_token_expires < datetime.utcnow():
            return jsonify({'success': False, 'error': {'message': 'Invalid or expired reset token'}}), 400
        
        # Update password and clear reset token
        user.set_password(new_password)
        user.reset_token_hash = None
        user.reset_token_expires = None
        user.updated_at = datetime.utcnow()
        
        # Invalidate all existing sessions for security
        UserSession.query.filter_by(user_id=user.id).delete()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': {'message': 'Password has been reset successfully. Please log in with your new password.'}
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

@auth_bp.route('/change-password', methods=['POST'])
def change_password():
    """Change password for authenticated user"""
    try:
        # Get current user from token
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'success': False, 'error': {'message': 'Authorization header required'}}), 401
        
        token = auth_header.split(' ')[1]
        
        try:
            payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'error': {'message': 'Token expired'}}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'error': {'message': 'Invalid token'}}), 401
        
        user = User.query.get(payload['user_id'])
        if not user or not user.is_active:
            return jsonify({'success': False, 'error': {'message': 'User not found or inactive'}}), 401
        
        data = request.get_json()
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        
        if not current_password or not new_password:
            return jsonify({'success': False, 'error': {'message': 'Current password and new password are required'}}), 400
        
        if not user.check_password(current_password):
            return jsonify({'success': False, 'error': {'message': 'Current password is incorrect'}}), 400
        
        if len(new_password) < 6:
            return jsonify({'success': False, 'error': {'message': 'New password must be at least 6 characters long'}}), 400
        
        # Update password
        user.set_password(new_password)
        user.updated_at = datetime.utcnow()
        
        # Invalidate all existing sessions except current one
        current_session_hash = None
        if request.headers.get('X-Refresh-Token'):
            refresh_token = request.headers.get('X-Refresh-Token')
            current_session_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        
        if current_session_hash:
            UserSession.query.filter(
                UserSession.user_id == user.id,
                UserSession.token_hash != current_session_hash
            ).delete()
        else:
            UserSession.query.filter_by(user_id=user.id).delete()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': {'message': 'Password changed successfully'}
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': {'message': str(e)}}), 500

