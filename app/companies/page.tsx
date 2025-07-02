import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, Users, FileText, Plus, Search, Filter } from "lucide-react"

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
  },
]

export default function CompaniesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              NoHubSpot
            </span>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/dashboard" className="text-gray-600 hover:text-blue-600">
              Dashboard
            </Link>
            <Link href="/companies" className="text-blue-600 font-medium">
              Companies
            </Link>
            <Link href="/contacts" className="text-gray-600 hover:text-blue-600">
              Contacts
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Companies</h1>
            <p className="text-gray-600">Manage your business relationships and partnerships</p>
          </div>
          <Link href="/companies/new">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 mt-4 sm:mt-0">
              <Plus className="mr-2 h-4 w-4" />
              Add Company
            </Button>
          </Link>
        </div>

        {/* Search and Filter Bar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search companies..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Companies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <Card
              key={company.id}
              className="hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-blue-50 border-blue-100"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-blue-900">{company.name}</CardTitle>
                      <CardDescription className="text-blue-600">{company.industry}</CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={company.status === "Active" ? "default" : "secondary"}
                    className={
                      company.status === "Active" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                    }
                  >
                    {company.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{company.description}</p>

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4 text-green-500" />
                      <span>{company.contactCount} contacts</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <FileText className="h-4 w-4 text-orange-500" />
                      <span>{company.attachmentCount} files</span>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Link href={`/companies/${company.id}`} className="flex-1">
                    <Button
                      variant="outline"
                      className="w-full text-blue-600 border-blue-200 hover:bg-blue-50 bg-transparent"
                    >
                      View Details
                    </Button>
                  </Link>
                  <Button variant="outline" size="icon" className="text-gray-600 hover:text-blue-600 bg-transparent">
                    <FileText className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State (if no companies) */}
        {companies.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No companies yet</h3>
              <p className="text-gray-600 mb-6">Get started by adding your first company</p>
              <Link href="/companies/new">
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Company
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
