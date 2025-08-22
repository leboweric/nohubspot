"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import { contactAPI, companyAPI, handleAPIError, Company, usersAPI, User } from "@/lib/api"
import { normalizePhoneNumber } from "@/lib/phoneUtils"
import ModernSelect from "@/components/ui/ModernSelect"

export default function NewContactPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    title: "",
    company_id: "",
    status: "Lead",
    primary_account_owner_id: ""
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [users, setUsers] = useState<User[]>([])

  // Load companies on component mount
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        setLoadingCompanies(true)
        const response = await companyAPI.getAll({ limit: 1000 })
        setCompanies(response.items || [])
        
        // Check for pre-selected company after companies are loaded
        const companyIdParam = searchParams.get('companyId')
        const companyNameParam = searchParams.get('company')
        
        // Debug logging for Quality Forklifts issue
        if (companyNameParam && companyNameParam.toLowerCase().includes('quality')) {
          console.log('Quality company detected:', {
            companyIdParam,
            companyNameParam,
            matchingCompanies: response.items?.filter((c: Company) => 
              c.name.toLowerCase().includes('quality')
            ).map((c: Company) => ({ id: c.id, name: c.name }))
          })
        }
        
        if (companyIdParam) {
          // Always prefer the company ID if provided
          const companyIdStr = companyIdParam.trim()
          console.log('Setting company by ID:', companyIdStr)
          
          // Verify the company exists in the list
          const companyExists = response.items?.find((c: Company) => 
            String(c.id) === companyIdStr
          )
          
          if (companyExists) {
            console.log('Company found in list:', companyExists.name)
          } else {
            console.log('Warning: Company ID not found in list:', companyIdStr)
          }
          
          setFormData(prev => ({
            ...prev,
            company_id: companyIdStr
          }))
        } else if (companyNameParam && response.items) {
          // Fallback to name matching with better normalization
          const normalizedSearchName = companyNameParam.trim().toLowerCase()
          const company = response.items.find((c: Company) => 
            c.name.trim().toLowerCase() === normalizedSearchName
          )
          if (company) {
            console.log('Found company by name:', company.name, 'ID:', company.id)
            setFormData(prev => ({
              ...prev,
              company_id: company.id.toString()
            }))
          } else {
            console.log('Could not find company by name:', companyNameParam)
          }
        }
      } catch (err) {
        console.error('Failed to load companies:', err)
        setError('Failed to load companies. Please refresh the page.')
      } finally {
        setLoadingCompanies(false)
      }
    }

    loadCompanies()
    loadUsers()
  }, [searchParams])

  const loadUsers = async () => {
    try {
      const data = await usersAPI.getAll()
      setUsers(data || [])
    } catch (err) {
      console.error('Failed to load users:', err)
      setUsers([]) // Set to empty array on error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      console.log("Submitting contact:", formData)
      
      // Format phone number and company_id before submitting
      const formattedData = {
        ...formData,
        phone: normalizePhoneNumber(formData.phone),
        company_id: formData.company_id ? parseInt(formData.company_id) : undefined,
        primary_account_owner_id: formData.primary_account_owner_id ? parseInt(formData.primary_account_owner_id) : undefined
      }
      
      // Remove company_id from formData if it's empty string
      if (!formData.company_id) {
        delete formattedData.company_id
      }
      
      // Remove primary_account_owner_id from formData if it's empty string
      if (!formData.primary_account_owner_id) {
        delete formattedData.primary_account_owner_id
      }
      
      console.log("Formatted contact data:", formattedData)
      
      // Create contact via API
      const newContact = await contactAPI.create(formattedData)
      
      console.log("Contact created successfully:", newContact)
      alert("Contact added successfully!")
      router.push("/contacts")
      
    } catch (error) {
      console.error("Failed to add contact:", error)
      const errorMessage = handleAPIError(error)
      setError(errorMessage)
      alert(`Failed to add contact: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Add New Contact</h1>
        <p className="text-muted-foreground mt-1">Enter contact information below</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

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
          {loadingCompanies ? (
            <div className="w-full px-4 py-2 border rounded-md bg-gray-50 text-gray-500">
              Loading companies...
            </div>
          ) : (
            <ModernSelect
              value={formData.company_id}
              onChange={(value) => setFormData(prev => ({ ...prev, company_id: value as string }))}
              options={[
                { value: "", label: "Select a company" },
                ...(Array.isArray(companies) ? companies : []).map(company => ({
                  value: company.id.toString(),
                  label: company.name
                }))
              ]}
              placeholder="Select company"
            />
          )}
          {companies.length === 0 && !loadingCompanies && (
            <p className="text-sm text-gray-600 mt-1">
              No companies found. <a href="/companies/new" className="text-blue-600 hover:underline">Create a company first</a>.
            </p>
          )}
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
            disabled={loading}
            className="px-4 py-2 rounded-md transition-all text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {loading ? "Adding..." : "Add Contact"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/contacts")}
            className="px-4 py-2 border rounded-md hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
        </div>
      </MainLayout>
    </AuthGuard>
  )
}