"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import { INDUSTRIES } from "@/lib/constants"
import { companyAPI, CompanyCreate, handleAPIError } from "@/lib/api"

export default function NewCompanyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    industry: "",
    website: "",
    description: "",
    status: "Lead"
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setLoading(true)
      const companyData: CompanyCreate = {
        name: formData.name,
        industry: formData.industry || undefined,
        website: formData.website || undefined,
        description: formData.description || undefined,
        status: formData.status
      }
      
      await companyAPI.create(companyData)
      router.push("/companies")
    } catch (err) {
      console.error('Failed to create company:', err)
      alert(`Failed to create company: ${handleAPIError(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
        <h1 className="text-2xl font-semibold">Add New Company</h1>
        <p className="text-muted-foreground mt-1">Enter company information below</p>
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
          <select
            id="industry"
            name="industry"
            value={formData.industry}
            onChange={handleChange}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select an industry</option>
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
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
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add Company"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/companies")}
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