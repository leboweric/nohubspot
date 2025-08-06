from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, desc, asc, text
from typing import List, Optional
from datetime import datetime
from phone_utils import format_phone_number

from models import (
    Company, Contact, EmailThread, EmailMessage, 
    Task, Attachment, Activity, EmailSignature, CalendarEvent, EventAttendee,
    O365OrganizationConfig, O365UserConnection, 
    GoogleOrganizationConfig, GoogleUserConnection,
    User, PipelineStage, Deal,
    ProjectStage, Project, ProjectType
)
from schemas import (
    CompanyCreate, CompanyUpdate, ContactCreate, ContactUpdate,
    TaskCreate, TaskUpdate, EmailThreadCreate, EmailMessageCreate,
    AttachmentCreate, ActivityCreate, EmailSignatureCreate, EmailSignatureUpdate,
    CalendarEventCreate, CalendarEventUpdate, DashboardStats,
    EventAttendeeCreate, EventAttendeeResponse,
    O365OrganizationConfigCreate, O365OrganizationConfigUpdate, O365UserConnectionUpdate,
    GoogleOrganizationConfigCreate, GoogleOrganizationConfigUpdate, GoogleUserConnectionUpdate,
    PipelineStageCreate, PipelineStageUpdate, DealCreate, DealUpdate,
    ProjectStageCreate, ProjectStageUpdate, ProjectCreate, ProjectUpdate,
    ProjectTypeCreate, ProjectTypeUpdate
)

# Company CRUD operations
def create_company(db: Session, company: CompanyCreate, organization_id: int) -> Company:
    company_data = company.dict()
    # Format phone number if provided
    if company_data.get('phone'):
        company_data['phone'] = format_phone_number(company_data['phone'])
    
    db_company = Company(**company_data, organization_id=organization_id)
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    return db_company

def get_companies(
    db: Session, 
    organization_id: int,
    skip: int = 0, 
    limit: int = 100, 
    search: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "asc"
) -> List[Company]:
    # First, fix any NULL values in the database
    db.execute(text("""
        UPDATE companies 
        SET contact_count = COALESCE(contact_count, 0),
            attachment_count = COALESCE(attachment_count, 0),
            status = COALESCE(status, 'Active')
        WHERE organization_id = :org_id 
        AND (contact_count IS NULL OR attachment_count IS NULL OR status IS NULL)
    """), {"org_id": organization_id})
    db.commit()
    
    query = db.query(Company).options(
        joinedload(Company.primary_account_owner)
    ).filter(Company.organization_id == organization_id)
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Company.name.ilike(search_filter),
                Company.industry.ilike(search_filter),
                Company.website.ilike(search_filter)
            )
        )
    
    if status:
        query = query.filter(Company.status == status)
    
    # Apply sorting
    if sort_by:
        if sort_by == "name":
            order_column = Company.name
        elif sort_by == "location":
            order_column = Company.location
        elif sort_by == "postal_code":
            order_column = Company.postal_code
        elif sort_by == "created_at":
            order_column = Company.created_at
        else:
            order_column = Company.name  # default to name
        
        if sort_order == "desc":
            query = query.order_by(desc(order_column))
        else:
            query = query.order_by(asc(order_column))
    else:
        # Default sort by name ascending (alphabetical)
        query = query.order_by(asc(Company.name))
    
    return query.offset(skip).limit(limit).all()

def get_company(db: Session, company_id: int, organization_id: int) -> Optional[Company]:
    return db.query(Company).options(
        joinedload(Company.primary_account_owner)
    ).filter(
        Company.id == company_id,
        Company.organization_id == organization_id
    ).first()

def update_company(db: Session, company_id: int, company_update: CompanyUpdate, organization_id: int) -> Optional[Company]:
    db_company = get_company(db, company_id, organization_id)
    if not db_company:
        return None
    
    update_data = company_update.dict(exclude_unset=True)
    # Format phone number if being updated
    if 'phone' in update_data and update_data['phone']:
        update_data['phone'] = format_phone_number(update_data['phone'])
    
    for field, value in update_data.items():
        setattr(db_company, field, value)
    
    db.commit()
    db.refresh(db_company)
    return db_company

def delete_company(db: Session, company_id: int, organization_id: int) -> bool:
    db_company = get_company(db, company_id, organization_id)
    if not db_company:
        return False
    
    db.delete(db_company)
    db.commit()
    return True

# Contact CRUD operations
def create_contact(db: Session, contact: ContactCreate, organization_id: int) -> Contact:
    try:
        print(f"CRUD: Creating contact with data: {contact.dict()}")
        contact_data = contact.dict()
        # Format phone numbers if provided
        if contact_data.get('phone'):
            contact_data['phone'] = format_phone_number(contact_data['phone'])
        if contact_data.get('mobile_phone'):
            contact_data['mobile_phone'] = format_phone_number(contact_data['mobile_phone'])
        
        db_contact = Contact(**contact_data, organization_id=organization_id)
        print(f"CRUD: Contact object created: {db_contact.first_name} {db_contact.last_name}")
        
        db.add(db_contact)
        print("CRUD: Contact added to session")
        
        db.commit()
        print("CRUD: Database committed")
        
        db.refresh(db_contact)
        print(f"CRUD: Contact refreshed with ID: {db_contact.id}")
        
        # Update company contact count if company_id is provided
        if db_contact.company_id:
            company = get_company(db, db_contact.company_id, organization_id)
            if company:
                company.contact_count += 1
                db.commit()
                print(f"CRUD: Updated company contact count for company ID: {db_contact.company_id}")
        
        return db_contact
        
    except Exception as e:
        print(f"CRUD ERROR: Failed to create contact: {str(e)}")
        db.rollback()
        raise e

