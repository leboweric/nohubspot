"""
Lead Source Integration Routes
Handles Clay, Surfe, and LinkedIn Sales Navigator webhooks and settings.

Endpoints:
  GET    /api/lead-source/settings              - Get org integration config
  PUT    /api/lead-source/settings              - Update integration toggles / Surfe API key
  POST   /api/lead-source/generate-key/{source} - Generate a new inbound API key (clay | linkedin)
  POST   /api/webhooks/clay/import              - Clay HTTP API action webhook (Bearer key auth)
  POST   /api/webhooks/surfe/enrichment         - Surfe enrichment-completed webhook (HMAC auth)
  POST   /api/webhooks/linkedin/import          - LinkedIn Sales Navigator webhook (Bearer key auth)
  GET    /api/lead-source/logs                  - Recent import audit log
"""

import secrets
import hmac
import hashlib
import logging
import json
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request, Header, status
from sqlalchemy.orm import Session

from database import get_db
from models import (
    LeadSourceIntegration, LeadImportLog,
    Contact, Company, Organization, User
)
from schemas import (
    LeadSourceIntegrationResponse, LeadSourceIntegrationUpdate,
    GenerateApiKeyResponse,
    ClayWebhookPayload, ClayPersonPayload,
    SurfeWebhookPayload, SurfeEnrichedPerson,
    LinkedInWebhookPayload, LinkedInPersonPayload,
    LeadImportLogResponse,
    ContactCreate, CompanyCreate,
)
from auth import get_current_active_user, get_current_admin_user
from crud import create_contact, create_company, get_companies, get_contacts

logger = logging.getLogger(__name__)

router = APIRouter()


# ─────────────────────────────────────────────
# Helper: get or create the org's integration row
# ─────────────────────────────────────────────

