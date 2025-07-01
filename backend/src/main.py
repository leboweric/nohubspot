import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from src.models.user import db
from src.routes.auth import auth_bp
from src.routes.contacts import contacts_bp
from src.routes.emails import emails_bp
from src.routes.quotes import quotes_bp
from src.routes.import_contacts import import_bp

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))

# Configuration
app.config['SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'dev-secret-change-in-production')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'dev-secret-change-in-production')
app.config['JWT_TOKEN_LOCATION'] = ['headers']
app.config['JWT_HEADER_NAME'] = 'Authorization'
app.config['JWT_HEADER_TYPE'] = 'Bearer'

# Initialize JWT
jwt = JWTManager(app)

# CORS configuration - Fixed for redirect issues
cors_origins = os.environ.get('CORS_ORIGINS', '')
if cors_origins != '':
    cors_origins = cors_origins.split(',')
    CORS(app, 
         origins=cors_origins, 
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
else:
    # Development CORS
    CORS(app, 
         origins=['http://localhost:3000', 'http://localhost:5173', 'https://nothubspot.app', 'https://www.nothubspot.app'], 
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization'],
         methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

# Register blueprints with strict_slashes=False to avoid redirect issues
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(contacts_bp, url_prefix='/api/contacts')
app.register_blueprint(emails_bp, url_prefix='/api/emails')
app.register_blueprint(quotes_bp, url_prefix='/api/quotes')
app.register_blueprint(import_bp, url_prefix='/api/import')

# Set strict_slashes=False for the entire app to prevent redirect issues
app.url_map.strict_slashes = False

# Database configuration
# Use PostgreSQL on Railway, SQLite for local development
database_url = os.environ.get('DATABASE_URL')
if database_url:
    # Railway PostgreSQL (production)
    # Fix postgres:// to postgresql:// for SQLAlchemy compatibility
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
else:
    # Local SQLite (development)
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'database', 'app.db')}"

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# Create database tables
with app.app_context():
    db.create_all()

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return {'success': True, 'message': 'CRM API is running'}, 200

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    """Serve frontend files"""
    static_folder_path = app.static_folder
    if static_folder_path is None:
        return "Static folder not configured", 404
    
    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    app.run(host='0.0.0.0', port=port, debug=debug)
