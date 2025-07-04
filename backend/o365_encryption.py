"""
Encryption utilities for Office 365 sensitive data
"""
import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from typing import Optional

def get_encryption_key() -> bytes:
    """Generate or retrieve encryption key for O365 data"""
    # Use a combination of app secret and environment variable for key derivation
    secret_key = os.environ.get("SECRET_KEY", "your-secret-key-here")
    salt = os.environ.get("O365_ENCRYPTION_SALT", "nohubspot-o365-salt").encode()
    
    # Derive a consistent key from the secret
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(secret_key.encode()))
    return key

def encrypt_sensitive_data(data: str) -> str:
    """Encrypt sensitive O365 data (client secrets, tokens)"""
    if not data:
        return ""
    
    key = get_encryption_key()
    f = Fernet(key)
    encrypted_data = f.encrypt(data.encode())
    return base64.urlsafe_b64encode(encrypted_data).decode()

def decrypt_sensitive_data(encrypted_data: str) -> Optional[str]:
    """Decrypt sensitive O365 data"""
    if not encrypted_data:
        return None
    
    try:
        key = get_encryption_key()
        f = Fernet(key)
        decoded_data = base64.urlsafe_b64decode(encrypted_data.encode())
        decrypted_data = f.decrypt(decoded_data)
        return decrypted_data.decode()
    except Exception as e:
        print(f"Failed to decrypt data: {e}")
        return None

def encrypt_client_secret(client_secret: str) -> str:
    """Encrypt client secret for storage"""
    return encrypt_sensitive_data(client_secret)

def decrypt_client_secret(encrypted_secret: str) -> Optional[str]:
    """Decrypt client secret from storage"""
    return decrypt_sensitive_data(encrypted_secret)

def encrypt_access_token(access_token: str) -> str:
    """Encrypt access token for storage"""
    return encrypt_sensitive_data(access_token)

def decrypt_access_token(encrypted_token: str) -> Optional[str]:
    """Decrypt access token from storage"""
    return decrypt_sensitive_data(encrypted_token)

def encrypt_refresh_token(refresh_token: str) -> str:
    """Encrypt refresh token for storage"""
    return encrypt_sensitive_data(refresh_token)

def decrypt_refresh_token(encrypted_token: str) -> Optional[str]:
    """Decrypt refresh token from storage"""
    return decrypt_sensitive_data(encrypted_token)