def _get_or_create_integration(db: Session, organization_id: int) -> LeadSourceIntegration:
    row = db.query(LeadSourceIntegration).filter(
        LeadSourceIntegration.organization_id == organization_id
    ).first()
    if not row:
        row = LeadSourceIntegration(organization_id=organization_id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


# ─────────────────────────────────────────────
# Helper: upsert Company by name / domain
# ─────────────────────────────────────────────

def _upsert_company(db: Session, org_id: int, name: str,
                    website: Optional[str] = None,
                    industry: Optional[str] = None,
                    city: Optional[str] = None,
                    state: Optional[str] = None) -> Optional[Company]:
    if not name:
        return None
    existing = db.query(Company).filter(
        Company.organization_id == org_id,
        Company.name == name
    ).first()
    if existing:
        return existing
    company_data = CompanyCreate(
        name=name,
        website=website,
        industry=industry,
        city=city,
        state=state,
        status="Lead"
    )
    return create_company(db, company_data, org_id)


# ─────────────────────────────────────────────
# Helper: upsert Contact by email or name+company
# ─────────────────────────────────────────────

def _upsert_contact(db: Session, org_id: int,
                    first_name: str, last_name: str,
                    email: Optional[str] = None,
                    phone: Optional[str] = None,
                    title: Optional[str] = None,
                    company_id: Optional[int] = None,
                    company_name: Optional[str] = None,
                    notes: Optional[str] = None) -> tuple:
    """Returns (contact, action) where action is 'created' | 'updated' | 'skipped'."""
    # Try to find by email first (most reliable dedup key)
    if email:
        existing = db.query(Contact).filter(
            Contact.organization_id == org_id,
            Contact.email == email
        ).first()
        if existing:
            # Enrich missing fields on existing contact
            changed = False
            if not existing.phone and phone:
                existing.phone = phone
                changed = True
            if not existing.title and title:
                existing.title = title
                changed = True
            if not existing.company_id and company_id:
                existing.company_id = company_id
                existing.company_name = company_name
                changed = True
            if changed:
                db.commit()
                db.refresh(existing)
            return existing, "updated"

    # Fallback: find by name + company
    query = db.query(Contact).filter(
        Contact.organization_id == org_id,
        Contact.first_name == first_name,
        Contact.last_name == last_name,
    )
    if company_name:
        query = query.filter(Contact.company_name == company_name)
    existing = query.first()
    if existing:
        return existing, "skipped"

    # Create new contact
    contact_data = ContactCreate(
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=phone,
        title=title,
        company_id=company_id,
        company_name=company_name,
        status="Lead",
        notes=notes,
    )
    new_contact = create_contact(db, contact_data, org_id)
    return new_contact, "created"


# ─────────────────────────────────────────────
# Helper: log an import event
# ─────────────────────────────────────────────

def _log_import(db: Session, org_id: int, source: str,
                event_type: Optional[str], raw_payload: dict,
                contact_id: Optional[int], company_id: Optional[int],
                action: str, error: Optional[str] = None):
    log = LeadImportLog(
        organization_id=org_id,
        source=source,
        event_type=event_type,
        raw_payload=raw_payload,
        contact_id=contact_id,
        company_id=company_id,
        action=action,
        error_message=error,
    )
    db.add(log)
    db.commit()


# ─────────────────────────────────────────────
# Helper: resolve org from inbound API key
# ─────────────────────────────────────────────

def _get_org_from_clay_key(db: Session, api_key: str) -> LeadSourceIntegration:
    row = db.query(LeadSourceIntegration).filter(
        LeadSourceIntegration.clay_api_key == api_key,
        LeadSourceIntegration.clay_enabled == True
    ).first()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid or disabled Clay API key")
    return row


def _get_org_from_linkedin_key(db: Session, api_key: str) -> LeadSourceIntegration:
    row = db.query(LeadSourceIntegration).filter(
        LeadSourceIntegration.linkedin_webhook_api_key == api_key,
        LeadSourceIntegration.linkedin_enabled == True
    ).first()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid or disabled LinkedIn API key")
    return row


# ═══════════════════════════════════════════════════════════════
# SETTINGS ENDPOINTS (JWT-authenticated, admin/owner only)
# ═══════════════════════════════════════════════════════════════

@router.get("/api/lead-source/settings", response_model=LeadSourceIntegrationResponse)
async def get_lead_source_settings(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Return the current org's lead source integration configuration."""
    row = _get_or_create_integration(db, current_user.organization_id)
    return row


@router.put("/api/lead-source/settings", response_model=LeadSourceIntegrationResponse)
async def update_lead_source_settings(
    payload: LeadSourceIntegrationUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update integration toggles and/or store the Surfe API key."""
    row = _get_or_create_integration(db, current_user.organization_id)

    if payload.clay_enabled is not None:
        row.clay_enabled = payload.clay_enabled
    if payload.surfe_enabled is not None:
        row.surfe_enabled = payload.surfe_enabled
    if payload.surfe_api_key is not None:
        # Store the Surfe API key (encrypt in production using o365_encryption pattern)
        row.surfe_api_key_encrypted = payload.surfe_api_key
    if payload.linkedin_enabled is not None:
        row.linkedin_enabled = payload.linkedin_enabled

    db.commit()
    db.refresh(row)
    return row


@router.post("/api/lead-source/generate-key/{source}", response_model=GenerateApiKeyResponse)
async def generate_api_key(
    source: str,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Generate (or regenerate) the inbound API key for Clay or LinkedIn.
    The key is shown once — the user must copy it into Clay / Zapier.
    """
    if source not in ("clay", "linkedin"):
        raise HTTPException(status_code=400, detail="source must be 'clay' or 'linkedin'")

    row = _get_or_create_integration(db, current_user.organization_id)
    new_key = f"nhs_{source}_{secrets.token_urlsafe(32)}"

    base_url = str(request.base_url).rstrip("/")

    if source == "clay":
        row.clay_api_key = new_key
        row.clay_enabled = True
        webhook_url = f"{base_url}/api/webhooks/clay/import"
    else:
        row.linkedin_webhook_api_key = new_key
        row.linkedin_enabled = True
        webhook_url = f"{base_url}/api/webhooks/linkedin/import"

    db.commit()

    return GenerateApiKeyResponse(
        source=source,
        api_key=new_key,
        webhook_url=webhook_url,
    )


@router.get("/api/lead-source/logs", response_model=List[LeadImportLogResponse])
async def get_import_logs(
    limit: int = 50,
    source: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Return recent lead import audit logs for the current org."""
    query = db.query(LeadImportLog).filter(
        LeadImportLog.organization_id == current_user.organization_id
    )
    if source:
        query = query.filter(LeadImportLog.source == source)
    logs = query.order_by(LeadImportLog.created_at.desc()).limit(limit).all()
    return logs


# ═══════════════════════════════════════════════════════════════
# CLAY WEBHOOK  POST /api/webhooks/clay/import
# ═══════════════════════════════════════════════════════════════

@router.post("/api/webhooks/clay/import")
async def clay_import_webhook(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Receives enriched leads pushed from Clay via the HTTP API action.

    Authentication: Bearer token in Authorization header.
    The token is the clay_api_key generated in /api/lead-source/generate-key/clay.

    Clay HTTP API action configuration:
      Method: POST
      URL: https://<your-domain>/api/webhooks/clay/import
      Headers: Authorization: Bearer <your_clay_api_key>
      Body: { "person": { ... } }   or   { "people": [ {...}, ... ] }
    """
    # --- Auth ---
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    api_key = authorization.removeprefix("Bearer ").strip()
    integration = _get_org_from_clay_key(db, api_key)
    org_id = integration.organization_id

    # --- Parse body ---
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    # Normalise to a list of person dicts
    people_raw: List[dict] = []
    if "people" in body and isinstance(body["people"], list):
        people_raw = body["people"]
    elif "person" in body and isinstance(body["person"], dict):
        people_raw = [body["person"]]
    else:
        # Treat the whole body as a single person (Clay sometimes sends flat rows)
        people_raw = [body]

    created_count = 0
    updated_count = 0

    for raw in people_raw:
        try:
            p = ClayPersonPayload(**raw)

            # Resolve name
            first = (p.first_name or "").strip()
            last = (p.last_name or "").strip()
            if not first and not last:
                _log_import(db, org_id, "clay", "import", raw, None, None, "skipped",
                            "No name provided")
                continue

            # Upsert company
            company = _upsert_company(
                db, org_id,
                name=p.company_name or "",
                website=p.company_website or p.company_domain,
                industry=p.company_industry,
                city=p.company_city,
                state=p.company_state,
            )

            # Upsert contact
            contact, action = _upsert_contact(
                db, org_id,
                first_name=first or "Unknown",
                last_name=last or "Lead",
                email=p.email,
                phone=p.phone,
                title=p.title,
                company_id=company.id if company else None,
                company_name=p.company_name,
                notes=f"Imported from Clay. LinkedIn: {p.linkedin_url}" if p.linkedin_url else "Imported from Clay",
            )

            _log_import(db, org_id, "clay", "import", raw,
                        contact.id, company.id if company else None, action)

            if action == "created":
                created_count += 1
            elif action == "updated":
                updated_count += 1

        except Exception as e:
            logger.error(f"Clay import error for row: {e}")
            _log_import(db, org_id, "clay", "import", raw, None, None, "error", str(e))

    # Update stats
    integration.clay_last_import_at = datetime.utcnow()
    integration.clay_total_imported += created_count
    db.commit()

    return {
        "status": "ok",
        "created": created_count,
        "updated": updated_count,
        "total_received": len(people_raw),
    }


# ═══════════════════════════════════════════════════════════════
# SURFE WEBHOOK  POST /api/webhooks/surfe/enrichment
# ═══════════════════════════════════════════════════════════════

@router.post("/api/webhooks/surfe/enrichment")
async def surfe_enrichment_webhook(
    request: Request,
    x_surfe_signature: Optional[str] = Header(None, alias="X-Surfe-Signature"),
    db: Session = Depends(get_db)
):
    """
    Receives enrichment-completed events from Surfe's API.

    Surfe sends a POST with event type 'person.enrichment.completed' or
    'person.batch-enrichment.completed'.

    The externalID field in the Surfe request MUST be set to the NHS contact ID
    (as a string) so we can match and update the right record.

    Webhook URL to configure in Surfe enrichment requests:
      https://<your-domain>/api/webhooks/surfe/enrichment

    Authentication: HMAC-SHA256 signature in X-Surfe-Signature header.
    The HMAC secret is stored in lead_source_integrations.surfe_webhook_secret.
    If no secret is configured, the endpoint accepts all requests (dev mode).
    """
    raw_body = await request.body()

    # --- Parse body ---
    try:
        body = json.loads(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    event_type = body.get("eventType", "")
    data = body.get("data", {})

    # For batch-completed events, we just acknowledge — the caller should
    # use the enrichmentCallbackURL to fetch individual results.
    if event_type == "person.batch-enrichment.completed":
        return {"status": "ok", "message": "Batch enrichment noted; fetch results via enrichmentCallbackURL"}

    if event_type != "person.enrichment.completed":
        return {"status": "ok", "message": f"Unhandled event type: {event_type}"}

    person_data = data.get("person", {})
    external_id = person_data.get("externalID")  # Should be NHS contact ID

    # --- Find the org via externalID (contact lookup) ---
    contact = None
    org_id = None

    if external_id:
        try:
            contact_id = int(external_id)
            contact = db.query(Contact).filter(Contact.id == contact_id).first()
            if contact:
                org_id = contact.organization_id
        except (ValueError, TypeError):
            pass

    if not org_id:
        # Can't route without an org — log and return 200 to prevent Surfe retries
        logger.warning(f"Surfe webhook: could not resolve org from externalID={external_id}")
        return {"status": "ok", "message": "Could not resolve organization from externalID"}

    # --- Validate HMAC signature if secret is configured ---
    integration = _get_or_create_integration(db, org_id)
    if integration.surfe_webhook_secret and x_surfe_signature:
        expected = hmac.new(
            integration.surfe_webhook_secret.encode(),
            raw_body,
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, x_surfe_signature):
            raise HTTPException(status_code=401, detail="Invalid Surfe webhook signature")

    # --- Enrich the contact ---
    action = "skipped"
    try:
        p = SurfeEnrichedPerson(**person_data)
        changed = False

        if contact:
            # Update email if we got a valid one and contact doesn't have one
            if p.emails and not contact.email:
                valid_emails = [e.email for e in p.emails if e.validationStatus == "VALID" and e.email]
                if valid_emails:
                    contact.email = valid_emails[0]
                    changed = True

            # Update phone if missing
            if p.mobilePhones and not contact.phone:
                best_phone = sorted(p.mobilePhones, key=lambda x: x.confidenceScore or 0, reverse=True)
                if best_phone and best_phone[0].mobilePhone:
                    contact.phone = best_phone[0].mobilePhone
                    changed = True

            # Update title if missing
            if p.jobTitle and not contact.title:
                contact.title = p.jobTitle
                changed = True

            if changed:
                db.commit()
                db.refresh(contact)
                action = "updated"

        _log_import(db, org_id, "surfe", event_type, body,
                    contact.id if contact else None, None, action)

        integration.surfe_last_enrichment_at = datetime.utcnow()
        if action == "updated":
            integration.surfe_total_enriched += 1
        db.commit()

    except Exception as e:
        logger.error(f"Surfe enrichment error: {e}")
        _log_import(db, org_id, "surfe", event_type, body, None, None, "error", str(e))

    return {"status": "ok", "action": action}


# ═══════════════════════════════════════════════════════════════
# LINKEDIN SALES NAVIGATOR WEBHOOK  POST /api/webhooks/linkedin/import
# ═══════════════════════════════════════════════════════════════

@router.post("/api/webhooks/linkedin/import")
async def linkedin_import_webhook(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Receives LinkedIn Sales Navigator profile data pushed via:
      - A browser extension (e.g. custom Tampermonkey script)
      - Zapier / Make / n8n automation
      - LinkedIn Sales Navigator CSV export processed by Clay

    Authentication: Bearer token in Authorization header.
    The token is the linkedin_webhook_api_key generated in
    /api/lead-source/generate-key/linkedin.

    Expected body:
      { "person": { ... } }   or   { "people": [ {...}, ... ] }

    Field mapping supports both LinkedIn Sales Navigator export column names
    and the normalised NHS schema.
    """
    # --- Auth ---
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    api_key = authorization.removeprefix("Bearer ").strip()
    integration = _get_org_from_linkedin_key(db, api_key)
    org_id = integration.organization_id

    # --- Parse body ---
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    # Normalise to list
    people_raw: List[dict] = []
    if "people" in body and isinstance(body["people"], list):
        people_raw = body["people"]
    elif "person" in body and isinstance(body["person"], dict):
        people_raw = [body["person"]]
    else:
        people_raw = [body]

    created_count = 0
    updated_count = 0

    for raw in people_raw:
        try:
            p = LinkedInPersonPayload(**raw)

            # Resolve name — handle "Full Name" field from Sales Nav exports
            first = (p.first_name or "").strip()
            last = (p.last_name or "").strip()
            if not first and not last and p.full_name:
                parts = p.full_name.strip().split(" ", 1)
                first = parts[0]
                last = parts[1] if len(parts) > 1 else ""

            if not first and not last:
                _log_import(db, org_id, "linkedin", "import", raw, None, None, "skipped",
                            "No name provided")
                continue

            # Build notes from LinkedIn-specific fields
            notes_parts = []
            if p.headline:
                notes_parts.append(f"Headline: {p.headline}")
            if p.linkedin_url:
                notes_parts.append(f"LinkedIn: {p.linkedin_url}")
            if p.location:
                notes_parts.append(f"Location: {p.location}")
            if p.company_size:
                notes_parts.append(f"Company size: {p.company_size}")
            notes = "Imported from LinkedIn Sales Navigator. " + " | ".join(notes_parts) if notes_parts else "Imported from LinkedIn Sales Navigator"

            # Upsert company
            company = _upsert_company(
                db, org_id,
                name=p.company_name or "",
                website=p.company_website,
                industry=p.company_industry,
            )

            # Upsert contact
            contact, action = _upsert_contact(
                db, org_id,
                first_name=first or "Unknown",
                last_name=last or "Lead",
                email=p.email,
                phone=p.phone,
                title=p.title,
                company_id=company.id if company else None,
                company_name=p.company_name,
                notes=notes,
            )

            _log_import(db, org_id, "linkedin", "import", raw,
                        contact.id, company.id if company else None, action)

            if action == "created":
                created_count += 1
            elif action == "updated":
                updated_count += 1

        except Exception as e:
            logger.error(f"LinkedIn import error for row: {e}")
            _log_import(db, org_id, "linkedin", "import", raw, None, None, "error", str(e))

    # Update stats
    integration.linkedin_last_import_at = datetime.utcnow()
    integration.linkedin_total_imported += created_count
    db.commit()

    return {
        "status": "ok",
        "created": created_count,
        "updated": updated_count,
        "total_received": len(people_raw),
    }