def get_contacts(
    db: Session,
    organization_id: int,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    company_id: Optional[int] = None,
    status: Optional[str] = None
) -> List[Contact]:
    # First, fix any NULL statuses or invalid emails for this organization
    db.execute(text("""
        UPDATE contacts 
        SET status = COALESCE(status, 'Active')
        WHERE organization_id = :org_id 
        AND status IS NULL
    """), {"org_id": organization_id})
    
    # Fix emails with parentheses - remove the parenthetical part
    db.execute(text("""
        UPDATE contacts 
        SET email = REGEXP_REPLACE(email, '\\([^)]*\\)', '', 'g')
        WHERE organization_id = :org_id 
        AND email LIKE '%(%)%'
    """), {"org_id": organization_id})
    
    # Fix email with spaces
    db.execute(text("""
        UPDATE contacts 
        SET email = REPLACE(email, ' ', '')
        WHERE organization_id = :org_id 
        AND email LIKE '% %'
    """), {"org_id": organization_id})
    
    # Fix emails with consecutive periods
    db.execute(text("""
        UPDATE contacts 
        SET email = REGEXP_REPLACE(email, '\\.{2,}', '.', 'g')
        WHERE organization_id = :org_id 
        AND email LIKE '%..%'
    """), {"org_id": organization_id})
    
    # Fix entries that are domains without @ sign (add info@ prefix)
    db.execute(text("""
        UPDATE contacts 
        SET email = 'info@' || email
        WHERE organization_id = :org_id 
        AND email NOT LIKE '%@%'
        AND email LIKE '%.%'
    """), {"org_id": organization_id})
    
    db.commit()
    
    query = db.query(Contact).filter(Contact.organization_id == organization_id)
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Contact.first_name.ilike(search_filter),
                Contact.last_name.ilike(search_filter),
                Contact.email.ilike(search_filter),
                Contact.company_name.ilike(search_filter),
                Contact.title.ilike(search_filter)
            )
        )
    
    if company_id:
        query = query.filter(Contact.company_id == company_id)
    
    if status:
        query = query.filter(Contact.status == status)
    
    return query.order_by(Contact.first_name.asc()).offset(skip).limit(limit).all()

def get_contact(db: Session, contact_id: int, organization_id: int) -> Optional[Contact]:
    contact = db.query(Contact).options(
        joinedload(Contact.company_rel)
    ).filter(
        Contact.id == contact_id,
        Contact.organization_id == organization_id
    ).first()
    
    # If company_rel is loaded but company_name is empty, sync it
    if contact and contact.company_rel and not contact.company_name:
        contact.company_name = contact.company_rel.name
        db.commit()
    
    return contact

def update_contact(db: Session, contact_id: int, contact_update: ContactUpdate, organization_id: int) -> Optional[Contact]:
    db_contact = get_contact(db, contact_id, organization_id)
    if not db_contact:
        return None
    
    # Store old company_id for contact count updates
    old_company_id = db_contact.company_id
    
    update_data = contact_update.dict(exclude_unset=True)
    # Format phone numbers if being updated
    if 'phone' in update_data and update_data['phone']:
        update_data['phone'] = format_phone_number(update_data['phone'])
    if 'mobile_phone' in update_data and update_data['mobile_phone']:
        update_data['mobile_phone'] = format_phone_number(update_data['mobile_phone'])
    
    for field, value in update_data.items():
        setattr(db_contact, field, value)
    
    db_contact.last_activity = datetime.utcnow()
    db.commit()
    
    # Update company contact counts if company changed
    new_company_id = db_contact.company_id
    if old_company_id != new_company_id:
        if old_company_id:
            old_company = get_company(db, old_company_id, organization_id)
            if old_company and old_company.contact_count > 0:
                old_company.contact_count -= 1
        
        if new_company_id:
            new_company = get_company(db, new_company_id, organization_id)
            if new_company:
                new_company.contact_count += 1
        
        db.commit()
    
    db.refresh(db_contact)
    return db_contact

def delete_contact(db: Session, contact_id: int, organization_id: int) -> bool:
    db_contact = get_contact(db, contact_id, organization_id)
    if not db_contact:
        return False
    
    # Update company contact count
    if db_contact.company_id:
        company = get_company(db, db_contact.company_id, organization_id)
        if company and company.contact_count > 0:
            company.contact_count -= 1
    
    db.delete(db_contact)
    db.commit()
    return True

# Task CRUD operations
def create_task(db: Session, task: TaskCreate, organization_id: int) -> Task:
    db_task = Task(**task.dict(), organization_id=organization_id)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def get_tasks(
    db: Session,
    organization_id: int,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    contact_id: Optional[int] = None,
    company_id: Optional[int] = None
) -> List[Task]:
    query = db.query(Task).filter(Task.organization_id == organization_id)
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Task.title.ilike(search_filter),
                Task.description.ilike(search_filter),
                Task.contact_name.ilike(search_filter),
                Task.company_name.ilike(search_filter)
            )
        )
    
    if status:
        query = query.filter(Task.status == status)
    
    if priority:
        query = query.filter(Task.priority == priority)
    
    if contact_id:
        query = query.filter(Task.contact_id == contact_id)
    
    if company_id:
        query = query.filter(Task.company_id == company_id)
    
    return query.order_by(desc(Task.created_at)).offset(skip).limit(limit).all()

def get_task(db: Session, task_id: int, organization_id: int) -> Optional[Task]:
    return db.query(Task).filter(
        Task.id == task_id,
        Task.organization_id == organization_id
    ).first()

def update_task(db: Session, task_id: int, task_update: TaskUpdate, organization_id: int) -> Optional[Task]:
    db_task = get_task(db, task_id, organization_id)
    if not db_task:
        return None
    
    update_data = task_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_task, field, value)
    
    # Set completed_at if status changed to completed
    if task_update.status == "completed" and db_task.status != "completed":
        db_task.completed_at = datetime.utcnow()
    elif task_update.status != "completed":
        db_task.completed_at = None
    
    db.commit()
    db.refresh(db_task)
    return db_task

