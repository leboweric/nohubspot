# Backend Scripts

This directory contains utility scripts for backend operations.

## Phone Number Standardization

### Script: `standardize_phone_numbers.py`

This script standardizes all phone numbers in the database to the format: (XXX) XXX-XXXX

### Usage

**Dry Run (preview changes without updating):**
```bash
cd backend
python scripts/standardize_phone_numbers.py --dry-run
```

**Execute standardization:**
```bash
cd backend
python scripts/standardize_phone_numbers.py
```

### Automatic Scheduling

The phone number standardization runs automatically every night at 2:00 AM via the APScheduler background task system.

### Manual Trigger via API

Authenticated users can trigger phone standardization manually:

**Preview changes:**
```
POST /api/admin/standardize-phone-numbers?dry_run=true
```

**Execute standardization:**
```
POST /api/admin/standardize-phone-numbers
```

### What it does

The script:
1. Processes all phone numbers in Companies, Contacts, and Email Signatures
2. Formats US phone numbers to (XXX) XXX-XXXX format
3. Preserves extensions (e.g., "ext 123")
4. Leaves international numbers unchanged if they can't be formatted
5. Creates detailed logs of all changes

### Logs

Logs are saved to `phone_standardization_YYYYMMDD_HHMMSS.log` in the backend directory.