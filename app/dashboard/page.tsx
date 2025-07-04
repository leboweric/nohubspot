"use client"

import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import EmailCompose, { EmailMessage } from "@/components/email/EmailCompose"
import DailySummaryCard from "@/components/dashboard/DailySummaryCard"
import TodayCalendarCard from "@/components/dashboard/TodayCalendarCard"
import { getAuthState } from "@/lib/auth"

export default function DashboardPage() {
  const [showEmailCompose, setShowEmailCompose] = useState(false)
  const [organizationName, setOrganizationName] = useState("")
  const [firstName, setFirstName] = useState("")
  
  useEffect(() => {
    const { organization, user } = getAuthState()
    if (organization) {
      setOrganizationName(organization.name)
    }
    if (user) {
      setFirstName(user.first_name || user.email.split('@')[0])
    }
  }, [])
  

  const recentActivity = [
    { action: "Email sent to John Smith", time: "2 hours ago" },
    { action: "Added Sarah Johnson as contact", time: "1 day ago" },
    { action: "Uploaded service agreement", time: "2 days ago" }
  ]

  const handleEmailSent = (email: EmailMessage) => {
    setShowEmailCompose(false)
    // Could add to recent activity here
    console.log("Email sent from dashboard:", email)
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">{organizationName} Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back{firstName ? `, ${firstName}` : ''}. Here's your CRM overview.</p>
      </div>

      {/* AI Daily Summary */}
      <div className="mb-8">
        <DailySummaryCard />
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule */}
        <TodayCalendarCard />

        <div className="bg-card border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-lg font-semibold mb-6 flex items-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
            Quick Actions
          </h2>
          <div className="space-y-3">
            <a href="/companies/new" className="block w-full text-left px-4 py-3 border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all group">
              <div className="flex items-center">
                <span className="text-blue-600 mr-3">🏢</span>
                <span className="group-hover:text-blue-700">Add New Company</span>
              </div>
            </a>
            <a href="/contacts/new" className="block w-full text-left px-4 py-3 border border-green-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-all group">
              <div className="flex items-center">
                <span className="text-green-600 mr-3">👤</span>
                <span className="group-hover:text-green-700">Add New Contact</span>
              </div>
            </a>
            <button 
              onClick={() => setShowEmailCompose(true)}
              className="block w-full text-left px-4 py-3 border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-all group"
            >
              <div className="flex items-center">
                <span className="text-purple-600 mr-3">✉️</span>
                <span className="group-hover:text-purple-700">Send Email</span>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-lg font-semibold mb-6 flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
            Recent Activity
          </h2>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start space-x-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{activity.action}</p>
                  <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Email Compose Modal */}
      <EmailCompose
        isOpen={showEmailCompose}
        onClose={() => setShowEmailCompose(false)}
        onSend={handleEmailSent}
        senderName={user?.first_name && user?.last_name 
          ? `${user?.first_name} ${user?.last_name}`
          : user?.email?.split('@')[0] || "Sales Rep"
        }
        senderEmail={user?.email || "sales@company.com"}
      />
        </div>
      </MainLayout>
    </AuthGuard>
  )
}