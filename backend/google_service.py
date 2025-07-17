"""
Google Workspace Integration Service using Google APIs
"""
import os
import json
import asyncio
import re
import base64
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
import httpx
from sqlalchemy.orm import Session
from email.utils import parseaddr

from models import GoogleOrganizationConfig, GoogleUserConnection, EmailThread, EmailMessage, Contact
from google_encryption import decrypt_client_secret, decrypt_access_token, decrypt_refresh_token, encrypt_access_token, encrypt_refresh_token
from schemas import EmailMessageCreate

# Google OAuth2 endpoints
GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_API_BASE = "https://www.googleapis.com"
GMAIL_API = f"{GOOGLE_API_BASE}/gmail/v1"
CALENDAR_API = f"{GOOGLE_API_BASE}/calendar/v3"
PEOPLE_API = f"{GOOGLE_API_BASE}/people/v1"
OAUTH_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "https://nohubspot-production.up.railway.app/api/auth/google/callback")

# Google Configuration from environment
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")

# Required OAuth scopes
GOOGLE_SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/contacts.readonly",
]

class GoogleService:
    def __init__(self, user_connection: GoogleUserConnection, org_config: Optional[GoogleOrganizationConfig] = None):
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
        # Convert to timezone-naive for comparison if necessary
        token_expires = self.user_connection.token_expires_at
        if token_expires.tzinfo is not None:
            token_expires = token_expires.replace(tzinfo=None)
        
        if token_expires <= datetime.utcnow() + timedelta(minutes=5):
            await self.refresh_access_token()
        else:
            self.access_token = decrypt_access_token(self.user_connection.access_token_encrypted)
            
    async def refresh_access_token(self):
        """Refresh the access token using the refresh token"""
        refresh_token = decrypt_refresh_token(self.user_connection.refresh_token_encrypted)
        
        # Always use centralized OAuth credentials
        client_id = GOOGLE_CLIENT_ID
        client_secret = GOOGLE_CLIENT_SECRET
        
        if not client_id or not client_secret:
            raise Exception("Google OAuth credentials not configured")
        
        data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
        }
        
        response = await self.client.post(GOOGLE_OAUTH_TOKEN_URL, data=data)
        
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
        """Get headers for Google API requests"""
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        
    async def get_user_info(self):
        """Get user information from Google"""
        response = await self.client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers=self.get_headers()
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to get user info: {response.status_code}")
            
    async def list_messages(self, query: str = "", max_results: int = 100):
        """List Gmail messages with optional query"""
        params = {
            "maxResults": max_results,
            "q": query
        }
        
        response = await self.client.get(
            f"{GMAIL_API}/users/me/messages",
            headers=self.get_headers(),
            params=params
        )
        
        if response.status_code == 200:
            return response.json().get("messages", [])
        else:
            raise Exception(f"Failed to list messages: {response.status_code}")
            
    async def get_message(self, message_id: str):
        """Get a specific Gmail message"""
        response = await self.client.get(
            f"{GMAIL_API}/users/me/messages/{message_id}",
            headers=self.get_headers()
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to get message: {response.status_code}")
            
    async def send_message(self, to: str, subject: str, body: str, cc: List[str] = None, bcc: List[str] = None):
        """Send an email via Gmail"""
        # Create message in RFC 2822 format
        message_parts = [
            f"To: {to}",
            f"Subject: {subject}",
            f"From: {self.user_connection.google_email}"
        ]
        
        if cc:
            message_parts.append(f"Cc: {', '.join(cc)}")
        if bcc:
            message_parts.append(f"Bcc: {', '.join(bcc)}")
            
        message_parts.extend(["", body])
        message = "\r\n".join(message_parts)
        
        # Encode message
        import base64
        encoded_message = base64.urlsafe_b64encode(message.encode()).decode()
        
        response = await self.client.post(
            f"{GMAIL_API}/users/me/messages/send",
            headers=self.get_headers(),
            json={"raw": encoded_message}
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to send message: {response.status_code}")
            
    async def list_calendar_events(self, time_min: datetime = None, time_max: datetime = None, max_results: int = 100):
        """List calendar events"""
        if not time_min:
            time_min = datetime.utcnow()
        if not time_max:
            time_max = time_min + timedelta(days=30)
            
        params = {
            "timeMin": time_min.isoformat() + "Z",
            "timeMax": time_max.isoformat() + "Z",
            "maxResults": max_results,
            "singleEvents": True,
            "orderBy": "startTime"
        }
        
        response = await self.client.get(
            f"{CALENDAR_API}/calendars/primary/events",
            headers=self.get_headers(),
            params=params
        )
        
        if response.status_code == 200:
            return response.json().get("items", [])
        else:
            raise Exception(f"Failed to list calendar events: {response.status_code}")
            
    async def get_contacts(self, page_size: int = 100):
        """Get contacts from Google People API"""
        params = {
            "pageSize": page_size,
            "personFields": "names,emailAddresses,phoneNumbers,organizations,addresses"
        }
        
        response = await self.client.get(
            f"{PEOPLE_API}/people/me/connections",
            headers=self.get_headers(),
            params=params
        )
        
        if response.status_code == 200:
            return response.json().get("connections", [])
        else:
            raise Exception(f"Failed to get contacts: {response.status_code}")
            
    async def sync_gmail_messages(self, db: Session, since_date: datetime = None):
        """Sync Gmail messages to the CRM"""
        if not since_date:
            since_date = self.user_connection.last_gmail_sync or datetime.utcnow() - timedelta(days=7)
            
        # Build query based on privacy settings
        query_parts = [f"after:{since_date.strftime('%Y/%m/%d')}"]
        
        if self.user_connection.sync_only_crm_contacts:
            # This would need to be implemented with actual contact emails
            pass
            
        # Exclude domains
        for domain in self.user_connection.excluded_email_domains or []:
            query_parts.append(f"-from:*@{domain} -to:*@{domain}")
            
        # Exclude keywords
        for keyword in self.user_connection.excluded_email_keywords or []:
            query_parts.append(f'-"{keyword}"')
            
        query = " ".join(query_parts)
        
        try:
            messages = await self.list_messages(query=query, max_results=50)
            
            for msg_ref in messages:
                msg = await self.get_message(msg_ref["id"])
                await self._process_gmail_message(db, msg)
                
            # Update last sync time
            self.user_connection.last_gmail_sync = datetime.utcnow()
            
        except Exception as e:
            self.user_connection.sync_error_count += 1
            self.user_connection.last_sync_error = str(e)
            raise
            
    async def _process_gmail_message(self, db: Session, gmail_message: Dict[str, Any]):
        """Process a Gmail message and save it to the CRM"""
        # Extract message details
        headers = {h["name"]: h["value"] for h in gmail_message["payload"].get("headers", [])}
        
        # Parse email addresses
        from_email = parseaddr(headers.get("From", ""))[1]
        to_emails = [parseaddr(addr.strip())[1] for addr in headers.get("To", "").split(",")]
        
        # Extract body
        body = self._extract_body_from_gmail(gmail_message["payload"])
        
        # Check if we should sync this message
        if not self._should_sync_message(from_email, to_emails):
            return
            
        # Find or create thread
        thread_id = headers.get("Message-ID", gmail_message["id"])
        in_reply_to = headers.get("In-Reply-To")
        
        # Create email message
        email_data = EmailMessageCreate(
            sender_email=from_email,
            recipient_emails=to_emails,
            subject=headers.get("Subject", ""),
            body=body,
            thread_id=thread_id,
            in_reply_to=in_reply_to,
            message_id=gmail_message["id"],
            sent_at=datetime.fromtimestamp(int(gmail_message["internalDate"]) / 1000),
            source="gmail",
            direction="inbound" if from_email != self.user_connection.google_email else "outbound"
        )
        
        # Save to database (implementation would go here)
        # This would involve finding/creating contacts, threads, etc.
        
    def _extract_body_from_gmail(self, payload: Dict[str, Any]) -> str:
        """Extract body from Gmail message payload"""
        body = ""
        
        if "parts" in payload:
            for part in payload["parts"]:
                if part["mimeType"] == "text/plain":
                    data = part["body"]["data"]
                    body = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                    break
        elif payload.get("body", {}).get("data"):
            body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="ignore")
            
        return body
        
    def _should_sync_message(self, from_email: str, to_emails: List[str]) -> bool:
        """Check if message should be synced based on privacy settings"""
        all_emails = [from_email] + to_emails
        
        # Check excluded domains
        for email in all_emails:
            domain = email.split("@")[-1] if "@" in email else ""
            if domain in (self.user_connection.excluded_email_domains or []):
                return False
                
        # If sync_only_crm_contacts is enabled, would need to check if any email is in CRM
        # This would require database lookup
        
        return True

# Utility functions for OAuth flow
def get_google_auth_url(redirect_uri: str, state: str) -> str:
    """Generate Google OAuth authorization URL using centralized credentials"""
    if not GOOGLE_CLIENT_ID:
        raise Exception("Google OAuth client ID not configured")
        
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(GOOGLE_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state
    }
    
    from urllib.parse import urlencode
    return f"{GOOGLE_OAUTH_AUTHORIZE_URL}?{urlencode(params)}"

async def exchange_code_for_tokens(code: str, redirect_uri: str) -> Dict[str, Any]:
    """Exchange authorization code for access and refresh tokens using centralized credentials"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise Exception("Google OAuth credentials not configured")
        
    data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(GOOGLE_OAUTH_TOKEN_URL, data=data)
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to exchange code: {response.status_code} - {response.text}")