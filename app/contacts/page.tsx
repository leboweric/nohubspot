import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Building2, Users, Mail, Phone, Plus, Search, Filter } from "lucide-react"

const contacts = [
  {
    id: "1",
    firstName: "John",
    lastName: "Smith",
    email: "john.smith@acme.example.com",
    phone: "+1 (555) 123-4567",
    title: "CTO",
    companyName: "Acme Corporation",
    status: "Active",
  },
  {
    id: "2",
    firstName: "Sarah",
    lastName: "Johnson",
    email: "sarah.j@acme.example.com",
    phone: "+1 (555) 987-6543",
    title: "Marketing Director",
    companyName: "Acme Corporation",
    status: "Active",
  },
  {
    id: "3",
    firstName: "Michael",
    lastName: "Brown",
    email: "michael.b@globex.example.com",
    phone: "+1 (555) 456-7890",
    title: "CEO",
    companyName: "Globex Industries",
    status: "Active",
  },
  {
    id: "4",
    firstName: "Emily",
    lastName: "Davis",
    email: "emily.d@initech.example.com",
    title: "CFO",
    companyName: "Initech LLC",
    status: "Lead",
  },
]

export default function ContactsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50">
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
            <Link href="/companies" className="text-gray-600 hover:text-blue-600">
              Companies
            </Link>
            <Link href="/contacts" className="text-green-600 font-medium">
              Contacts
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Contacts</h1>
            <p className="text-gray-600">Manage your professional network and relationships</p>
          </div>
          <Link href="/contacts/new">
            <Button className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 mt-4 sm:mt-0">
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
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
                  placeholder="Search contacts..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contacts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contacts.map((contact) => (
            <Card
              key={contact.id}
              className="hover:shadow-lg transition-shadow bg-gradient-to-br from-white to-green-50 border-green-100"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-gradient-to-br from-green-500 to-blue-600 text-white font-semibold">
                        {contact.firstName[0]}
                        {contact.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg text-green-900">
                        {contact.firstName} {contact.lastName}
                      </CardTitle>
                      <CardDescription className="text-green-600">{contact.title}</CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={contact.status === "Active" ? "default" : "secondary"}
                    className={
                      contact.status === "Active" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                    }
                  >
                    {contact.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    <span>{contact.companyName}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4 text-purple-500" />
                    <span className="truncate">{contact.email}</span>
                  </div>
                  {contact.phone && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4 text-green-500" />
                      <span>{contact.phone}</span>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  <Link href={`/contacts/${contact.id}`} className="flex-1">
                    <Button
                      variant="outline"
                      className="w-full text-green-600 border-green-200 hover:bg-green-50 bg-transparent"
                    >
                      View Profile
                    </Button>
                  </Link>
                  <Button variant="outline" size="icon" className="text-gray-600 hover:text-green-600 bg-transparent">
                    <Mail className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {contacts.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No contacts yet</h3>
              <p className="text-gray-600 mb-6">Start building your professional network</p>
              <Link href="/contacts/new">
                <Button className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Contact
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
