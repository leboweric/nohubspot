from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
from typing import List, Optional
from datetime import datetime

from models import (
    Company, Contact, EmailThread, EmailMessage, 
    Task, Attachment, Activity, EmailSignature
)
from schemas import (
    CompanyCreate, CompanyUpdate, ContactCreate, ContactUpdate,
    TaskCreate, TaskUpdate, EmailThreadCreate, EmailMessageCreate,
    AttachmentCreate, ActivityCreate, EmailSignatureCreate, EmailSignatureUpdate,
    DashboardStats
)

# Company CRUD operations
def create_company(db: Session, company: CompanyCreate, tenant_id: int) -> Company:
    db_company = Company(**company.dict(), tenant_id=tenant_id)
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    return db_company

def get_companies(
    db: Session, 
    tenant_id: int,
    skip: int = 0, 
    limit: int = 100, 
    search: Optional[str] = None,
    status: Optional[str] = None
) -> List[Company]:
    query = db.query(Company).filter(Company.tenant_id == tenant_id)
    
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
    
    return query.order_by(desc(Company.created_at)).offset(skip).limit(limit).all()

def get_company(db: Session, company_id: int, tenant_id: int) -> Optional[Company]:
    return db.query(Company).filter(
        Company.id == company_id,
        Company.tenant_id == tenant_id
    ).first()

def update_company(db: Session, company_id: int, company_update: CompanyUpdate, tenant_id: int) -> Optional[Company]:
    db_company = get_company(db, company_id, tenant_id)
    if not db_company:
        return None
    
    update_data = company_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_company, field, value)
    
    db.commit()
    db.refresh(db_company)
    return db_company

def delete_company(db: Session, company_id: int, tenant_id: int) -> bool:
    db_company = get_company(db, company_id, tenant_id)
    if not db_company:
        return False
    
    db.delete(db_company)
    db.commit()
    return True

# Contact CRUD operations
def create_contact(db: Session, contact: ContactCreate, tenant_id: int) -> Contact:
    db_contact = Contact(**contact.dict(), tenant_id=tenant_id)
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    
    # Update company contact count if company_id is provided
    if db_contact.company_id:
        company = get_company(db, db_contact.company_id, tenant_id)
        if company:
            company.contact_count += 1
            db.commit()
    
    return db_contact

def get_contacts(
    db: Session,
    tenant_id: int,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    company_id: Optional[int] = None,
    status: Optional[str] = None
) -> List[Contact]:
    query = db.query(Contact).filter(Contact.tenant_id == tenant_id)
    
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
    
    return query.order_by(desc(Contact.last_activity)).offset(skip).limit(limit).all()

def get_contact(db: Session, contact_id: int, tenant_id: int) -> Optional[Contact]:
    return db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.tenant_id == tenant_id
    ).first()

def update_contact(db: Session, contact_id: int, contact_update: ContactUpdate, tenant_id: int) -> Optional[Contact]:
    db_contact = get_contact(db, contact_id, tenant_id)
    if not db_contact:
        return None
    
    # Store old company_id for contact count updates
    old_company_id = db_contact.company_id
    
    update_data = contact_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_contact, field, value)
    
    db_contact.last_activity = datetime.utcnow()
    db.commit()
    
    # Update company contact counts if company changed
    new_company_id = db_contact.company_id
    if old_company_id != new_company_id:
        if old_company_id:
            old_company = get_company(db, old_company_id, tenant_id)
            if old_company and old_company.contact_count > 0:
                old_company.contact_count -= 1
        
        if new_company_id:
            new_company = get_company(db, new_company_id, tenant_id)
            if new_company:
                new_company.contact_count += 1
        
        db.commit()
    
    db.refresh(db_contact)
    return db_contact

def delete_contact(db: Session, contact_id: int, tenant_id: int) -> bool:
    db_contact = get_contact(db, contact_id, tenant_id)
    if not db_contact:
        return False
    
    # Update company contact count
    if db_contact.company_id:
        company = get_company(db, db_contact.company_id, tenant_id)
        if company and company.contact_count > 0:
            company.contact_count -= 1
    
    db.delete(db_contact)
    db.commit()
    return True

# Task CRUD operations
def create_task(db: Session, task: TaskCreate, tenant_id: int) -> Task:
    db_task = Task(**task.dict(), tenant_id=tenant_id)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def get_tasks(
    db: Session,
    tenant_id: int,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    contact_id: Optional[int] = None,
    company_id: Optional[int] = None
) -> List[Task]:
    query = db.query(Task).filter(Task.tenant_id == tenant_id)
    
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

def get_task(db: Session, task_id: int, tenant_id: int) -> Optional[Task]:
    return db.query(Task).filter(
        Task.id == task_id,
        Task.tenant_id == tenant_id
    ).first()

def update_task(db: Session, task_id: int, task_update: TaskUpdate, tenant_id: int) -> Optional[Task]:
    db_task = get_task(db, task_id, tenant_id)
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

def delete_task(db: Session, task_id: int, tenant_id: int) -> bool:
    db_task = get_task(db, task_id, tenant_id)
    if not db_task:
        return False
    
    db.delete(db_task)
    db.commit()
    return True

