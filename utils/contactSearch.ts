import { contactAPI, Contact as APIContact } from '@/lib/api'

// Contact data structure for search autocomplete
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

// Transform API contact to our Contact interface
const transformAPIContact = (contact: APIContact): Contact => ({
  id: contact.id.toString(),
  firstName: contact.first_name,
  lastName: contact.last_name,
  email: contact.email,
  phone: contact.phone,
  title: contact.title,
  company: contact.company_name,
  status: contact.status,
  createdAt: contact.created_at,
  lastActivity: contact.last_activity,
  notes: contact.notes
})

// Get all contacts from API
export const getAllContacts = async (): Promise<Contact[]> => {
  try {
    // Get contacts from API
    const apiContacts = await contactAPI.getAll({ limit: 100 })
    const transformedContacts = apiContacts.map(transformAPIContact)
    
    console.log('getAllContacts (from API):', transformedContacts)
    return transformedContacts
  } catch (error) {
    console.error('Failed to fetch contacts from API:', error)
    return []
  }
}

// Search contacts by name or email
export const searchContacts = async (query: string, limit: number = 5): Promise<Contact[]> => {
  if (!query.trim()) return []
  
  try {
    // Use API search directly for better performance
    const apiContacts = await contactAPI.getAll({ 
      search: query.trim(),
      limit: limit * 2 // Get more results to ensure we have enough after filtering
    })
    
    const transformedContacts = apiContacts.map(transformAPIContact)
    console.log('searchContacts query:', query, 'results:', transformedContacts)
    
    // Additional client-side filtering for better relevance
    const searchTerm = query.toLowerCase().trim()
    const matches = transformedContacts.filter(contact => {
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
  } catch (error) {
    console.error('Failed to search contacts:', error)
    return []
  }
}