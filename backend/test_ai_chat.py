#!/usr/bin/env python3
"""Test AI chat functionality"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Test OpenAI setup
print("Testing AI Chat Configuration...")
print("-" * 50)

# Check OpenAI API key
openai_key = (
    os.environ.get("OPENAI_API_KEY") or 
    os.environ.get("OPENAI_KEY") or 
    os.environ.get("OPEN_AI_KEY") or
    os.environ.get("OPENAI")
)

if openai_key:
    print(f"✅ OpenAI API Key found: {openai_key[:10]}...")
else:
    print("❌ OpenAI API Key NOT FOUND")
    print("   Checked: OPENAI_API_KEY, OPENAI_KEY, OPEN_AI_KEY, OPENAI")

# Test OpenAI import and basic functionality
try:
    import openai
    print("✅ OpenAI library imported successfully")
    
    # Set the API key
    openai.api_key = openai_key
    
    if openai_key:
        # Try a simple completion to test the API key
        try:
            response = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a test assistant."},
                    {"role": "user", "content": "Say 'Hello, test successful!' in exactly 3 words."}
                ],
                max_tokens=10
            )
            print(f"✅ OpenAI API test successful: {response.choices[0].message.content.strip()}")
        except Exception as e:
            print(f"❌ OpenAI API test failed: {str(e)}")
            if "invalid_api_key" in str(e).lower():
                print("   The API key appears to be invalid or expired")
            elif "insufficient_quota" in str(e).lower():
                print("   The API key has insufficient quota")
    
except ImportError as e:
    print(f"❌ Failed to import OpenAI library: {e}")
    print("   Try: pip install openai")

print("\nDiagnostic Information:")
print(f"Python version: {sys.version}")
print(f"Working directory: {os.getcwd()}")
print(f".env file exists: {os.path.exists('.env')}")