"use client"

import Link from "next/link"
import { useRef, useState } from "react"

const companies = [
  {
    id: "1",
    name: "Acme Corporation",
    industry: "Technology",
    website: "https://acme.example.com",
    status: "Active",
    contactCount: 3,
    attachmentCount: 2,
    description: "A leading technology company specializing in innovative solutions.",
    createdAt: "2024-01-15",
    lastActivity: "2024-03-20"
  },
  {
    id: "2",
    name: "Globex Industries",
    industry: "Manufacturing",
    website: "https://globex.example.com",
    status: "Active",
    contactCount: 2,
    attachmentCount: 1,
    description: "Manufacturing company focused on sustainable products.",
    createdAt: "2024-02-01",
    lastActivity: "2024-03-18"
  },
  {
    id: "3",
    name: "Initech LLC",
    industry: "Finance",
    website: "https://initech.example.com",
    status: "Lead",
    contactCount: 1,
    attachmentCount: 0,
    description: "Financial services provider for small businesses and startups.",
    createdAt: "2024-03-10",
    lastActivity: "2024-03-15"
  }
]

export default function CompanyDetailPage({ params }: { params: { id: string } }) {
  const company = companies.find(c => c.id === params.id)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // TODO: Upload file to backend
      console.log("File selected:", file.name)
      alert(`File "${file.name}" selected for upload. (Backend integration needed)`)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      // TODO: Upload file to backend
      console.log("File dropped:", file.name)
      alert(`File "${file.name}" dropped for upload. (Backend integration needed)`)
    }
  }

  if (!company) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Company Not Found</h1>
          <p className="text-muted-foreground mb-4">The company you're looking for doesn't exist.</p>
          <Link href="/companies" className="text-primary hover:underline">
            Back to Companies
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link href="/companies" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
          ← Back to Companies
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold">{company.name}</h1>
            <p className="text-muted-foreground mt-1">{company.industry}</p>
          </div>
          <span className={`inline-flex px-3 py-1 text-sm rounded-full ${
            company.status === "Active" 
              ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" 
              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
          }`}>
            {company.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Company Information</h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Website</dt>
                <dd className="mt-1">
                  {company.website ? (
                    <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {company.website}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Not provided</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Description</dt>
                <dd className="mt-1">{company.description || "No description provided"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Created</dt>
                <dd className="mt-1">{new Date(company.createdAt).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Last Activity</dt>
                <dd className="mt-1">{new Date(company.lastActivity).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
            <p className="text-muted-foreground">No recent activity to display.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Stats</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Contacts</dt>
                <dd className="text-sm font-medium">{company.contactCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Files</dt>
                <dd className="text-sm font-medium">{company.attachmentCount}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              <Link href={`/companies/${params.id}/edit`} className="block w-full text-left px-4 py-2 border rounded-md hover:bg-accent transition-colors">
                Edit Company
              </Link>
              <Link href={`/contacts/new?company=${encodeURIComponent(company.name)}`} className="block w-full text-left px-4 py-2 border rounded-md hover:bg-accent transition-colors">
                Add Contact
              </Link>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleFileUpload}
                className={`w-full px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                  isDragging 
                    ? 'border-primary bg-primary/5 scale-105' 
                    : 'border-muted-foreground/30 hover:border-primary hover:bg-accent/50'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">📁</div>
                  <div className="text-sm font-medium mb-1">
                    {isDragging ? 'Drop file here' : 'Upload File'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Click to browse or drag and drop
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    PDF, DOC, TXT, JPG, PNG
                  </div>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}