# Email Thread CRUD operations
def create_email_thread(db: Session, thread: EmailThreadCreate, tenant_id: int) -> EmailThread:
    db_thread = EmailThread(**thread.dict(), tenant_id=tenant_id)
    db.add(db_thread)
    db.commit()
    db.refresh(db_thread)
    return db_thread

def get_email_threads(
    db: Session,
    tenant_id: int,
    skip: int = 0,
    limit: int = 100,
    contact_id: Optional[int] = None
) -> List[EmailThread]:
    query = db.query(EmailThread).filter(EmailThread.tenant_id == tenant_id)
    
    if contact_id:
        query = query.filter(EmailThread.contact_id == contact_id)
    
    return query.order_by(desc(EmailThread.updated_at)).offset(skip).limit(limit).all()

def add_email_message(db: Session, message: EmailMessageCreate, tenant_id: int) -> EmailMessage:
    db_message = EmailMessage(**message.dict(), tenant_id=tenant_id)
    db.add(db_message)
    
    # Update thread message count and preview - ensure thread belongs to same tenant
    thread = db.query(EmailThread).filter(
        EmailThread.id == message.thread_id,
        EmailThread.tenant_id == tenant_id
    ).first()
    if thread:
        thread.message_count += 1
        thread.preview = message.content[:100] + ("..." if len(message.content) > 100 else "")
        thread.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_message)
    return db_message

# Attachment CRUD operations
def create_attachment(db: Session, attachment: AttachmentCreate, tenant_id: int) -> Attachment:
    db_attachment = Attachment(**attachment.dict(), tenant_id=tenant_id)
    db.add(db_attachment)
    db.commit()
    
    # Update company attachment count
    if db_attachment.company_id:
        company = get_company(db, db_attachment.company_id, tenant_id)
        if company:
            company.attachment_count += 1
            db.commit()
    
    db.refresh(db_attachment)
    return db_attachment

def get_attachments(
    db: Session,
    tenant_id: int,
    skip: int = 0,
    limit: int = 100,
    company_id: Optional[int] = None
) -> List[Attachment]:
    query = db.query(Attachment).filter(Attachment.tenant_id == tenant_id)
    
    if company_id:
        query = query.filter(Attachment.company_id == company_id)
    
    return query.order_by(desc(Attachment.created_at)).offset(skip).limit(limit).all()

# Activity CRUD operations
def create_activity(
    db: Session,
    title: str,
    description: str,
    type: str,
    tenant_id: int,
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
    db_activity = Activity(**activity_data.dict(), tenant_id=tenant_id)
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    return db_activity

def get_recent_activities(db: Session, tenant_id: int, limit: int = 10) -> List[Activity]:
    return db.query(Activity).filter(Activity.tenant_id == tenant_id).order_by(desc(Activity.created_at)).limit(limit).all()

# Email Signature CRUD operations
def get_email_signature(db: Session, tenant_id: int, user_id: str = "default") -> Optional[EmailSignature]:
    return db.query(EmailSignature).filter(
        EmailSignature.user_id == user_id,
        EmailSignature.tenant_id == tenant_id
    ).first()

def create_or_update_email_signature(
    db: Session, 
    signature_data: EmailSignatureCreate, 
    tenant_id: int,
    user_id: str = "default"
) -> EmailSignature:
    existing_signature = get_email_signature(db, tenant_id, user_id)
    
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
        db_signature = EmailSignature(**signature_data.dict(), user_id=user_id, tenant_id=tenant_id)
        db.add(db_signature)
        db.commit()
        db.refresh(db_signature)
        return db_signature

# Bulk operations
def bulk_create_companies(db: Session, companies: List[CompanyCreate], tenant_id: int) -> List[Company]:
    db_companies = []
    for company_data in companies:
        db_company = Company(**company_data.dict(), tenant_id=tenant_id)
        db.add(db_company)
        db_companies.append(db_company)
    
    db.commit()
    for company in db_companies:
        db.refresh(company)
    
    return db_companies

def bulk_create_contacts(db: Session, contacts: List[ContactCreate], tenant_id: int) -> List[Contact]:
    db_contacts = []
    for contact_data in contacts:
        db_contact = Contact(**contact_data.dict(), tenant_id=tenant_id)
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
        company = get_company(db, company_id, tenant_id)
        if company:
            company.contact_count += count
    
    if company_counts:
        db.commit()
    
    return db_contacts

# Dashboard statistics
def get_dashboard_stats(db: Session, tenant_id: int) -> DashboardStats:
    total_companies = db.query(Company).filter(Company.tenant_id == tenant_id).count()
    total_contacts = db.query(Contact).filter(Contact.tenant_id == tenant_id).count()
    total_tasks = db.query(Task).filter(Task.tenant_id == tenant_id).count()
    total_email_threads = db.query(EmailThread).filter(EmailThread.tenant_id == tenant_id).count()
    
    active_companies = db.query(Company).filter(
        Company.tenant_id == tenant_id,
        Company.status == "Active"
    ).count()
    active_contacts = db.query(Contact).filter(
        Contact.tenant_id == tenant_id,
        Contact.status == "Active"
    ).count()
    pending_tasks = db.query(Task).filter(
        Task.tenant_id == tenant_id,
        Task.status == "pending"
    ).count()
    
    # Count overdue tasks
    current_time = datetime.utcnow()
    overdue_tasks = db.query(Task).filter(
        and_(
            Task.tenant_id == tenant_id,
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