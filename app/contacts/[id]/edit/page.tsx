"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

const contacts = [
  {
    id: "1",
    firstName: "John",
    lastName: "Smith",
    email: "john.smith@acme.example.com",
    phone: "+1 (555) 123-4567",
    title: "CTO",
    company: "Acme Corporation",
    status: "Active"
  },
  {
    id: "2",
    firstName: "Sarah",
    lastName: "Johnson",
    email: "sarah.j@acme.example.com",
    phone: "+1 (555) 987-6543",
    title: "Marketing Director",
    company: "Acme Corporation",
    status: "Active"
  },
  {
    id: "3",
    firstName: "Michael",
    lastName: "Brown",
    email: "michael.b@globex.example.com",
    phone: "+1 (555) 456-7890",
    title: "CEO",
    company: "Globex Industries",
    status: "Active"
  },
  {
    id: "4",
    firstName: "Emily",
    lastName: "Davis",
    email: "emily.d@initech.example.com",
    phone: "",
    title: "CFO",
    company: "Initech LLC",
    status: "Lead"
  }
]

// Required for static export
export async function generateStaticParams() {
  return contacts.map((contact) => ({
    id: contact.id,
  }))
}

export default function EditContactPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  
  // Get contact from base contacts or new contacts
  const getContact = () => {
    if (typeof window !== 'undefined') {
      try {
        // First check for new contacts
        const newContacts = JSON.parse(localStorage.getItem('newContacts') || '[]')
        const newContact = newContacts.find((c: any) => c.id === params.id)
        if (newContact) return newContact
        
        // Then check base contacts with updates
        const baseContact = contacts.find(c => c.id === params.id)
        if (baseContact) {
          const updatedContacts = JSON.parse(localStorage.getItem('updatedContacts') || '{}')
          return updatedContacts[params.id] || baseContact
        }
        
        return null
      } catch {
        return contacts.find(c => c.id === params.id) || null
      }
    }
    return contacts.find(c => c.id === params.id) || null
  }
  
  const contact = getContact()
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    title: "",
    company: "",
    status: "Lead"
  })

  useEffect(() => {
    if (contact) {
      setFormData({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        title: contact.title,
        company: contact.company,
        status: contact.status
      })
    }
  }, [contact])

  if (!contact) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Contact Not Found</h1>
          <p className="text-muted-foreground mb-4">The contact you're looking for doesn't exist.</p>
          <Link href="/contacts" className="text-primary hover:underline">
            Back to Contacts
          </Link>
        </div>
      </div>
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const updatedContact = {
        ...contact,
        ...formData
      }
      
      // Check if this is a new contact or existing contact
      const newContacts = JSON.parse(localStorage.getItem('newContacts') || '[]')
      const isNewContact = newContacts.some((c: any) => c.id === params.id)
      
      if (isNewContact) {
        // Update in newContacts array
        const updatedNewContacts = newContacts.map((c: any) => 
          c.id === params.id ? updatedContact : c
        )
        localStorage.setItem('newContacts', JSON.stringify(updatedNewContacts))
      } else {
        // Update in updatedContacts object
        const existingContacts = JSON.parse(localStorage.getItem('updatedContacts') || '{}')
        existingContacts[params.id] = updatedContact
        localStorage.setItem('updatedContacts', JSON.stringify(existingContacts))
      }
      
      console.log("Contact updated:", formData)
      alert("Contact updated successfully!")
      router.push(`/contacts/${params.id}`)
      
    } catch (error) {
      console.error("Failed to update contact:", error)
      alert("Failed to update contact. Please try again.")
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link href={`/contacts/${params.id}`} className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
          ← Back to Contact
        </Link>
        <h1 className="text-2xl font-semibold">Edit Contact</h1>
        <p className="text-muted-foreground mt-1">Update contact information</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium mb-2">
              First Name *
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              required
              value={formData.firstName}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium mb-2">
              Last Name *
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              required
              value={formData.lastName}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium mb-2">
            Phone
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+1 (555) 123-4567"
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-2">
            Job Title
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="company" className="block text-sm font-medium mb-2">
            Company
          </label>
          <input
            type="text"
            id="company"
            name="company"
            value={formData.company}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium mb-2">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="Lead">Lead</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Save Changes
          </button>
          <button
            type="button"
            onClick={() => router.push(`/contacts/${params.id}`)}
            className="px-4 py-2 border rounded-md hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}