"""
AI Chat Service for interactive Q&A about CRM data
"""
import os
import json
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from openai import OpenAI
from models import Task, Contact, Company, Activity, User
from crud import get_tasks, get_contacts, get_companies, get_contact, get_company

# Configure OpenAI - try multiple environment variable names
openai_key = (
    os.environ.get("OPENAI_API_KEY") or 
    os.environ.get("OPENAI_KEY") or 
    os.environ.get("OPEN_AI_KEY") or
    os.environ.get("OPENAI")
)

# Initialize OpenAI client
openai_client = OpenAI(api_key=openai_key) if openai_key else None

class AIChatService:
    def __init__(self, db: Session, user_id: int, organization_id: int):
        self.db = db
        self.user_id = user_id
        self.organization_id = organization_id
    
    def process_chat_message(self, message: str, context: str = "general", summary_data: Optional[Dict] = None) -> str:
        """Process a chat message and return AI response with CRM context"""
        try:
            if not openai_client:
                return "Sorry, AI chat is currently unavailable. Please check with your administrator."
            
            # Get relevant CRM data based on the message
            crm_context = self._get_relevant_crm_data(message)
            
            # Build context-aware prompt
            prompt = self._build_chat_prompt(message, crm_context, summary_data)
            
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": """You are a helpful AI assistant for a CRM system. You have access to the user's tasks, contacts, and companies data. 

                        Answer questions about:
                        - Contact information (phone numbers, emails, companies)
                        - Task details and deadlines  
                        - Company information
                        - Schedule and priorities
                        - General CRM guidance

                        Keep responses concise and helpful. If you don't have the specific information requested, say so clearly.
                        When providing contact info, format it nicely. Always be professional but friendly."""
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
                temperature=0.3
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            print(f"AI Chat error: {e}")
            error_msg = str(e).lower()
            if "invalid_api_key" in error_msg or "401" in error_msg:
                return "Sorry, the AI chat service is not properly configured. Please contact your administrator to set up a valid OpenAI API key."
            elif "insufficient_quota" in error_msg or "429" in error_msg:
                return "Sorry, the AI service has reached its usage limit. Please try again later."
            elif "model" in error_msg:
                return "Sorry, there was an issue with the AI model configuration. Please contact support."
            else:
                return "Sorry, I couldn't process that request. Please try again."
    
    def _get_relevant_crm_data(self, message: str) -> Dict[str, Any]:
        """Extract relevant CRM data based on the user's message"""
        message_lower = message.lower()
        
        # Initialize data containers
        relevant_contacts = []
        relevant_companies = []
        relevant_tasks = []
        
        try:
            # Get all data for searching
            all_contacts = get_contacts(self.db, self.organization_id, limit=1000)
            all_companies = get_companies(self.db, self.organization_id, limit=1000) 
            all_tasks = get_tasks(self.db, self.organization_id, limit=1000)
            
            # Look for name mentions in the message
            for contact in all_contacts:
                first_name = contact.first_name.lower() if contact.first_name else ""
                last_name = contact.last_name.lower() if contact.last_name else ""
                full_name = f"{first_name} {last_name}".strip()
                
                if (first_name and first_name in message_lower) or \
                   (last_name and last_name in message_lower) or \
                   (full_name and full_name in message_lower):
                    relevant_contacts.append(contact)
            
            # Look for company mentions
            for company in all_companies:
                if company.name and company.name.lower() in message_lower:
                    relevant_companies.append(company)
            
            # If asking about tasks, get relevant ones
            if any(word in message_lower for word in ['task', 'todo', 'due', 'deadline', 'meeting', 'call']):
                # Get tasks for mentioned contacts or all recent tasks
                if relevant_contacts:
                    for contact in relevant_contacts:
                        contact_tasks = [t for t in all_tasks if t.contact_id == contact.id]
                        relevant_tasks.extend(contact_tasks)
                else:
                    # Get recent/urgent tasks
                    relevant_tasks = [t for t in all_tasks if t.status in ['pending', 'in_progress']][:10]
            
        except Exception as e:
            print(f"Error getting CRM data: {e}")
        
        return {
            "contacts": relevant_contacts[:5],  # Limit to prevent token overflow
            "companies": relevant_companies[:5],
            "tasks": relevant_tasks[:10]
        }
    
    def _build_chat_prompt(self, message: str, crm_data: Dict[str, Any], summary_data: Optional[Dict] = None) -> str:
        """Build a comprehensive prompt with CRM context"""
        
        prompt_parts = [f"User Question: {message}\n"]
        
        # Add relevant contact information
        if crm_data["contacts"]:
            prompt_parts.append("RELEVANT CONTACTS:")
            for contact in crm_data["contacts"]:
                contact_info = f"- {contact.first_name} {contact.last_name}"
                if contact.email:
                    contact_info += f" (Email: {contact.email})"
                if contact.phone:
                    contact_info += f" (Phone: {contact.phone})"
                if contact.title:
                    contact_info += f" (Title: {contact.title})"
                if contact.company_name:
                    contact_info += f" (Company: {contact.company_name})"
                prompt_parts.append(contact_info)
            prompt_parts.append("")
        
        # Add relevant company information
        if crm_data["companies"]:
            prompt_parts.append("RELEVANT COMPANIES:")
            for company in crm_data["companies"]:
                company_info = f"- {company.name}"
                if company.industry:
                    company_info += f" (Industry: {company.industry})"
                if company.website:
                    company_info += f" (Website: {company.website})"
                prompt_parts.append(company_info)
            prompt_parts.append("")
        
        # Add relevant task information
        if crm_data["tasks"]:
            prompt_parts.append("RELEVANT TASKS:")
            for task in crm_data["tasks"]:
                task_info = f"- {task.title}"
                if task.due_date:
                    task_info += f" (Due: {task.due_date})"
                if task.priority:
                    task_info += f" (Priority: {task.priority})"
                if task.status:
                    task_info += f" (Status: {task.status})"
                if task.contact_name:
                    task_info += f" (Contact: {task.contact_name})"
                prompt_parts.append(task_info)
            prompt_parts.append("")
        
        # Add summary context if available
        if summary_data:
            prompt_parts.append("DAILY SUMMARY CONTEXT:")
            if "quick_stats" in summary_data:
                stats = summary_data["quick_stats"]
                prompt_parts.append(f"- {stats.get('overdue_tasks', 0)} overdue tasks")
                prompt_parts.append(f"- {stats.get('today_tasks', 0)} tasks due today")
                prompt_parts.append(f"- {stats.get('contacts_needing_attention', 0)} contacts need attention")
            prompt_parts.append("")
        
        prompt_parts.append("Please provide a helpful, specific answer based on the available CRM data. If the requested information isn't available, let the user know clearly.")
        
        return "\n".join(prompt_parts)

def process_ai_chat(db: Session, user_id: int, organization_id: int, message: str, context: str = "general", summary_data: Optional[Dict] = None) -> str:
    """Main function to process AI chat messages"""
    service = AIChatService(db, user_id, organization_id)
    return service.process_chat_message(message, context, summary_data)