def delete_task(db: Session, task_id: int, organization_id: int) -> bool:
    db_task = get_task(db, task_id, organization_id)
    if not db_task:
        return False
    
    db.delete(db_task)
    db.commit()
    return True

# Email Thread CRUD operations
def create_email_thread(db: Session, thread: EmailThreadCreate, organization_id: int) -> EmailThread:
    db_thread = EmailThread(**thread.dict(), organization_id=organization_id)
    db.add(db_thread)
    db.commit()
    db.refresh(db_thread)
    return db_thread

def get_email_threads(
    db: Session,
    organization_id: int,
    skip: int = 0,
    limit: int = 100,
    contact_id: Optional[int] = None
) -> List[EmailThread]:
    query = db.query(EmailThread).filter(EmailThread.organization_id == organization_id)
    
    if contact_id:
        query = query.filter(EmailThread.contact_id == contact_id)
    
    return query.order_by(desc(EmailThread.updated_at)).offset(skip).limit(limit).all()

def add_email_message(db: Session, thread_id: int, message: EmailMessageCreate, organization_id: int) -> EmailMessage:
    # Create message with thread_id
    message_data = message.dict()
    message_data['thread_id'] = thread_id
    db_message = EmailMessage(**message_data)
    db.add(db_message)
    
    # Update thread message count and preview - ensure thread belongs to same tenant
    thread = db.query(EmailThread).filter(
        EmailThread.id == thread_id,
        EmailThread.organization_id == organization_id
    ).first()
    if thread:
        thread.message_count += 1
        thread.preview = message.content[:100] + ("..." if len(message.content) > 100 else "")
        thread.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_message)
    return db_message

# Attachment CRUD operations
def create_attachment(db: Session, attachment: AttachmentCreate, organization_id: int) -> Attachment:
    db_attachment = Attachment(**attachment.dict(), organization_id=organization_id)
    db.add(db_attachment)
    db.commit()
    
    # Update company attachment count
    if db_attachment.company_id:
        company = get_company(db, db_attachment.company_id, organization_id)
        if company:
            company.attachment_count += 1
            db.commit()
    
    db.refresh(db_attachment)
    return db_attachment

def get_attachments(
    db: Session,
    organization_id: int,
    skip: int = 0,
    limit: int = 100,
    company_id: Optional[int] = None
) -> List[Attachment]:
    query = db.query(Attachment).filter(Attachment.organization_id == organization_id)
    
    if company_id:
        query = query.filter(Attachment.company_id == company_id)
    
    return query.order_by(desc(Attachment.created_at)).offset(skip).limit(limit).all()

# Activity CRUD operations
def create_activity(
    db: Session,
    title: str,
    description: str,
    type: str,
    organization_id: int,
    entity_id: Optional[str] = None,
    created_by: Optional[str] = None
) -> Activity:
    activity_data = ActivityCreate(
        title=title,
        description=description,
        type=type,
        entity_id=entity_id,
        created_by=created_by
    )
    db_activity = Activity(**activity_data.dict(), organization_id=organization_id)
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    return db_activity

def get_recent_activities(db: Session, organization_id: int, limit: int = 10) -> List[Activity]:
    return db.query(Activity).filter(Activity.organization_id == organization_id).order_by(desc(Activity.created_at)).limit(limit).all()

# Email Signature CRUD operations
def get_email_signature(db: Session, user_id: str = "default", organization_id: int = 1) -> Optional[EmailSignature]:
    return db.query(EmailSignature).filter(
        EmailSignature.user_id == user_id,
        EmailSignature.organization_id == organization_id
    ).first()

def create_or_update_email_signature(
    db: Session, 
    signature_data: EmailSignatureCreate, 
    user_id: str = "default",
    organization_id: int = 1
) -> EmailSignature:
    existing_signature = get_email_signature(db, user_id, organization_id)
    
    if existing_signature:
        # Update existing signature
        update_data = signature_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(existing_signature, field, value)
        
        db.commit()
        db.refresh(existing_signature)
        return existing_signature
    else:
        # Create new signature
        db_signature = EmailSignature(**signature_data.dict(), user_id=user_id, organization_id=organization_id)
        db.add(db_signature)
        db.commit()
        db.refresh(db_signature)
        return db_signature

# Bulk operations
def bulk_create_companies(db: Session, companies: List[CompanyCreate], organization_id: int) -> List[Company]:
    db_companies = []
    for company_data in companies:
        data = company_data.dict()
        # Format phone number if provided
        if data.get('phone'):
            data['phone'] = format_phone_number(data['phone'])
        
        db_company = Company(**data, organization_id=organization_id)
        db.add(db_company)
        db_companies.append(db_company)
    
    db.commit()
    for company in db_companies:
        db.refresh(company)
    
    return db_companies

def bulk_create_contacts(db: Session, contacts: List[ContactCreate], organization_id: int) -> List[Contact]:
    db_contacts = []
    for contact_data in contacts:
        data = contact_data.dict()
        # Format phone numbers if provided
        if data.get('phone'):
            data['phone'] = format_phone_number(data['phone'])
        if data.get('mobile_phone'):
            data['mobile_phone'] = format_phone_number(data['mobile_phone'])
        
        db_contact = Contact(**data, organization_id=organization_id)
        db.add(db_contact)
        db_contacts.append(db_contact)
    
    db.commit()
    
    # Update company contact counts
    company_counts = {}
    for contact in db_contacts:
        if contact.company_id:
            company_counts[contact.company_id] = company_counts.get(contact.company_id, 0) + 1
        db.refresh(contact)
    
    for company_id, count in company_counts.items():
        company = get_company(db, company_id, organization_id)
        if company:
            company.contact_count += count
    
    if company_counts:
        db.commit()
    
    return db_contacts

