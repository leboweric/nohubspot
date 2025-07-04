"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import { contactAPI, companyAPI, handleAPIError, Company } from "@/lib/api"
import { normalizePhoneNumber } from "@/lib/phoneUtils"

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
    status: "Lead"
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(true)

  // Load companies on component mount
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        setLoadingCompanies(true)
        const companiesData = await companyAPI.getAll({ limit: 1000 })
        setCompanies(companiesData)
      } catch (err) {
        console.error('Failed to load companies:', err)
        setError('Failed to load companies. Please refresh the page.')
      } finally {
        setLoadingCompanies(false)
      }
    }

    loadCompanies()
  }, [])

  useEffect(() => {
    const companyParam = searchParams.get('company')
    if (companyParam && companies.length > 0) {
      // Find company by name and set the ID
      const company = companies.find(c => c.name.toLowerCase() === companyParam.toLowerCase())
      if (company) {
        setFormData(prev => ({
          ...prev,
          company_id: company.id.toString()
        }))
      }
    }
  }, [searchParams, companies])

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
        company_id: formData.company_id ? parseInt(formData.company_id) : undefined
      }
      
      // Remove company_id from formData if it's empty string
      if (!formData.company_id) {
        delete formattedData.company_id
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
            <select
              id="company_id"
              name="company_id"
              required
              value={formData.company_id}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a company</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
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
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
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