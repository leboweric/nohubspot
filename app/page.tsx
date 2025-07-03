"use client"

import Link from "next/link"
import { getAuthState } from "@/lib/auth"
import { useEffect, useState } from "react"

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { isAuthenticated: authenticated } = getAuthState()
    setIsAuthenticated(authenticated)
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Redirect authenticated users to dashboard
  // Temporarily disabled for debugging
  // if (isAuthenticated) {
  //   window.location.href = '/dashboard'
  //   return null
  // }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="text-xl font-bold text-blue-600">
            NotHubSpot
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/auth/login"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              Sign in
            </Link>
            <Link
              href="/auth/register"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            The CRM that just
            <span className="text-blue-600"> works</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            NotHubSpot is a simple, powerful CRM designed for teams who want to focus on building relationships, not fighting with software.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/register"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Start Free Trial
            </Link>
            <Link
              href="#features"
              className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything you need to manage your relationships
            </h2>
            <p className="text-lg text-gray-600">
              Built for modern teams who value simplicity and efficiency.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: "🏢",
                title: "Company Management",
                description: "Keep track of all your companies, their details, and relationships in one place."
              },
              {
                icon: "👥",
                title: "Contact Organization",
                description: "Manage contacts with detailed profiles, notes, and communication history."
              },
              {
                icon: "✅",
                title: "Task Tracking",
                description: "Never miss a follow-up with intelligent task management and reminders."
              },
              {
                icon: "📧",
                title: "Email Integration",
                description: "Built-in email tools to communicate directly from your CRM."
              },
              {
                icon: "📊",
                title: "Smart Dashboard",
                description: "Get insights at a glance with customizable dashboards and reports."
              },
              {
                icon: "🔒",
                title: "Multi-Tenant Security",
                description: "Enterprise-grade security with complete data isolation between organizations."
              }
            ].map((feature, index) => (
              <div key={index} className="text-center p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 py-20">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to get started?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of teams already using NotHubSpot to build better relationships.
          </p>
          <Link
            href="/auth/register"
            className="bg-white text-blue-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors inline-block"
          >
            Create Your Organization
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-4">NotHubSpot</div>
            <p className="text-gray-400">
              The CRM alternative that puts relationships first.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
