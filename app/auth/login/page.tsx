"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Building2, Users, TrendingUp, Shield, Mail, Lock, ArrowRight } from "lucide-react"
import Image from "next/image"

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [rememberMe, setRememberMe] = useState(false)

  // Check for saved email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem("remembered_email")
    if (savedEmail) {
      setFormData(prev => ({ ...prev, email: savedEmail }))
      setRememberMe(true)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    // Handle remember me
    if (rememberMe) {
      localStorage.setItem("remembered_email", formData.email)
    } else {
      localStorage.removeItem("remembered_email")
    }

    try {
      // Create form data for OAuth2PasswordRequestForm
      const formDataObj = new FormData()
      formDataObj.append("username", formData.email)
      formDataObj.append("password", formData.password)

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: "POST",
        body: formDataObj,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Login failed")
      }

      const data = await response.json()

      // Store authentication data
      localStorage.setItem("auth_token", data.access_token)
      localStorage.setItem("user", JSON.stringify(data.user))
      localStorage.setItem("organization", JSON.stringify(data.organization))

      // Redirect to dashboard on same domain
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div 
        className="hidden lg:flex lg:w-1/2 xl:w-2/5 text-white p-12 flex-col justify-between bg-blue-600"
        style={{ backgroundColor: 'var(--color-primary, #2563eb)' }}
      >
        <div>
          {/* Logo */}
          <div className="flex items-center gap-4 mb-16">
            <div className="bg-white rounded-lg p-2">
              <Image 
                src="/NHS_Logo_Compressed.png" 
                alt="NHS Logo" 
                width={60} 
                height={60}
                className="object-contain"
              />
            </div>
            <span className="text-3xl font-bold">The Simple CRM</span>
          </div>

          {/* Main Content */}
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl xl:text-5xl font-bold mb-4">
                Welcome back
              </h1>
              <p className="text-xl text-white/80">
                Your all-in-one CRM platform for managing customers, deals, and projects
              </p>
            </div>

            {/* Feature List */}
            <div className="space-y-6 mt-12">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Company Management</h3>
                  <p className="text-sm text-white/70">Track and organize all your customer relationships in one place</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Sales Pipeline</h3>
                  <p className="text-sm text-white/70">Visualize and manage your deals through every stage</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Project Tracking</h3>
                  <p className="text-sm text-white/70">Keep projects on schedule with integrated task management</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Secure & Reliable</h3>
                  <p className="text-sm text-white/70">Enterprise-grade security with role-based access control</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-sm text-white/60">
          © 2025 NHS - The Simple CRM. All rights reserved.
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center gap-3">
              <Image 
                src="/NHS_Logo_Compressed.png" 
                alt="NHS Logo" 
                width={48} 
                height={48}
                className="object-contain"
              />
              <span className="text-2xl font-bold text-gray-900">The Simple CRM</span>
            </div>
          </div>

          {/* Form Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Sign in to your account
            </h2>
            <p className="text-gray-600">
              Enter your credentials to access your dashboard
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  style={{ '--tw-ring-color': 'var(--color-primary, #2563eb)' } as any}
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  style={{ '--tw-ring-color': 'var(--color-primary, #2563eb)' } as any}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-offset-0"
                  style={{ 
                    accentColor: 'var(--color-primary, #2563eb)',
                    '--tw-ring-color': 'var(--color-primary, #2563eb)' 
                  } as any}
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="ml-2 text-sm text-gray-700">Remember me</span>
              </label>

              <Link 
                href="/auth/forgot-password" 
                className="text-sm font-medium hover:opacity-80 transition-opacity"
                style={{ color: 'var(--color-primary, #2563eb)' }}
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center py-3 px-4 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 group"
              style={{ backgroundColor: 'var(--color-primary, #2563eb)' }}
            >
              {loading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </div>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-gray-50 text-gray-500">Or</span>
              </div>
            </div>

            <div className="text-center">
              <span className="text-sm text-gray-600">
                Don't have an account?{" "}
                <Link 
                  href="/auth/register" 
                  className="font-semibold hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--color-primary, #2563eb)' }}
                >
                  Create your organization
                </Link>
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}