# Dashboard statistics
def get_dashboard_stats(db: Session, organization_id: int) -> DashboardStats:
    total_companies = db.query(Company).filter(Company.organization_id == organization_id).count()
    total_contacts = db.query(Contact).filter(Contact.organization_id == organization_id).count()
    total_tasks = db.query(Task).filter(Task.organization_id == organization_id).count()
    total_email_threads = db.query(EmailThread).filter(EmailThread.organization_id == organization_id).count()
    
    active_companies = db.query(Company).filter(
        Company.organization_id == organization_id,
        Company.status == "Active"
    ).count()
    active_contacts = db.query(Contact).filter(
        Contact.organization_id == organization_id,
        Contact.status == "Active"
    ).count()
    pending_tasks = db.query(Task).filter(
        Task.organization_id == organization_id,
        Task.status == "pending"
    ).count()
    
    # Count overdue tasks
    current_time = datetime.utcnow()
    overdue_tasks = db.query(Task).filter(
        and_(
            Task.organization_id == organization_id,
            Task.due_date < current_time,
            Task.status != "completed"
        )
    ).count()
    
    return DashboardStats(
        total_companies=total_companies,
        total_contacts=total_contacts,
        total_tasks=total_tasks,
        total_email_threads=total_email_threads,
        active_companies=active_companies,
        active_contacts=active_contacts,
        pending_tasks=pending_tasks,
        overdue_tasks=overdue_tasks
    )

# Calendar Event CRUD operations
def create_calendar_event(db: Session, event: CalendarEventCreate, organization_id: int, created_by: int) -> CalendarEvent:
    # Extract attendee_ids from the event data before creating the event
    event_data = event.dict()
    attendee_ids = event_data.pop('attendee_ids', [])
    
    # Create the calendar event
    db_event = CalendarEvent(**event_data, organization_id=organization_id, created_by=created_by)
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    
    # Create attendee records if attendee_ids were provided
    if attendee_ids:
        for contact_id in attendee_ids:
            attendee = EventAttendee(
                event_id=db_event.id,
                contact_id=contact_id,
                status="invited",
                invite_sent=False
            )
            db.add(attendee)
        
        db.commit()
        db.refresh(db_event)  # Refresh to include the new attendees relationship
    
    return db_event

def get_calendar_events(
    db: Session, 
    organization_id: int,
    skip: int = 0, 
    limit: int = 100,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    contact_id: Optional[int] = None,
    company_id: Optional[int] = None,
    event_type: Optional[str] = None
) -> List[CalendarEvent]:
    query = db.query(CalendarEvent).filter(CalendarEvent.organization_id == organization_id)
    
    # Filter by date range - include events that overlap with the range
    if start_date and end_date:
        # Event overlaps if: event_start <= range_end AND event_end >= range_start
        query = query.filter(
            CalendarEvent.start_time <= end_date,
            CalendarEvent.end_time >= start_date
        )
    elif start_date:
        # Only start date provided - events that end on or after start date
        query = query.filter(CalendarEvent.end_time >= start_date)
    elif end_date:
        # Only end date provided - events that start on or before end date
        query = query.filter(CalendarEvent.start_time <= end_date)
    
    # Filter by related entities
    if contact_id:
        query = query.filter(CalendarEvent.contact_id == contact_id)
    if company_id:
        query = query.filter(CalendarEvent.company_id == company_id)
    if event_type:
        query = query.filter(CalendarEvent.event_type == event_type)
    
    return query.options(
        joinedload(CalendarEvent.attendees)
    ).order_by(CalendarEvent.start_time).offset(skip).limit(limit).all()

def get_calendar_event(db: Session, event_id: int, organization_id: int) -> Optional[CalendarEvent]:
    return db.query(CalendarEvent).options(
        joinedload(CalendarEvent.attendees)
    ).filter(
        and_(CalendarEvent.id == event_id, CalendarEvent.organization_id == organization_id)
    ).first()

# Helper function for permission checking
def is_org_owner(user: User) -> bool:
    """Check if user is the organization owner"""
    return user.role == "owner"

# Office 365 Organization Configuration CRUD operations
def get_o365_org_config(db: Session, organization_id: int) -> Optional[O365OrganizationConfig]:
    """Get O365 organization configuration"""
    return db.query(O365OrganizationConfig).filter(
        O365OrganizationConfig.organization_id == organization_id
    ).first()

def create_o365_org_config(
    db: Session, 
    config: O365OrganizationConfigCreate, 
    organization_id: int
) -> O365OrganizationConfig:
    """Create O365 organization configuration"""
    from o365_encryption import encrypt_client_secret
    
    # Encrypt client secret if provided
    encrypted_secret = None
    if config.client_secret:
        encrypted_secret = encrypt_client_secret(config.client_secret)
    
    db_config = O365OrganizationConfig(
        organization_id=organization_id,
        client_id=config.client_id,
        client_secret_encrypted=encrypted_secret,
        tenant_id=config.tenant_id,
        calendar_sync_enabled=config.calendar_sync_enabled,
        email_sending_enabled=config.email_sending_enabled,
        contact_sync_enabled=config.contact_sync_enabled,
        is_configured=bool(config.client_id and config.client_secret and config.tenant_id)
    )
    
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config

