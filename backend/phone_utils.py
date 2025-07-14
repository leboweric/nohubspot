"""
Phone number formatting utilities
"""
import re
from typing import Optional


def format_phone_number(phone: Optional[str]) -> Optional[str]:
    """
    Format phone number to standard format: (XXX) XXX-XXXX
    Handles various input formats and extensions
    
    Examples:
    - 1234567890 -> (123) 456-7890
    - 123-456-7890 -> (123) 456-7890
    - (123) 456-7890 -> (123) 456-7890
    - 123.456.7890 -> (123) 456-7890
    - +1 123 456 7890 -> (123) 456-7890
    - 1234567890 ext 123 -> (123) 456-7890 ext 123
    """
    if not phone:
        return None
    
    # Convert to string and strip whitespace
    phone_str = str(phone).strip()
    
    if not phone_str:
        return None
    
    # Extract extension if present
    extension = ""
    ext_patterns = [
        r'\s*ext\.?\s*(\d+)',
        r'\s*x\.?\s*(\d+)',
        r'\s*extension\s*(\d+)'
    ]
    
    for pattern in ext_patterns:
        match = re.search(pattern, phone_str, re.IGNORECASE)
        if match:
            extension = f" ext {match.group(1)}"
            phone_str = phone_str[:match.start()]
            break
    
    # Remove all non-numeric characters
    digits = re.sub(r'\D', '', phone_str)
    
    # Handle different lengths
    if len(digits) == 10:
        # Standard 10-digit US phone number
        formatted = f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    elif len(digits) == 11 and digits[0] == '1':
        # US number with country code
        formatted = f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
    elif len(digits) == 7:
        # Local number without area code
        formatted = f"{digits[:3]}-{digits[3:]}"
    else:
        # Return original if we can't format it
        return phone
    
    return formatted + extension


def format_international_phone(phone: Optional[str], country_code: str = "US") -> Optional[str]:
    """
    Format phone number with international support
    Currently only supports US formatting, but can be extended
    """
    if country_code == "US":
        return format_phone_number(phone)
    
    # For non-US numbers, just clean up spacing
    if not phone:
        return None
    
    phone_str = str(phone).strip()
    return phone_str if phone_str else None