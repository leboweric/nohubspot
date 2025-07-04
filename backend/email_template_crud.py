"""
CRUD operations for Email Templates
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from datetime import datetime
import re

from models import EmailTemplate, User
from schemas import EmailTemplateCreate, EmailTemplateUpdate

# Variable detection regex pattern
VARIABLE_PATTERN = r'\{\{([^}]+)\}\}'

def extract_variables(text: str) -> List[str]:
    """Extract template variables from text like {{contact.first_name}}"""
    return list(set(re.findall(VARIABLE_PATTERN, text)))

def get_email_templates(
    db: Session,
    organization_id: int,
    user_id: int,
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    search: Optional[str] = None,
    include_personal: bool = True
) -> List[EmailTemplate]:
    """Get email templates for an organization"""
    query = db.query(EmailTemplate).filter(
        EmailTemplate.organization_id == organization_id
    )
    
    # Filter by sharing - include shared templates and user's personal templates
    if include_personal:
        query = query.filter(
            or_(
                EmailTemplate.is_shared == True,
                EmailTemplate.created_by == user_id
            )
        )
    else:
        query = query.filter(EmailTemplate.is_shared == True)
    
    if category:
        query = query.filter(EmailTemplate.category == category)
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                EmailTemplate.name.ilike(search_filter),
                EmailTemplate.subject.ilike(search_filter),
                EmailTemplate.body.ilike(search_filter),
                EmailTemplate.category.ilike(search_filter)
            )
        )
    
    return query.order_by(EmailTemplate.name).offset(skip).limit(limit).all()

def get_email_template(
    db: Session,
    template_id: int,
    organization_id: int,
    user_id: int
) -> Optional[EmailTemplate]:
    """Get a specific email template"""
    return db.query(EmailTemplate).filter(
        and_(
            EmailTemplate.id == template_id,
            EmailTemplate.organization_id == organization_id,
            or_(
                EmailTemplate.is_shared == True,
                EmailTemplate.created_by == user_id
            )
        )
    ).first()

def create_email_template(
    db: Session,
    template: EmailTemplateCreate,
    organization_id: int,
    user_id: int
) -> EmailTemplate:
    """Create a new email template"""
    # Extract variables from subject and body
    variables_in_subject = extract_variables(template.subject)
    variables_in_body = extract_variables(template.body)
    all_variables = list(set(variables_in_subject + variables_in_body))
    
    db_template = EmailTemplate(
        organization_id=organization_id,
        created_by=user_id,
        name=template.name,
        subject=template.subject,
        body=template.body,
        category=template.category,
        is_shared=template.is_shared,
        variables_used=all_variables if all_variables else None
    )
    
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template

def update_email_template(
    db: Session,
    template_id: int,
    template_update: EmailTemplateUpdate,
    organization_id: int,
    user_id: int
) -> Optional[EmailTemplate]:
    """Update an email template"""
    db_template = get_email_template(db, template_id, organization_id, user_id)
    if not db_template:
        return None
    
    # Check if user can edit this template
    if not db_template.is_shared and db_template.created_by != user_id:
        return None
    
    update_data = template_update.dict(exclude_unset=True)
    
    # If subject or body is being updated, recalculate variables
    if 'subject' in update_data or 'body' in update_data:
        new_subject = update_data.get('subject', db_template.subject)
        new_body = update_data.get('body', db_template.body)
        
        variables_in_subject = extract_variables(new_subject)
        variables_in_body = extract_variables(new_body)
        all_variables = list(set(variables_in_subject + variables_in_body))
        
        update_data['variables_used'] = all_variables if all_variables else None
    
    for field, value in update_data.items():
        setattr(db_template, field, value)
    
    db.commit()
    db.refresh(db_template)
    return db_template

def delete_email_template(
    db: Session,
    template_id: int,
    organization_id: int,
    user_id: int
) -> bool:
    """Delete an email template"""
    db_template = get_email_template(db, template_id, organization_id, user_id)
    if not db_template:
        return False
    
    # Check if user can delete this template
    if not db_template.is_shared and db_template.created_by != user_id:
        return False
    
    db.delete(db_template)
    db.commit()
    return True

def increment_template_usage(
    db: Session,
    template_id: int,
    organization_id: int,
    user_id: int
) -> bool:
    """Increment usage count and update last used timestamp"""
    db_template = get_email_template(db, template_id, organization_id, user_id)
    if not db_template:
        return False
    
    db_template.usage_count += 1
    db_template.last_used_at = datetime.utcnow()
    db.commit()
    return True

def get_template_categories(db: Session, organization_id: int) -> List[str]:
    """Get all categories used in templates for an organization"""
    categories = db.query(EmailTemplate.category).filter(
        and_(
            EmailTemplate.organization_id == organization_id,
            EmailTemplate.category.isnot(None),
            EmailTemplate.category != ""
        )
    ).distinct().all()
    
    return [cat[0] for cat in categories if cat[0]]

def replace_template_variables(
    template_text: str,
    contact_data: Optional[dict] = None,
    company_data: Optional[dict] = None,
    user_data: Optional[dict] = None
) -> str:
    """Replace template variables with actual data"""
    result = template_text
    
    # Replace contact variables
    if contact_data:
        for key, value in contact_data.items():
            pattern = f"{{{{contact.{key}}}}}"
            result = result.replace(pattern, str(value) if value else "")
    
    # Replace company variables
    if company_data:
        for key, value in company_data.items():
            pattern = f"{{{{company.{key}}}}}"
            result = result.replace(pattern, str(value) if value else "")
    
    # Replace user variables
    if user_data:
        for key, value in user_data.items():
            pattern = f"{{{{user.{key}}}}}"
            result = result.replace(pattern, str(value) if value else "")
    
    # Replace system variables
    result = result.replace("{{date}}", datetime.now().strftime("%B %d, %Y"))
    result = result.replace("{{time}}", datetime.now().strftime("%I:%M %p"))
    
    return result