def update_o365_org_config(
    db: Session,
    organization_id: int,
    config_update: O365OrganizationConfigUpdate
) -> Optional[O365OrganizationConfig]:
    """Update O365 organization configuration"""
    from o365_encryption import encrypt_client_secret
    
    db_config = get_o365_org_config(db, organization_id)
    if not db_config:
        return None
    
    update_data = config_update.dict(exclude_unset=True)
    
    # Handle client secret encryption
    if "client_secret" in update_data and update_data["client_secret"]:
        update_data["client_secret_encrypted"] = encrypt_client_secret(update_data["client_secret"])
        del update_data["client_secret"]
    
    # Update is_configured status
    is_configured = bool(
        (update_data.get("client_id") or db_config.client_id) and
        (update_data.get("client_secret_encrypted") or db_config.client_secret_encrypted) and
        (update_data.get("tenant_id") or db_config.tenant_id)
    )
    update_data["is_configured"] = is_configured
    
    for field, value in update_data.items():
        setattr(db_config, field, value)
    
    db.commit()
    db.refresh(db_config)
    return db_config

def delete_o365_org_config(db: Session, organization_id: int) -> bool:
    """Delete O365 organization configuration and all user connections"""
    db_config = get_o365_org_config(db, organization_id)
    if not db_config:
        return False
    
    db.delete(db_config)
    db.commit()
    return True

# Office 365 User Connection CRUD operations
def get_o365_user_connection(db: Session, user_id: int) -> Optional[O365UserConnection]:
    """Get O365 user connection"""
    return db.query(O365UserConnection).filter(
        O365UserConnection.user_id == user_id
    ).first()

def get_o365_user_connections_by_org(db: Session, organization_id: int) -> List[O365UserConnection]:
    """Get all O365 user connections for an organization"""
    return db.query(O365UserConnection).filter(
        O365UserConnection.organization_id == organization_id
    ).all()

def update_o365_user_connection(
    db: Session,
    user_id: int,
    connection_update: O365UserConnectionUpdate
) -> Optional[O365UserConnection]:
    """Update O365 user connection preferences"""
    db_connection = get_o365_user_connection(db, user_id)
    if not db_connection:
        return None
    
    update_data = connection_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_connection, field, value)
    
    db.commit()
    db.refresh(db_connection)
    return db_connection

def delete_o365_user_connection(db: Session, user_id: int) -> bool:
    """Delete O365 user connection"""
    db_connection = get_o365_user_connection(db, user_id)
    if not db_connection:
        return False
    
    db.delete(db_connection)
    db.commit()
    return True

# Google Workspace Organization Configuration CRUD operations
def get_google_org_config(db: Session, organization_id: int) -> Optional[GoogleOrganizationConfig]:
    """Get Google organization configuration"""
    return db.query(GoogleOrganizationConfig).filter(
        GoogleOrganizationConfig.organization_id == organization_id
    ).first()

def create_google_org_config(
    db: Session, 
    config: GoogleOrganizationConfigCreate, 
    organization_id: int
) -> GoogleOrganizationConfig:
    """Create Google organization configuration"""
    from google_encryption import encrypt_client_secret
    
    # Encrypt client secret if provided
    encrypted_secret = None
    if config.client_secret:
        encrypted_secret = encrypt_client_secret(config.client_secret)
    
    db_config = GoogleOrganizationConfig(
        organization_id=organization_id,
        client_id=config.client_id,
        client_secret_encrypted=encrypted_secret,
        project_id=config.project_id,
        gmail_sync_enabled=config.gmail_sync_enabled,
        calendar_sync_enabled=config.calendar_sync_enabled,
        contact_sync_enabled=config.contact_sync_enabled,
        drive_sync_enabled=config.drive_sync_enabled,
        is_configured=bool(config.client_id and encrypted_secret)
    )
    
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config

def update_google_org_config(
    db: Session,
    organization_id: int,
    config_update: GoogleOrganizationConfigUpdate
) -> Optional[GoogleOrganizationConfig]:
    """Update Google organization configuration"""
    from google_encryption import encrypt_client_secret
    
    db_config = get_google_org_config(db, organization_id)
    if not db_config:
        return None
    
    update_data = config_update.dict(exclude_unset=True)
    
    # Handle client secret encryption
    if "client_secret" in update_data and update_data["client_secret"]:
        update_data["client_secret_encrypted"] = encrypt_client_secret(update_data["client_secret"])
        del update_data["client_secret"]
    
    # Update fields
    for field, value in update_data.items():
        setattr(db_config, field, value)
    
    # Update is_configured status
    db_config.is_configured = bool(db_config.client_id and db_config.client_secret_encrypted)
    
    db.commit()
    db.refresh(db_config)
    return db_config

def delete_google_org_config(db: Session, organization_id: int) -> bool:
    """Delete Google organization configuration and all user connections"""
    db_config = get_google_org_config(db, organization_id)
    if not db_config:
        return False
    
    db.delete(db_config)
    db.commit()
    return True

# Google User Connection CRUD operations
def get_google_user_connection(db: Session, user_id: int) -> Optional[GoogleUserConnection]:
    """Get Google user connection"""
    return db.query(GoogleUserConnection).filter(
        GoogleUserConnection.user_id == user_id
    ).first()

def get_google_user_connections_by_org(db: Session, organization_id: int) -> List[GoogleUserConnection]:
    """Get all Google user connections for an organization"""
    return db.query(GoogleUserConnection).filter(
        GoogleUserConnection.organization_id == organization_id
    ).all()

def update_google_user_connection(
    db: Session,
    user_id: int,
    connection_update: GoogleUserConnectionUpdate
) -> Optional[GoogleUserConnection]:
    """Update Google user connection preferences"""
    db_connection = get_google_user_connection(db, user_id)
    if not db_connection:
        return None
    
    update_data = connection_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_connection, field, value)
    
    db.commit()
    db.refresh(db_connection)
    return db_connection

def delete_google_user_connection(db: Session, user_id: int) -> bool:
    """Delete Google user connection"""
    db_connection = get_google_user_connection(db, user_id)
    if not db_connection:
        return False
    
    db.delete(db_connection)
    db.commit()
    return True

