import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Users, Mail, FileText, Plus, TrendingUp, Activity } from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              NoHubSpot
            </span>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/dashboard" className="text-blue-600 font-medium">
              Dashboard
            </Link>
            <Link href="/companies" className="text-gray-600 hover:text-blue-600">
              Companies
            </Link>
            <Link href="/contacts" className="text-gray-600 hover:text-blue-600">
              Contacts
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back!</h1>
          <p className="text-gray-600">Here's what's happening with your business today.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-100">Total Companies</CardTitle>
              <Building2 className="h-4 w-4 text-blue-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-blue-200">+1 from last month</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-100">Total Contacts</CardTitle>
              <Users className="h-4 w-4 text-green-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">4</div>
              <p className="text-xs text-green-200">+2 from last month</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-100">Email Threads</CardTitle>
              <Mail className="h-4 w-4 text-purple-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2</div>
              <p className="text-xs text-purple-200">Active conversations</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-100">Attachments</CardTitle>
              <FileText className="h-4 w-4 text-orange-200" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-orange-200">Documents stored</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                Quick Actions
              </CardTitle>
              <CardDescription>Get started with common tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/companies/new">
                <Button className="w-full justify-start bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200">
                  <Building2 className="mr-2 h-4 w-4" />
                  Add New Company
                </Button>
              </Link>
              <Link href="/contacts/new">
                <Button className="w-full justify-start bg-green-50 text-green-700 hover:bg-green-100 border border-green-200">
                  <Users className="mr-2 h-4 w-4" />
                  Add New Contact
                </Button>
              </Link>
              <Button className="w-full justify-start bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200">
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-600" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest updates from your CRM</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Email sent to John Smith</p>
                  <p className="text-xs text-gray-500">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Added Sarah Johnson as contact</p>
                  <p className="text-xs text-gray-500">1 day ago</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Uploaded service agreement</p>
                  <p className="text-xs text-gray-500">2 days ago</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Performance Overview
            </CardTitle>
            <CardDescription>Your CRM metrics at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 mb-1">75%</div>
                <div className="text-sm text-gray-600">Active Companies</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600 mb-1">100%</div>
                <div className="text-sm text-gray-600">Response Rate</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 mb-1">2.5</div>
                <div className="text-sm text-gray-600">Avg. Emails/Contact</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
