"""
AI Service for generating daily summaries and insights
"""
import os
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
import openai
from models import Task, Contact, Company, Activity, User
from crud import get_tasks, get_contacts, get_companies

# Configure OpenAI
openai.api_key = os.environ.get("OPENAI_API_KEY")

class DailySummaryService:
    def __init__(self, db: Session, user_id: int, organization_id: int):
        self.db = db
        self.user_id = user_id
        self.organization_id = organization_id
    
    def generate_daily_summary(self) -> Dict[str, Any]:
        """Generate a comprehensive daily summary for the user"""
        try:
            # Collect data from last 24-48 hours
            data = self._collect_summary_data()
            
            # Generate AI insights
            ai_summary = self._generate_ai_insights(data)
            
            # Combine with structured data
            summary = {
                "generated_at": datetime.now().isoformat(),
                "user_id": self.user_id,
                "data_summary": data,
                "ai_insights": ai_summary,
                "quick_stats": self._generate_quick_stats(data),
                "recommendations": self._extract_recommendations(ai_summary)
            }
            
            return summary
            
        except Exception as e:
            print(f"Error generating daily summary: {e}")
            return self._fallback_summary()
    
    def _collect_summary_data(self) -> Dict[str, Any]:
        """Collect relevant data for the summary"""
        now = datetime.now()
        yesterday = now - timedelta(days=1)
        week_ago = now - timedelta(days=7)
        
        # Get tasks
        all_tasks = get_tasks(self.db, self.organization_id, limit=1000)
        
        # Categorize tasks
        overdue_tasks = [t for t in all_tasks if t.due_date and 
                        datetime.fromisoformat(t.due_date.replace('Z', '+00:00')).replace(tzinfo=None) < now and 
                        t.status != 'completed']
        
        today_tasks = [t for t in all_tasks if t.due_date and 
                      datetime.fromisoformat(t.due_date.replace('Z', '+00:00')).replace(tzinfo=None).date() == now.date()]
        
        pending_tasks = [t for t in all_tasks if t.status in ['pending', 'in_progress']]
        
        # Get recent activities (if available)
        recent_activities = []
        try:
            recent_activities = self.db.query(Activity).filter(
                Activity.created_at >= yesterday
            ).order_by(desc(Activity.created_at)).limit(20).all()
        except:
            pass  # Activities table might not exist yet
        
        # Get contacts that need attention
        all_contacts = get_contacts(self.db, self.organization_id, limit=1000)
        
        # Find contacts with recent activity or tasks
        contacts_with_tasks = []
        for contact in all_contacts:
            contact_tasks = [t for t in all_tasks if t.contact_id == contact.id]
            if contact_tasks:
                contacts_with_tasks.append({
                    "contact": contact,
                    "tasks": contact_tasks,
                    "overdue_tasks": [t for t in contact_tasks if t in overdue_tasks]
                })
        
        # Get companies data
        all_companies = get_companies(self.db, self.organization_id, limit=1000)
        
        return {
            "tasks": {
                "total": len(all_tasks),
                "overdue": overdue_tasks,
                "today": today_tasks,
                "pending": pending_tasks
            },
            "contacts": {
                "total": len(all_contacts),
                "with_tasks": contacts_with_tasks
            },
            "companies": {
                "total": len(all_companies),
                "active": [c for c in all_companies if c.status == 'active']
            },
            "activities": recent_activities,
            "time_range": {
                "from": yesterday.isoformat(),
                "to": now.isoformat()
            }
        }
    
    def _generate_ai_insights(self, data: Dict[str, Any]) -> str:
        """Use OpenAI to generate insights from the collected data"""
        if not openai.api_key:
            return "AI insights unavailable - OpenAI API key not configured"
        
        try:
            # Prepare data for AI
            prompt = self._build_summary_prompt(data)
            
            response = openai.chat.completions.create(
                model="gpt-4o-mini",  # Using the efficient model
                messages=[
                    {
                        "role": "system", 
                        "content": """You are an AI assistant for a CRM system helping sales representatives. 
                        Generate a concise, actionable daily summary focusing on priorities, opportunities, and recommendations.
                        Keep it professional but friendly. Use emojis sparingly and only for section headers.
                        Focus on what the rep should do TODAY."""
                    },
                    {"role": "user", "content": prompt}
                ],
                max_tokens=800,
                temperature=0.7
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            print(f"OpenAI API error: {e}")
            return f"AI insights temporarily unavailable. Error: {str(e)}"
    
    def _build_summary_prompt(self, data: Dict[str, Any]) -> str:
        """Build the prompt for OpenAI"""
        overdue_count = len(data["tasks"]["overdue"])
        today_count = len(data["tasks"]["today"])
        pending_count = len(data["tasks"]["pending"])
        contacts_with_tasks = len(data["contacts"]["with_tasks"])
        
        # Build overdue task details
        overdue_details = []
        for task in data["tasks"]["overdue"][:5]:  # Limit to top 5
            overdue_details.append(f"- {task.title} (due: {task.due_date}, priority: {task.priority})")
        
        # Build today's task details
        today_details = []
        for task in data["tasks"]["today"][:5]:
            today_details.append(f"- {task.title} (priority: {task.priority})")
        
        # Build contact insights
        contact_details = []
        for item in data["contacts"]["with_tasks"][:3]:
            contact = item["contact"]
            overdue = len(item["overdue_tasks"])
            total_tasks = len(item["tasks"])
            if overdue > 0:
                contact_details.append(f"- {contact.first_name} {contact.last_name} at {contact.company_name or 'Unknown Company'} ({overdue} overdue, {total_tasks} total tasks)")
        
        prompt = f"""
        Generate a daily summary for a sales representative based on this CRM data:

        TASKS OVERVIEW:
        - {overdue_count} overdue tasks
        - {today_count} tasks due today  
        - {pending_count} total pending tasks

        OVERDUE TASKS (urgent):
        {chr(10).join(overdue_details) if overdue_details else "None"}

        TODAY'S TASKS:
        {chr(10).join(today_details) if today_details else "None"}

        CONTACTS NEEDING ATTENTION:
        {chr(10).join(contact_details) if contact_details else "No contacts with overdue tasks"}

        COMPANIES: {data["companies"]["total"]} total, {len(data["companies"]["active"])} active

        Please generate a concise daily summary with:
        1. A friendly greeting
        2. Top 3 priorities for today
        3. Key insights or patterns you notice
        4. 2-3 specific recommendations
        5. A motivational closing

        Keep it under 300 words and actionable.
        """
        
        return prompt
    
    def _generate_quick_stats(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate quick statistics for the summary card"""
        return {
            "overdue_tasks": len(data["tasks"]["overdue"]),
            "today_tasks": len(data["tasks"]["today"]), 
            "total_contacts": data["contacts"]["total"],
            "contacts_needing_attention": len([c for c in data["contacts"]["with_tasks"] if c["overdue_tasks"]]),
            "active_companies": len(data["companies"]["active"])
        }
    
    def _extract_recommendations(self, ai_summary: str) -> List[str]:
        """Extract actionable recommendations from AI summary"""
        # Simple extraction - look for numbered or bulleted items
        lines = ai_summary.split('\n')
        recommendations = []
        
        for line in lines:
            line = line.strip()
            if any(line.startswith(prefix) for prefix in ['1.', '2.', '3.', '•', '-', '*']):
                # Clean up the recommendation
                clean_rec = line.lstrip('123456789.-•* ').strip()
                if len(clean_rec) > 10:  # Ignore very short items
                    recommendations.append(clean_rec)
        
        return recommendations[:3]  # Limit to top 3
    
    def _fallback_summary(self) -> Dict[str, Any]:
        """Fallback summary when AI is unavailable"""
        return {
            "generated_at": datetime.now().isoformat(),
            "user_id": self.user_id,
            "ai_insights": "Welcome back! Your daily summary is being prepared. Please check your tasks and contacts for today's priorities.",
            "quick_stats": {
                "overdue_tasks": 0,
                "today_tasks": 0,
                "total_contacts": 0,
                "contacts_needing_attention": 0,
                "active_companies": 0
            },
            "recommendations": [
                "Review your task list and prioritize urgent items",
                "Check for any overdue follow-ups with contacts",
                "Update your pipeline and contact information"
            ]
        }

def generate_daily_summary(db: Session, user_id: int, organization_id: int) -> Dict[str, Any]:
    """Main function to generate daily summary"""
    service = DailySummaryService(db, user_id, organization_id)
    return service.generate_daily_summary()