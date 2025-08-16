#!/usr/bin/env python3
"""
Test what happens when backend starts with/without database
"""
import os
import sys

print("=" * 60)
print("TESTING BACKEND STARTUP SEQUENCE")
print("=" * 60)

# Simulate Railway environment
os.environ['DATABASE_URL'] = 'postgresql://postgres:KXGPGFkLkkicZQoOVyixcuNNVtOlJvSo@postgres.railway.internal:5432/railway'
os.environ['PORT'] = '8080'

print("\n1. Environment variables set:")
print(f"   DATABASE_URL: {os.environ.get('DATABASE_URL')[:50]}...")
print(f"   PORT: {os.environ.get('PORT')}")

print("\n2. Attempting to import backend/main.py...")
print("   This will trigger module-level code execution")
print()

# Try to import main.py
sys.path.insert(0, 'backend')
try:
    import main
    print("\n✅ SUCCESS: main.py imported successfully!")
    print("   The service would start normally")
except Exception as e:
    print(f"\n❌ FAILED: Could not import main.py")
    print(f"   Error: {e}")
    print("\n   This is why the service fails to start on Railway!")
    print("   The health check fails because the Python process never starts")