def update_calendar_event(db: Session, event_id: int, event_update: CalendarEventUpdate, organization_id: int) -> Optional[CalendarEvent]:
    db_event = get_calendar_event(db, event_id, organization_id)
    if not db_event:
        return None
    
    update_data = event_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_event, field, value)
    
    db.commit()
    db.refresh(db_event)
    return db_event

def delete_calendar_event(db: Session, event_id: int, organization_id: int) -> bool:
    db_event = get_calendar_event(db, event_id, organization_id)
    if not db_event:
        return False
    
    db.delete(db_event)
    db.commit()
    return True

def get_upcoming_events(db: Session, organization_id: int, limit: int = 10) -> List[CalendarEvent]:
    """Get upcoming events for dashboard/daily summary"""
    current_time = datetime.utcnow()
    return db.query(CalendarEvent).filter(
        and_(
            CalendarEvent.organization_id == organization_id,
            CalendarEvent.start_time >= current_time,
            CalendarEvent.status == "scheduled"
        )
    ).order_by(CalendarEvent.start_time).limit(limit).all()

def get_today_events(db: Session, organization_id: int) -> List[CalendarEvent]:
    """Get today's events for daily summary"""
    from datetime import date
    today = date.today()
    start_of_day = datetime.combine(today, datetime.min.time())
    end_of_day = datetime.combine(today, datetime.max.time())
    
    return db.query(CalendarEvent).filter(
        and_(
            CalendarEvent.organization_id == organization_id,
            CalendarEvent.start_time >= start_of_day,
            CalendarEvent.start_time <= end_of_day,
            CalendarEvent.status == "scheduled"
        )
    ).order_by(CalendarEvent.start_time).all()

# Pipeline Stage CRUD operations
def create_pipeline_stage(db: Session, stage: PipelineStageCreate, organization_id: int) -> PipelineStage:
    db_stage = PipelineStage(**stage.dict(), organization_id=organization_id)
    db.add(db_stage)
    db.commit()
    db.refresh(db_stage)
    return db_stage

def get_pipeline_stages(db: Session, organization_id: int, include_inactive: bool = False) -> List[PipelineStage]:
    query = db.query(PipelineStage).filter(PipelineStage.organization_id == organization_id)
    
    if not include_inactive:
        query = query.filter(PipelineStage.is_active == True)
    
    return query.order_by(PipelineStage.position).all()

def get_pipeline_stage(db: Session, stage_id: int, organization_id: int) -> Optional[PipelineStage]:
    return db.query(PipelineStage).filter(
        PipelineStage.id == stage_id,
        PipelineStage.organization_id == organization_id
    ).first()

def update_pipeline_stage(db: Session, stage_id: int, stage_update: PipelineStageUpdate, organization_id: int) -> Optional[PipelineStage]:
    db_stage = get_pipeline_stage(db, stage_id, organization_id)
    if not db_stage:
        return None
    
    update_data = stage_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_stage, field, value)
    
    db.commit()
    db.refresh(db_stage)
    return db_stage

def delete_pipeline_stage(db: Session, stage_id: int, organization_id: int) -> bool:
    db_stage = get_pipeline_stage(db, stage_id, organization_id)
    if not db_stage:
        return False
    
    # Check if there are deals in this stage
    deal_count = db.query(Deal).filter(Deal.stage_id == stage_id).count()
    if deal_count > 0:
        # Don't delete, just deactivate
        db_stage.is_active = False
        db.commit()
    else:
        # Safe to delete
        db.delete(db_stage)
        db.commit()
    
    return True

def create_default_pipeline_stages(db: Session, organization_id: int) -> List[PipelineStage]:
    """Create default pipeline stages for new organizations"""
    default_stages = [
        {"name": "Lead", "description": "Initial contact or inquiry", "position": 0, "color": "#94A3B8"},
        {"name": "Qualified", "description": "Qualified as potential customer", "position": 1, "color": "#3B82F6"},
        {"name": "Proposal", "description": "Proposal or quote sent", "position": 2, "color": "#F59E0B"},
        {"name": "Negotiation", "description": "In negotiation phase", "position": 3, "color": "#EF4444"},
        {"name": "Closed Won", "description": "Deal successfully closed", "position": 4, "color": "#10B981", "is_closed_won": True},
        {"name": "Closed Lost", "description": "Deal lost or cancelled", "position": 5, "color": "#6B7280", "is_closed_lost": True},
    ]
    
    created_stages = []
    for stage_data in default_stages:
        stage = PipelineStage(**stage_data, organization_id=organization_id)
        db.add(stage)
        created_stages.append(stage)
    
    db.commit()
    for stage in created_stages:
        db.refresh(stage)
    
    return created_stages

# Deal CRUD operations
def create_deal(db: Session, deal: DealCreate, organization_id: int, created_by: int) -> Deal:
    db_deal = Deal(**deal.dict(), organization_id=organization_id, created_by=created_by)
    db.add(db_deal)
    db.commit()
    db.refresh(db_deal)
    
    # Create activity log
    create_activity(
        db,
        title="Deal Created",
        description=f"Created deal: {deal.title}",
        type="deal",
        entity_id=str(db_deal.id),
        organization_id=organization_id
    )
    
    return db_deal

def get_deals(
    db: Session,
    organization_id: int,
    skip: int = 0,
    limit: int = 100,
    stage_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    company_id: Optional[int] = None,
    assigned_to: Optional[int] = None,
    include_inactive: bool = False
) -> List[Deal]:
    query = db.query(Deal).filter(Deal.organization_id == organization_id)
    
    if not include_inactive:
        query = query.filter(Deal.is_active == True)
    
    if stage_id:
        query = query.filter(Deal.stage_id == stage_id)
    
    if contact_id:
        query = query.filter(Deal.contact_id == contact_id)
    
    if company_id:
        query = query.filter(Deal.company_id == company_id)
    
    if assigned_to:
        query = query.filter(Deal.assigned_to == assigned_to)
    
    return query.order_by(desc(Deal.created_at)).offset(skip).limit(limit).all()

