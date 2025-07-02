# SimpleCRM Backend

A complete Flask backend for the SimpleCRM application with PostgreSQL database and SendGrid email integration.

## Features

- **Companies Management** - CRUD operations for company records
- **Contacts Management** - Contact records linked to companies
- **Email Threading** - Send and track email conversations via SendGrid
- **File Attachments** - Upload and manage company attachments (up to 100MB)
- **Activity Tracking** - Audit trail of all CRM activities
- **PostgreSQL Database** - Production-ready database with SQLAlchemy ORM
- **SendGrid Integration** - Real email sending capabilities
- **CORS Enabled** - Ready for frontend integration

## API Endpoints

### Companies
- `GET /api/companies` - List all companies
- `GET /api/companies/{id}` - Get company details
- `POST /api/companies` - Create new company
- `PUT /api/companies/{id}` - Update company
- `DELETE /api/companies/{id}` - Delete company
- `GET /api/companies/{id}/contacts` - Get company contacts
- `GET /api/companies/{id}/attachments` - Get company attachments

### Contacts
- `GET /api/contacts` - List all contacts
- `GET /api/contacts/{id}` - Get contact details
- `POST /api/contacts` - Create new contact
- `PUT /api/contacts/{id}` - Update contact
- `DELETE /api/contacts/{id}` - Delete contact
- `GET /api/contacts/{id}/email-threads` - Get contact email threads

### Email Threading
- `GET /api/email-threads` - List email threads (optionally filtered by contact)
- `GET /api/email-threads/{id}` - Get thread details with messages
- `POST /api/email-threads` - Create new email thread (sends actual email)
- `POST /api/email-threads/{id}/messages` - Reply to thread (sends actual email)
- `POST /api/emails/test` - Test SendGrid configuration

### Attachments
- `GET /api/attachments` - List attachments (optionally filtered by company)
- `POST /api/attachments` - Upload new attachment
- `DELETE /api/attachments/{id}` - Delete attachment

### Activities
- `GET /api/activities` - List recent activities (audit trail)

### Database Seeding
- `POST /api/seed` - Populate database with sample data

## Railway Deployment

### 1. Prerequisites
- Railway account
- SendGrid account with API key
- This backend code repository

### 2. Environment Variables
Set these environment variables in Railway:

```bash
# Database (Railway provides this automatically)
DATABASE_URL=postgresql://username:password@host:port/database

# SendGrid Configuration (Required)
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Application Configuration
SECRET_KEY=your_secure_secret_key_here
PORT=5000
FLASK_ENV=production
```

### 3. Deploy to Railway

1. **Connect Repository**
   - Link your GitHub repository to Railway
   - Railway will auto-detect the Python application

2. **Add PostgreSQL Database**
   - Add PostgreSQL service in Railway
   - Railway will automatically set DATABASE_URL

3. **Configure Environment Variables**
   - Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL
   - Set a secure SECRET_KEY

4. **Deploy**
   - Railway will automatically build and deploy
   - Database tables will be created automatically

### 4. Initialize Database
After deployment, seed the database with sample data:

```bash
curl -X POST "https://your-railway-app.railway.app/api/seed"
```

### 5. Test Email Configuration
Test SendGrid integration:

```bash
curl -X POST "https://your-railway-app.railway.app/api/emails/test" \
  -H "Content-Type: application/json" \
  -d '{"to_email": "test@example.com"}'
```

## Local Development

### Setup
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export SENDGRID_API_KEY=your_api_key
export SENDGRID_FROM_EMAIL=your_email

# Run the application
python src/main.py
```

### Database
- Local development uses SQLite
- Production uses PostgreSQL via DATABASE_URL

### Testing
```bash
# Seed database
curl -X POST "http://localhost:5000/api/seed"

# Test endpoints
curl -X GET "http://localhost:5000/api/companies"
curl -X GET "http://localhost:5000/api/contacts"
curl -X GET "http://localhost:5000/api/activities"
```

## Frontend Integration

The backend is designed to work with the provided Next.js frontend. Key integration points:

1. **API Base URL** - Configure frontend to point to Railway deployment
2. **CORS** - Already enabled for all origins
3. **Data Format** - API responses match frontend TypeScript interfaces
4. **Email Threading** - Frontend can create threads that send real emails
5. **File Uploads** - Supports up to 100MB file attachments

## Database Schema

### Companies
- id, name, industry, website, description, address, status, notes, created_at
- Relationships: contacts, attachments

### Contacts  
- id, first_name, last_name, email, phone, title, company_id, status, notes, created_at
- Relationships: company, email_threads

### Email Threads
- id, subject, contact_id, preview, message_count, created_at
- Relationships: contact, messages

### Email Messages
- id, thread_id, sender, content, direction, timestamp
- Relationships: thread, attachments

### Attachments
- id, name, description, size, type, url, company_id, uploaded_at, uploaded_by
- Relationships: company

### Activities
- id, title, description, type, entity_id, date

## SendGrid Configuration

1. **Create SendGrid Account**
2. **Generate API Key** with Mail Send permissions
3. **Verify Sender Identity** (domain or single sender)
4. **Set Environment Variables** in Railway

The backend will automatically send emails when:
- Creating new email threads
- Replying to existing threads

## Security Features

- CORS enabled for frontend integration
- Environment-based configuration
- Secure file upload handling
- SQL injection protection via SQLAlchemy ORM
- Input validation and error handling

## Production Considerations

- Uses PostgreSQL for data persistence
- Handles file uploads up to 100MB
- Comprehensive error handling and logging
- Environment-based configuration
- Ready for horizontal scaling

