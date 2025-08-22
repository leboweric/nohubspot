"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { contactAPI, companyAPI, Contact, Company, handleAPIError, usersAPI, User } from "@/lib/api"
import { normalizePhoneNumber } from "@/lib/phoneUtils"
import ModernSelect from "@/components/ui/ModernSelect"
import CompanySearch from "@/components/ui/CompanySearch"

export default function EditContactPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<User[]>([])
  
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    title: "",
    company_id: null as number | null,
    status: "Lead",
    primary_account_owner_id: ""
  })

  // Load users on component mount
  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const data = await usersAPI.getAll()
      setUsers(data || [])
    } catch (err) {
      console.error('Failed to load users:', err)
      setUsers([]) // Set to empty array on error
    }
  }

  useEffect(() => {
    const loadContact = async () => {
      try {
        setLoading(true)
        setError(null)
        const contactData = await contactAPI.getById(parseInt(params.id))
        setContact(contactData)
        setFormData({
          first_name: contactData.first_name,
          last_name: contactData.last_name,
          email: contactData.email,
          phone: contactData.phone || "",
          title: contactData.title || "",
          company_id: contactData.company_id || null,
          status: contactData.status,
          primary_account_owner_id: contactData.primary_account_owner_id ? contactData.primary_account_owner_id.toString() : ""
        })
      } catch (err) {
        setError(handleAPIError(err))
        console.error('Failed to load contact:', err)
      } finally {
        setLoading(false)
      }
    }

    loadContact()
  }, [params.id])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderBottomColor: 'var(--color-primary)' }}></div>
          <p className="text-muted-foreground">Loading contact...</p>
        </div>
      </div>
    )
  }

  if (error || !contact) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Contact Not Found</h1>
          <p className="text-muted-foreground mb-4">
            {error || "The contact you're looking for doesn't exist."}
          </p>
          <Link href="/contacts" className="text-primary hover:underline">
            Back to Contacts
          </Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const updateData = {
        ...formData,
        phone: normalizePhoneNumber(formData.phone),
        company_id: formData.company_id || undefined,
        primary_account_owner_id: formData.primary_account_owner_id ? parseInt(formData.primary_account_owner_id) : undefined
      }
      
      // Remove company_id from updateData if it's empty string
      if (!formData.company_id) {
        delete updateData.company_id
      }
      
      // Remove primary_account_owner_id from updateData if it's empty string
      if (!formData.primary_account_owner_id) {
        delete updateData.primary_account_owner_id
      }
      
      await contactAPI.update(parseInt(params.id), updateData)
      router.push(`/contacts/${params.id}`)
    } catch (err) {
      console.error('Failed to update contact:', err)
      alert(`Failed to update contact: ${handleAPIError(err)}`)
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
            <label htmlFor="first_name" className="block text-sm font-medium mb-2">
              First Name *
            </label>
            <input
              type="text"
              id="first_name"
              name="first_name"
              required
              value={formData.first_name}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="last_name" className="block text-sm font-medium mb-2">
              Last Name *
            </label>
            <input
              type="text"
              id="last_name"
              name="last_name"
              required
              value={formData.last_name}
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
          <label htmlFor="company_id" className="block text-sm font-medium mb-2">
            Company *
          </label>
          <CompanySearch
            value={formData.company_id}
            onChange={(companyId, companyName) => {
              setFormData(prev => ({ ...prev, company_id: companyId }))
            }}
            placeholder="Search for a company..."
            required={true}
          />
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium mb-2">
            Status
          </label>
          <ModernSelect
            value={formData.status}
            onChange={(value) => setFormData(prev => ({ ...prev, status: value as string }))}
            options={[
              { value: "Lead", label: "Lead" },
              { value: "Active", label: "Active" },
              { value: "Inactive", label: "Inactive" }
            ]}
            placeholder="Select status"
          />
        </div>

        <div>
          <label htmlFor="primary_account_owner_id" className="block text-sm font-medium mb-2">
            Primary Account Owner
          </label>
          <ModernSelect
            value={formData.primary_account_owner_id}
            onChange={(value) => setFormData(prev => ({ ...prev, primary_account_owner_id: value as string }))}
            options={[
              { value: "", label: "Select account owner" },
              ...users.map(user => ({
                value: user.id.toString(),
                label: `${user.first_name} ${user.last_name}` || user.email
              }))
            ]}
            placeholder="Select account owner"
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            className="px-4 py-2 rounded-md transition-all text-white hover:opacity-90"
            style={{ backgroundColor: 'var(--color-primary)' }}
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