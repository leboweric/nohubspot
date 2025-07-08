"""
Office 365 Integration Service using Microsoft Graph API
"""
import os
import json
import asyncio
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import httpx
from sqlalchemy.orm import Session

from models import O365OrganizationConfig, O365UserConnection, EmailThread, EmailMessage, Contact
from o365_encryption import decrypt_client_secret, decrypt_access_token, decrypt_refresh_token, encrypt_access_token, encrypt_refresh_token
from schemas import EmailMessageCreate

# Microsoft OAuth2 endpoints
MICROSOFT_AUTHORITY = "https://login.microsoftonline.com"
MICROSOFT_GRAPH_API = "https://graph.microsoft.com/v1.0"
OAUTH_REDIRECT_URI = os.environ.get("O365_REDIRECT_URI", "https://nohubspot-production.up.railway.app/api/auth/o365/callback")

# O365 Configuration from environment
O365_CLIENT_ID = os.environ.get("O365_CLIENT_ID")
O365_TENANT_ID = os.environ.get("O365_TENANT_ID")
O365_CLIENT_SECRET = os.environ.get("O365_CLIENT_SECRET")

class O365Service:
    def __init__(self, user_connection: O365UserConnection, org_config: O365OrganizationConfig):
        self.user_connection = user_connection
        self.org_config = org_config
        self.access_token = None
        self.client = httpx.AsyncClient()
        
    async def __aenter__(self):
        await self.ensure_valid_token()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
        
    async def ensure_valid_token(self):
        """Ensure we have a valid access token, refreshing if necessary"""
        if self.user_connection.token_expires_at <= datetime.utcnow() + timedelta(minutes=5):
            await self.refresh_access_token()
        else:
            self.access_token = decrypt_access_token(self.user_connection.access_token_encrypted)
            
    async def refresh_access_token(self):
        """Refresh the access token using the refresh token"""
        refresh_token = decrypt_refresh_token(self.user_connection.refresh_token_encrypted)
        client_secret = decrypt_client_secret(self.org_config.client_secret_encrypted)
        
        token_url = f"{MICROSOFT_AUTHORITY}/{self.org_config.tenant_id}/oauth2/v2.0/token"
        
        data = {
            "client_id": self.org_config.client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
            "scope": " ".join(self.user_connection.scopes_granted or [])
        }
        
        response = await self.client.post(token_url, data=data)
        
        if response.status_code == 200:
            token_data = response.json()
            self.access_token = token_data["access_token"]
            
            # Update stored tokens
            self.user_connection.access_token_encrypted = encrypt_access_token(token_data["access_token"])
            if "refresh_token" in token_data:
                self.user_connection.refresh_token_encrypted = encrypt_refresh_token(token_data["refresh_token"])
            self.user_connection.token_expires_at = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))
            
            # Note: Caller is responsible for committing the session
            return True
        else:
            raise Exception(f"Failed to refresh token: {response.status_code} - {response.text}")
            
    def get_headers(self):
        """Get headers for Graph API requests"""
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
    async def get_user_info(self):
        """Get user information from Microsoft Graph"""
        response = await self.client.get(
            f"{MICROSOFT_GRAPH_API}/me",
            headers=self.get_headers()
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to get user info: {response.status_code}")
            
    async def list_messages(self, folder: str = "inbox", limit: int = 50, skip: int = 0, since: Optional[datetime] = None):
        """List messages from a specific folder"""
        url = f"{MICROSOFT_GRAPH_API}/me/mailFolders/{folder}/messages"
        
        params = {
            "$top": limit,
            "$skip": skip,
            "$orderby": "receivedDateTime desc",
            "$select": "id,subject,from,toRecipients,receivedDateTime,sentDateTime,body,isRead,conversationId"
        }
        
        if since:
            params["$filter"] = f"receivedDateTime ge {since.isoformat()}Z"
            
        response = await self.client.get(
            url,
            headers=self.get_headers(),
            params=params
        )
        
        if response.status_code == 200:
            return response.json().get("value", [])
        else:
            raise Exception(f"Failed to list messages: {response.status_code}")
            
    async def get_sent_messages(self, limit: int = 50, skip: int = 0, since: Optional[datetime] = None):
        """Get sent messages"""
        return await self.list_messages("sentitems", limit, skip, since)
        
    async def send_email(self, to_email: str, subject: str, body: str, save_to_sent: bool = True):
        """Send an email via Microsoft Graph"""
        message = {
            "subject": subject,
            "body": {
                "contentType": "HTML",
                "content": body
            },
            "toRecipients": [
                {
                    "emailAddress": {
                        "address": to_email
                    }
                }
            ]
        }
        
        url = f"{MICROSOFT_GRAPH_API}/me/sendMail"
        data = {
            "message": message,
            "saveToSentItems": save_to_sent
        }
        
        response = await self.client.post(
            url,
            headers=self.get_headers(),
            json=data
        )
        
        if response.status_code == 202:
            return True
        else:
            raise Exception(f"Failed to send email: {response.status_code} - {response.text}")
            
    async def sync_emails_to_crm(self, db: Session, organization_id: int, since: Optional[datetime] = None):
        """Sync emails from O365 to CRM"""
        if not since:
            since = self.user_connection.last_sync_at or datetime.utcnow() - timedelta(days=7)
            
        synced_count = 0
        
        try:
            # Sync inbox messages
            inbox_messages = await self.list_messages("inbox", limit=100, since=since)
            for msg in inbox_messages:
                await self._process_email_to_crm(db, msg, "incoming", organization_id)
                synced_count += 1
                
            # Sync sent messages
            sent_messages = await self.get_sent_messages(limit=100, since=since)
            for msg in sent_messages:
                await self._process_email_to_crm(db, msg, "outgoing", organization_id)
                synced_count += 1
                
            # Update sync status
            self.user_connection.last_sync_at = datetime.utcnow()
            self.user_connection.last_sync_success = True
            self.user_connection.last_error_message = None
            
            return synced_count
            
        except Exception as e:
            self.user_connection.last_sync_success = False
            self.user_connection.last_error_message = str(e)
            raise
            
    async def _process_email_to_crm(self, db: Session, msg: Dict[str, Any], direction: str, organization_id: int):
        """Process a single email and add to CRM"""
        # Extract email addresses
        if direction == "incoming":
            from_email = msg.get("from", {}).get("emailAddress", {}).get("address", "")
            contact_email = from_email
        else:
            # For outgoing, find the contact from recipients
            recipients = msg.get("toRecipients", [])
            if recipients:
                contact_email = recipients[0].get("emailAddress", {}).get("address", "")
            else:
                return  # Skip if no recipients
                
        # Find or create contact
        contact = db.query(Contact).filter(
            Contact.email == contact_email,
            Contact.organization_id == organization_id
        ).first()
        
        if not contact:
            # Create basic contact
            name_parts = msg.get("from", {}).get("emailAddress", {}).get("name", "").split()
            contact = Contact(
                first_name=name_parts[0] if name_parts else "Unknown",
                last_name=" ".join(name_parts[1:]) if len(name_parts) > 1 else "Contact",
                email=contact_email,
                organization_id=organization_id,
                status="Active"
            )
            db.add(contact)
            db.commit()
            db.refresh(contact)
            
        # Find or create thread
        subject = msg.get("subject", "No Subject")
        clean_subject = subject.replace("Re: ", "").replace("RE: ", "").strip()
        
        thread = db.query(EmailThread).filter(
            EmailThread.contact_id == contact.id,
            EmailThread.organization_id == organization_id
        ).filter(
            EmailThread.subject.ilike(f"%{clean_subject}%")
        ).first()
        
        if not thread:
            thread = EmailThread(
                subject=subject,
                contact_id=contact.id,
                organization_id=organization_id,
                message_count=0
            )
            db.add(thread)
            db.commit()
            db.refresh(thread)
            
        # Check if message already exists (by message ID)
        o365_message_id = msg.get("id")
        existing = db.query(EmailMessage).filter(
            EmailMessage.message_id == f"o365_{o365_message_id}"
        ).first()
        
        if not existing:
            # Add message to thread
            body_content = msg.get("body", {}).get("content", "")
            sender_name = msg.get("from", {}).get("emailAddress", {}).get("name", "Unknown")
            
            message = EmailMessage(
                thread_id=thread.id,
                sender=sender_name if direction == "incoming" else self.user_connection.o365_display_name,
                content=body_content,
                direction=direction,
                message_id=f"o365_{o365_message_id}"
            )
            db.add(message)
            
            # Update thread
            thread.message_count += 1
            thread.preview = body_content[:100] + ("..." if len(body_content) > 100 else "")
            thread.updated_at = datetime.utcnow()
            
            db.commit()


async def get_oauth_url(client_id: str, tenant_id: str, redirect_uri: str) -> str:
    """Generate OAuth2 authorization URL for Microsoft"""
    from urllib.parse import urlencode, quote
    
    scopes = [
        "User.Read",
        "Mail.Read",
        "Mail.ReadWrite", 
        "Mail.Send",
        "offline_access"
    ]
    
    params = {
        "client_id": client_id.strip(),
        "response_type": "code",
        "redirect_uri": redirect_uri.strip(),
        "response_mode": "query",
        "scope": " ".join(scopes),
        "state": "12345"  # Should be random in production
    }
    
    auth_url = f"{MICROSOFT_AUTHORITY}/{tenant_id.strip()}/oauth2/v2.0/authorize?{urlencode(params)}"
    
    return auth_url


async def exchange_code_for_tokens(
    code: str, 
    client_id: str, 
    client_secret: str, 
    tenant_id: str,
    redirect_uri: str
) -> Dict[str, Any]:
    """Exchange authorization code for access and refresh tokens"""
    token_url = f"{MICROSOFT_AUTHORITY}/{tenant_id}/oauth2/v2.0/token"
    
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=data)
        
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Failed to exchange code for tokens: {response.status_code} - {response.text}")