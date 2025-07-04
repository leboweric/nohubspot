import { contacts } from '@/lib/mock-data'

// Contact data structure
export interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  title?: string
  company?: string
  status?: string
  createdAt?: string
  lastActivity?: string
  notes?: string
}

// Transform mock data contact to our Contact interface
const transformContact = (contact: any): Contact => ({
  id: contact.id,
  firstName: contact.firstName,
  lastName: contact.lastName,
  email: contact.email,
  phone: contact.phone,
  title: contact.title,
  company: contact.companyName,
  status: contact.status,
  createdAt: contact.createdAt,
  notes: contact.notes
})

// Get all contacts from mock data
export const getAllContacts = (): Contact[] => {
  if (typeof window === 'undefined') return contacts.map(transformContact)
  
  try {
    // Get new contacts from localStorage
    const newContacts = JSON.parse(localStorage.getItem('newContacts') || '[]')
    
    // Get updated contacts from localStorage
    const updatedContacts = JSON.parse(localStorage.getItem('updatedContacts') || '{}')
    
    // If we have real contacts, prioritize them over mock data
    if (newContacts.length > 0) {
      // Only use real contacts from localStorage
      const allContacts = [...newContacts]
      console.log('getAllContacts (real contacts only):', allContacts)
      return allContacts
    } else {
      // Fallback to mock data if no real contacts exist
      const transformedContacts = contacts.map(contact => {
        const transformed = transformContact(contact)
        return updatedContacts[transformed.id] || transformed
      })
      
      const allContacts = [...newContacts, ...transformedContacts]
      console.log('getAllContacts (using mock data):', allContacts)
      return allContacts
    }
  } catch {
    return contacts.map(transformContact)
  }
}

// Search contacts by name or email
export const searchContacts = (query: string, limit: number = 5): Contact[] => {
  if (!query.trim()) return []
  
  const allContacts = getAllContacts()
  const searchTerm = query.toLowerCase().trim()
  
  // Debug logging
  console.log('searchContacts query:', query, 'allContacts:', allContacts)
  
  const matches = allContacts.filter(contact => {
    const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase()
    const email = contact.email.toLowerCase()
    const firstName = contact.firstName.toLowerCase()
    const lastName = contact.lastName.toLowerCase()
    
    return (
      fullName.includes(searchTerm) ||
      email.includes(searchTerm) ||
      firstName.startsWith(searchTerm) ||
      lastName.startsWith(searchTerm)
    )
  })
  
  // Sort by relevance (exact matches first, then starts with, then contains)
  matches.sort((a, b) => {
    const aFullName = `${a.firstName} ${a.lastName}`.toLowerCase()
    const bFullName = `${b.firstName} ${b.lastName}`.toLowerCase()
    const aEmail = a.email.toLowerCase()
    const bEmail = b.email.toLowerCase()
    
    // Exact email match gets highest priority
    if (aEmail === searchTerm) return -1
    if (bEmail === searchTerm) return 1
    
    // Exact name match gets second priority
    if (aFullName === searchTerm) return -1
    if (bFullName === searchTerm) return 1
    
    // Email starts with search term
    if (aEmail.startsWith(searchTerm) && !bEmail.startsWith(searchTerm)) return -1
    if (bEmail.startsWith(searchTerm) && !aEmail.startsWith(searchTerm)) return 1
    
    // Name starts with search term
    if (aFullName.startsWith(searchTerm) && !bFullName.startsWith(searchTerm)) return -1
    if (bFullName.startsWith(searchTerm) && !aFullName.startsWith(searchTerm)) return 1
    
    // First name starts with search term
    if (a.firstName.toLowerCase().startsWith(searchTerm) && !b.firstName.toLowerCase().startsWith(searchTerm)) return -1
    if (b.firstName.toLowerCase().startsWith(searchTerm) && !a.firstName.toLowerCase().startsWith(searchTerm)) return 1
    
    // Default alphabetical sort
    return aFullName.localeCompare(bFullName)
  })
  
  return matches.slice(0, limit)
}