def get_deal(db: Session, deal_id: int, organization_id: int) -> Optional[Deal]:
    return db.query(Deal).filter(
        Deal.id == deal_id,
        Deal.organization_id == organization_id
    ).first()

def update_deal(db: Session, deal_id: int, deal_update: DealUpdate, organization_id: int) -> Optional[Deal]:
    db_deal = get_deal(db, deal_id, organization_id)
    if not db_deal:
        return None
    
    update_data = deal_update.dict(exclude_unset=True)
    old_stage_id = db_deal.stage_id
    
    for field, value in update_data.items():
        setattr(db_deal, field, value)
    
    # If stage changed, log activity
    if "stage_id" in update_data and update_data["stage_id"] != old_stage_id:
        old_stage = get_pipeline_stage(db, old_stage_id, organization_id)
        new_stage = get_pipeline_stage(db, update_data["stage_id"], organization_id)
        
        if old_stage and new_stage:
            create_activity(
                db,
                title="Deal Stage Changed",
                description=f"Moved deal from '{old_stage.name}' to '{new_stage.name}'",
                type="deal",
                entity_id=str(db_deal.id),
                organization_id=organization_id
            )
    
    db.commit()
    db.refresh(db_deal)
    return db_deal

def delete_deal(db: Session, deal_id: int, organization_id: int) -> bool:
    db_deal = get_deal(db, deal_id, organization_id)
    if not db_deal:
        return False
    
    # Soft delete - mark as inactive
    db_deal.is_active = False
    db.commit()
    
    create_activity(
        db,
        title="Deal Deleted",
        description=f"Deleted deal: {db_deal.title}",
        type="deal",
        entity_id=str(db_deal.id),
        organization_id=organization_id
    )
    
    return True


# Project Stage CRUD operations
def create_project_stage(db: Session, stage: ProjectStageCreate, organization_id: int) -> ProjectStage:
    db_stage = ProjectStage(**stage.dict(), organization_id=organization_id)
    db.add(db_stage)
    db.commit()
    db.refresh(db_stage)
    return db_stage

def get_project_stages(db: Session, organization_id: int) -> List[ProjectStage]:
    return db.query(ProjectStage).filter(
        ProjectStage.organization_id == organization_id,
        ProjectStage.is_active == True
    ).order_by(ProjectStage.position).all()

def get_project_stage(db: Session, stage_id: int, organization_id: int) -> Optional[ProjectStage]:
    return db.query(ProjectStage).filter(
        ProjectStage.id == stage_id,
        ProjectStage.organization_id == organization_id
    ).first()

def update_project_stage(db: Session, stage_id: int, stage_update: ProjectStageUpdate, organization_id: int) -> Optional[ProjectStage]:
    db_stage = get_project_stage(db, stage_id, organization_id)
    if not db_stage:
        return None
    
    update_data = stage_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_stage, field, value)
    
    db.commit()
    db.refresh(db_stage)
    return db_stage

def delete_project_stage(db: Session, stage_id: int, organization_id: int) -> bool:
    db_stage = get_project_stage(db, stage_id, organization_id)
    if not db_stage:
        return False
    
    # Check if stage has projects
    project_count = db.query(Project).filter(Project.stage_id == stage_id).count()
    if project_count > 0:
        return False  # Cannot delete stage with projects
    
    db.delete(db_stage)
    db.commit()
    return True


# Project CRUD operations
def create_project(db: Session, project: ProjectCreate, organization_id: int, created_by: int) -> Project:
    project_data = project.dict()
    db_project = Project(**project_data, organization_id=organization_id, created_by=created_by)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    # Log activity
    create_activity(
        db,
        title="Project Created",
        description=f"Created new project: {db_project.title}",
        type="project",
        entity_id=str(db_project.id),
        organization_id=organization_id
    )
    
    return db_project

def get_projects(
    db: Session, 
    organization_id: int,
    skip: int = 0, 
    limit: int = 100,
    search: Optional[str] = None,
    stage_id: Optional[int] = None,
    company_id: Optional[int] = None,
    assigned_to: Optional[int] = None,
    project_type: Optional[str] = None,
    is_active: bool = True
) -> List[Project]:
    # Fix any NULL actual_hours for this organization
    db.execute(text("""
        UPDATE projects 
        SET actual_hours = COALESCE(actual_hours, 0.0)
        WHERE organization_id = :org_id 
        AND actual_hours IS NULL
    """), {"org_id": organization_id})
    
    db.commit()
    
    query = db.query(Project).options(
        joinedload(Project.stage),
        joinedload(Project.company),
        joinedload(Project.contact),
        joinedload(Project.creator)
    ).filter(
        Project.organization_id == organization_id,
        Project.is_active == is_active
    )
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Project.title.ilike(search_filter),
                Project.description.ilike(search_filter)
            )
        )
    
    if stage_id:
        query = query.filter(Project.stage_id == stage_id)
    
    if company_id:
        query = query.filter(Project.company_id == company_id)
    
    if project_type:
        query = query.filter(Project.project_type == project_type)
    
    if assigned_to:
        # Search in the JSON array of assigned team members
        query = query.filter(
            Project.assigned_team_members.op('?')(str(assigned_to))
        )
    
    return query.order_by(desc(Project.created_at)).offset(skip).limit(limit).all()

