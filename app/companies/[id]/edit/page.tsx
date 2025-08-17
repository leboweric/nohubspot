"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { INDUSTRIES } from "@/lib/constants"
import { companyAPI, Company, handleAPIError, usersAPI } from "@/lib/api"
import { User } from "@/lib/auth"
import ModernSelect from "@/components/ui/ModernSelect"

export default function EditCompanyPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<User[]>([])
  
  const [formData, setFormData] = useState({
    name: "",
    industry: "",
    website: "",
    address: "",
    street_address: "",
    city: "",
    state: "",
    postal_code: "",
    phone: "",
    annual_revenue: "",
    description: "",
    status: "Lead",
    primary_account_owner_id: ""
  })

  useEffect(() => {
    const loadCompany = async () => {
      try {
        setLoading(true)
        setError(null)
        const companyData = await companyAPI.getById(parseInt(params.id))
        setCompany(companyData)
        setFormData({
          name: companyData.name,
          industry: companyData.industry || "",
          website: companyData.website || "",
          address: companyData.address || "",
          street_address: companyData.street_address || "",
          city: companyData.city || "",
          state: companyData.state || "",
          postal_code: companyData.postal_code || "",
          phone: companyData.phone || "",
          annual_revenue: companyData.annual_revenue?.toString() || "",
          description: companyData.description || "",
          status: companyData.status,
          primary_account_owner_id: companyData.primary_account_owner_id?.toString() || ""
        })
      } catch (err) {
        setError(handleAPIError(err))
        console.error('Failed to load company:', err)
      } finally {
        setLoading(false)
      }
    }

    loadCompany()
    loadUsers()
  }, [params.id])

  const loadUsers = async () => {
    try {
      const data = await usersAPI.getAll()
      setUsers(data || [])
    } catch (err) {
      console.error('Failed to load users:', err)
      setUsers([]) // Set to empty array on error
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading company...</p>
        </div>
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Company Not Found</h1>
          <p className="text-muted-foreground mb-4">
            {error || "The company you're looking for doesn't exist."}
          </p>
          <Link href="/companies" className="text-primary hover:underline">
            Back to Companies
          </Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await companyAPI.update(parseInt(params.id), {
        ...formData,
        annual_revenue: formData.annual_revenue ? parseFloat(formData.annual_revenue) : undefined,
        primary_account_owner_id: formData.primary_account_owner_id ? parseInt(formData.primary_account_owner_id) : undefined
      })
      router.push(`/companies/${params.id}`)
    } catch (err) {
      console.error('Failed to update company:', err)
      alert(`Failed to update company: ${handleAPIError(err)}`)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link href={`/companies/${params.id}`} className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
          ← Back to Company
        </Link>
        <h1 className="text-2xl font-semibold">Edit Company</h1>
        <p className="text-muted-foreground mt-1">Update company information</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Company Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="industry" className="block text-sm font-medium mb-2">
            Industry
          </label>
          <ModernSelect
            value={formData.industry}
            onChange={(value) => setFormData(prev => ({ ...prev, industry: value as string }))}
            options={[
              { value: "", label: "Select an industry" },
              ...INDUSTRIES.map((industry) => ({
                value: industry,
                label: industry
              }))
            ]}
            placeholder="Select industry"
          />
        </div>

        <div>
          <label htmlFor="website" className="block text-sm font-medium mb-2">
            Website
          </label>
          <input
            type="url"
            id="website"
            name="website"
            value={formData.website}
            onChange={handleChange}
            placeholder="https://example.com"
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="(555) 123-4567"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="annual_revenue" className="block text-sm font-medium mb-2">
              Annual Revenue
            </label>
            <input
              type="number"
              id="annual_revenue"
              name="annual_revenue"
              value={formData.annual_revenue}
              onChange={handleChange}
              placeholder="1000000"
              step="0.01"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div>
          <label htmlFor="street_address" className="block text-sm font-medium mb-2">
            Street Address
          </label>
          <input
            type="text"
            id="street_address"
            name="street_address"
            value={formData.street_address}
            onChange={handleChange}
            placeholder="123 Main Street"
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="city" className="block text-sm font-medium mb-2">
              City
            </label>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder="New York"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="state" className="block text-sm font-medium mb-2">
              State/Region
            </label>
            <input
              type="text"
              id="state"
              name="state"
              value={formData.state}
              onChange={handleChange}
              placeholder="NY"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="postal_code" className="block text-sm font-medium mb-2">
              Postal Code
            </label>
            <input
              type="text"
              id="postal_code"
              name="postal_code"
              value={formData.postal_code}
              onChange={handleChange}
              placeholder="10001"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div>
          <label htmlFor="address" className="block text-sm font-medium mb-2">
            Full Address (Legacy)
          </label>
          <textarea
            id="address"
            name="address"
            rows={3}
            value={formData.address}
            onChange={handleChange}
            placeholder="Full address (optional - for backward compatibility)"
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
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
            onChange={(value) => setFormData(prev => ({ ...prev, primary_account_owner_id: value as number }))}
            options={[
              { value: "", label: "Select account owner" },
              ...users.map((user) => ({
                value: user.id,
                label: `${user.first_name} ${user.last_name} (${user.email})`
              }))
            ]}
            placeholder="Select owner"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-2">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            value={formData.description}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
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
            onClick={() => router.push(`/companies/${params.id}`)}
            className="px-4 py-2 border rounded-md hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}