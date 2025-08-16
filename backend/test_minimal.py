#!/usr/bin/env python3
"""
Minimal test to isolate the startup problem
"""
import os

print("=" * 60)
print("MINIMAL BACKEND TEST")
print("=" * 60)

# Set the DATABASE_URL that Railway uses
os.environ['DATABASE_URL'] = 'postgresql://postgres:KXGPGFkLkkicZQoOVyixcuNNVtOlJvSo@postgres.railway.internal:5432/railway'

print("\n1. Testing database.py import...")
try:
    from database import engine, SessionLocal
    print("   ✅ database.py imported successfully")
    print(f"   Engine created: {engine}")
except Exception as e:
    print(f"   ❌ Failed to import database.py: {e}")
    exit(1)

print("\n2. Testing database connection...")
try:
    db = SessionLocal()
    db.execute("SELECT 1")
    db.close()
    print("   ✅ Database connection works!")
except Exception as e:
    print(f"   ❌ Database connection failed: {e}")
    print("   This would cause health check to fail")

print("\n3. Testing if main.py module-level code runs...")
print("   Lines 196-301 in main.py run at import time")
print("   This includes migrate_tenant_to_organization()")
print("   If this fails, the entire service won't start")

# The real issue
print("\n4. THE PROBLEM:")
print("   - main.py line 198 calls migrate_tenant_to_organization(engine)")
print("   - This runs at MODULE IMPORT time (not in a function)")
print("   - If postgres.railway.internal is slow/hanging, import hangs")
print("   - Railway times out waiting for the service to start")
print("   - Health check never even gets a chance to run")