def get_project(db: Session, project_id: int, organization_id: int) -> Optional[Project]:
    return db.query(Project).options(
        joinedload(Project.stage),
        joinedload(Project.company),
        joinedload(Project.contact),
        joinedload(Project.creator)
    ).filter(
        Project.id == project_id,
        Project.organization_id == organization_id
    ).first()

def update_project(db: Session, project_id: int, project_update: ProjectUpdate, organization_id: int) -> Optional[Project]:
    db_project = get_project(db, project_id, organization_id)
    if not db_project:
        return None
    
    update_data = project_update.dict(exclude_unset=True)
    old_stage_id = db_project.stage_id
    
    for field, value in update_data.items():
        setattr(db_project, field, value)
    
    # If stage changed, log activity
    if "stage_id" in update_data and update_data["stage_id"] != old_stage_id:
        old_stage = get_project_stage(db, old_stage_id, organization_id)
        new_stage = get_project_stage(db, update_data["stage_id"], organization_id)
        
        if old_stage and new_stage:
            create_activity(
                db,
                title="Project Stage Changed",
                description=f"Moved project from '{old_stage.name}' to '{new_stage.name}'",
                type="project",
                entity_id=str(db_project.id),
                organization_id=organization_id
            )
    
    db.commit()
    db.refresh(db_project)
    return db_project

def delete_project(db: Session, project_id: int, organization_id: int) -> bool:
    db_project = get_project(db, project_id, organization_id)
    if not db_project:
        return False
    
    # Soft delete - mark as inactive
    db_project.is_active = False
    db.commit()
    
    create_activity(
        db,
        title="Project Deleted",
        description=f"Deleted project: {db_project.title}",
        type="project",
        entity_id=str(db_project.id),
        organization_id=organization_id
    )
    
    return True


# Project Type CRUD operations
def get_project_types(db: Session, organization_id: int, include_inactive: bool = False) -> List[ProjectType]:
    query = db.query(ProjectType).filter(
        ProjectType.organization_id == organization_id
    )
    
    if not include_inactive:
        query = query.filter(ProjectType.is_active == True)
    
    return query.order_by(ProjectType.display_order, ProjectType.name).all()

def get_project_type(db: Session, project_type_id: int, organization_id: int) -> ProjectType:
    return db.query(ProjectType).filter(
        ProjectType.id == project_type_id,
        ProjectType.organization_id == organization_id
    ).first()

def create_project_type(
    db: Session, 
    project_type: ProjectTypeCreate, 
    organization_id: int
) -> ProjectType:
    # Get the next display order
    max_order = db.query(func.max(ProjectType.display_order)).filter(
        ProjectType.organization_id == organization_id
    ).scalar() or 0
    
    # Convert to dict and handle display_order separately
    project_type_data = project_type.dict()
    if 'display_order' not in project_type_data or project_type_data['display_order'] <= 0:
        project_type_data['display_order'] = max_order + 1
    
    db_project_type = ProjectType(
        **project_type_data,
        organization_id=organization_id
    )
    
    db.add(db_project_type)
    db.commit()
    db.refresh(db_project_type)
    
    return db_project_type

def update_project_type(
    db: Session,
    project_type_id: int,
    project_type_update: ProjectTypeUpdate,
    organization_id: int
) -> Optional[ProjectType]:
    db_project_type = get_project_type(db, project_type_id, organization_id)
    if not db_project_type:
        return None
    
    for field, value in project_type_update.dict(exclude_unset=True).items():
        setattr(db_project_type, field, value)
    
    db.commit()
    db.refresh(db_project_type)
    
    return db_project_type

def delete_project_type(db: Session, project_type_id: int, organization_id: int) -> bool:
    db_project_type = get_project_type(db, project_type_id, organization_id)
    if not db_project_type:
        return False
    
    # Check if any projects are using this type
    projects_using_type = db.query(Project).filter(
        Project.organization_id == organization_id,
        Project.project_type == db_project_type.name,
        Project.is_active == True
    ).count()
    
    if projects_using_type > 0:
        # Soft delete if in use
        db_project_type.is_active = False
        db.commit()
    else:
        # Hard delete if not in use
        db.delete(db_project_type)
        db.commit()
    
    return True

def recalculate_all_contact_counts(db: Session, organization_id: int) -> dict:
    """Recalculate contact counts for all companies in an organization"""
    # Get all companies for the organization
    companies = db.query(Company).filter(Company.organization_id == organization_id).all()
    
    updated_count = 0
    for company in companies:
        # Count actual contacts for this company
        actual_count = db.query(Contact).filter(
            Contact.company_id == company.id,
            Contact.organization_id == organization_id
        ).count()
        
        # Update if different
        if company.contact_count != actual_count:
            company.contact_count = actual_count
            updated_count += 1
    
    db.commit()
    
    return {
        "companies_checked": len(companies),
        "companies_updated": updated_count
    }

def sync_contact_company_names(db: Session, organization_id: int) -> dict:
    """Sync company_name field for all contacts in an organization"""
    # Update contacts with company_id but missing or wrong company_name
    result = db.execute(text("""
        UPDATE contacts con
        SET company_name = c.name
        FROM companies c
        WHERE con.company_id = c.id
          AND con.organization_id = :org_id
          AND c.organization_id = :org_id
          AND (con.company_name IS NULL OR con.company_name != c.name)
    """), {"org_id": organization_id})
    
    contacts_updated = result.rowcount
    
    # Clear company_name for contacts with no company_id
    result = db.execute(text("""
        UPDATE contacts
        SET company_name = NULL
        WHERE company_id IS NULL
          AND company_name IS NOT NULL
          AND organization_id = :org_id
    """), {"org_id": organization_id})
    
    orphans_cleared = result.rowcount
    
    db.commit()
    
    return {
        "contacts_updated": contacts_updated,
        "orphans_cleared": orphans_cleared
    }