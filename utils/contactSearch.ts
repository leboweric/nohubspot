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

// Base contacts from the app
const baseContacts: Contact[] = [
  {
    id: "1",
    firstName: "John",
    lastName: "Smith",
    email: "john.smith@acme.example.com",
    phone: "+1 (555) 123-4567",
    title: "CTO",
    company: "Acme Corporation",
    status: "Active",
    createdAt: "2024-01-20",
    lastActivity: "2024-03-20",
    notes: "Key technical decision maker. Interested in cloud migration solutions."
  },
  {
    id: "2",
    firstName: "Sarah",
    lastName: "Johnson",
    email: "sarah.j@acme.example.com",
    phone: "+1 (555) 987-6543",
    title: "Marketing Director",
    company: "Acme Corporation",
    status: "Active",
    createdAt: "2024-02-05",
    lastActivity: "2024-03-18",
    notes: "Responsible for all marketing initiatives. Looking for analytics tools."
  },
  {
    id: "3",
    firstName: "Michael",
    lastName: "Brown",
    email: "michael.b@globex.example.com",
    phone: "+1 (555) 456-7890",
    title: "CEO",
    company: "Globex Industries",
    status: "Active",
    createdAt: "2024-02-10",
    lastActivity: "2024-03-15",
    notes: "Final decision maker. Focuses on cost-efficiency and ROI."
  },
  {
    id: "4",
    firstName: "Emily",
    lastName: "Davis",
    email: "emily.d@initech.example.com",
    phone: "",
    title: "CFO",
    company: "Initech LLC",
    status: "Lead",
    createdAt: "2024-03-10",
    lastActivity: "2024-03-10",
    notes: "New lead from conference. Interested in financial planning tools."
  }
]

// Get all contacts (base + new contacts from localStorage)
export const getAllContacts = (): Contact[] => {
  if (typeof window === 'undefined') return baseContacts

  try {
    // Get new contacts from localStorage
    const newContacts = JSON.parse(localStorage.getItem('newContacts') || '[]')
    
    // Get updated contacts from localStorage
    const updatedContacts = JSON.parse(localStorage.getItem('updatedContacts') || '{}')
    
    // Merge base contacts with updates
    const mergedBaseContacts = baseContacts.map(contact => {
      return updatedContacts[contact.id] || contact
    })
    
    // Combine all contacts
    return [...newContacts, ...mergedBaseContacts]
  } catch {
    return baseContacts
  }
}

// Search contacts by name or email
export const searchContacts = (query: string, limit: number = 5): Contact[] => {
  if (!query.trim()) return []
  
  const allContacts = getAllContacts()
  const searchTerm = query.toLowerCase().trim()
  
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