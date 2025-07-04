/**
 * Phone number formatting utilities
 */

/**
 * Formats a phone number to standard US format: (555) 123-4567
 * Accepts various input formats and extracts digits
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return ''
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  
  // Handle different digit lengths
  if (digits.length === 0) return ''
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  
  // Handle 11+ digits (assume first digit is country code 1)
  if (digits.length === 11 && digits.startsWith('1')) {
    const number = digits.slice(1)
    return `(${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`
  }
  
  // For other international numbers, just format as-is with spaces
  return digits.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
}

/**
 * Validates if a phone number has enough digits to be valid
 */
export function isValidPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10
}

/**
 * Extracts and formats phone number for database storage
 * Returns consistently formatted phone number or empty string
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return ''
  
  const digits = phone.replace(/\D/g, '')
  
  // Require at least 10 digits for a valid US phone number
  if (digits.length < 10) return ''
  
  // Handle US phone numbers (10 or 11 digits)
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  
  if (digits.length === 11 && digits.startsWith('1')) {
    const number = digits.slice(1)
    return `(${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`
  }
  
  // For other formats, return the first 10 digits formatted
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}