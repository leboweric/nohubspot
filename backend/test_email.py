#!/usr/bin/env python3
"""
Test script to verify SendGrid email configuration
"""
import os
import asyncio
from email_service import send_welcome_email

async def test_email_config():
    """Test if SendGrid is properly configured"""
    print("Testing SendGrid configuration...")
    
    # Check environment variables
    api_key = os.environ.get("SENDGRID_API_KEY", "")
    from_email = os.environ.get("SENDGRID_FROM_EMAIL", "noreply@nothubspot.app")
    from_name = os.environ.get("SENDGRID_FROM_NAME", "NotHubSpot")
    
    print(f"SENDGRID_API_KEY: {'✓ Set' if api_key else '✗ Not set'}")
    print(f"SENDGRID_FROM_EMAIL: {from_email}")
    print(f"SENDGRID_FROM_NAME: {from_name}")
    
    if not api_key:
        print("\n⚠️  SENDGRID_API_KEY is not set!")
        print("This is why welcome emails are not being sent.")
        return False
    
    # Test email send
    test_email = "test@example.com"  # Replace with your email to test
    print(f"\nTesting email send to {test_email}...")
    
    try:
        result = await send_welcome_email(
            user_email=test_email,
            first_name="Test User", 
            organization_name="Test Organization"
        )
        
        if result:
            print("✓ Email sent successfully!")
            return True
        else:
            print("✗ Email send failed")
            return False
            
    except Exception as e:
        print(f"✗ Email send error: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(test_email_config())