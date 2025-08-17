"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Building2, Users, TrendingUp, Shield, Mail, Lock, User, ArrowRight, CheckCircle } from "lucide-react"
import Image from "next/image"

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyName: ""
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validation
    if (!agreedToTerms) {
      setError("Please agree to the terms and conditions")
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long")
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          first_name: formData.firstName,
          last_name: formData.lastName,
          company_name: formData.companyName
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Registration failed")
      }

      const data = await response.json()

      // Store authentication data
      localStorage.setItem("auth_token", data.access_token)
      localStorage.setItem("user", JSON.stringify(data.user))
      localStorage.setItem("organization", JSON.stringify(data.organization))

      // Redirect to dashboard on same domain
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  const passwordStrength = () => {
    const pass = formData.password
    if (!pass) return 0
    let strength = 0
    if (pass.length >= 8) strength++
    if (pass.length >= 12) strength++
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) strength++
    if (/[0-9]/.test(pass)) strength++
    if (/[^a-zA-Z0-9]/.test(pass)) strength++
    return Math.min(strength, 4)
  }

  const getPasswordStrengthColor = () => {
    const strength = passwordStrength()
    if (strength === 0) return 'bg-gray-200'
    if (strength === 1) return 'bg-red-500'
    if (strength === 2) return 'bg-yellow-500'
    if (strength === 3) return 'bg-blue-500'
    return 'bg-green-500'
  }

  const getPasswordStrengthText = () => {
    const strength = passwordStrength()
    if (strength === 0) return ''
    if (strength === 1) return 'Weak'
    if (strength === 2) return 'Fair'
    if (strength === 3) return 'Good'
    return 'Strong'
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
                Start your journey
              </h1>
              <p className="text-xl text-white/80">
                Join thousands of organizations managing their business with NHS - The Simple CRM
              </p>
            </div>

            {/* Benefits List */}
            <div className="space-y-6 mt-12">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Quick Setup</h3>
                  <p className="text-sm text-white/70">Get started in minutes with our intuitive onboarding process</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Unlimited Contacts</h3>
                  <p className="text-sm text-white/70">Store and manage unlimited companies and contacts</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Team Collaboration</h3>
                  <p className="text-sm text-white/70">Invite your team and collaborate seamlessly</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Secure by Default</h3>
                  <p className="text-sm text-white/70">Enterprise-grade security from day one</p>
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

      {/* Right Side - Registration Form */}
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
              Create your organization
            </h2>
            <p className="text-gray-600">
              Start your 30-day free trial, no credit card required
            </p>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Company Name */}
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                Company Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  style={{ '--tw-ring-color': 'var(--color-primary, #2563eb)' } as any}
                  placeholder="Your company name"
                  value={formData.companyName}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  First Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    style={{ '--tw-ring-color': 'var(--color-primary, #2563eb)' } as any}
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  className="block w-full px-3 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                  style={{ '--tw-ring-color': 'var(--color-primary, #2563eb)' } as any}
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Work Email
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
                  placeholder="john@company.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Password */}
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
                  autoComplete="new-password"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  style={{ '--tw-ring-color': 'var(--color-primary, #2563eb)' } as any}
                  placeholder="Minimum 8 characters"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600">Password strength</span>
                    <span className="font-medium text-gray-700">{getPasswordStrengthText()}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all ${getPasswordStrengthColor()}`}
                      style={{ width: `${passwordStrength() * 25}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  style={{ '--tw-ring-color': 'var(--color-primary, #2563eb)' } as any}
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start">
              <input
                id="terms"
                type="checkbox"
                className="mt-1 w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-offset-0"
                style={{ 
                  accentColor: 'var(--color-primary, #2563eb)',
                  '--tw-ring-color': 'var(--color-primary, #2563eb)' 
                } as any}
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
              />
              <label htmlFor="terms" className="ml-2 text-sm text-gray-600">
                I agree to the{" "}
                <Link 
                  href="/terms" 
                  className="font-medium hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--color-primary, #2563eb)' }}
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link 
                  href="/privacy" 
                  className="font-medium hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--color-primary, #2563eb)' }}
                >
                  Privacy Policy
                </Link>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !agreedToTerms}
              className="w-full flex items-center justify-center py-3 px-4 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 group"
              style={{ backgroundColor: 'var(--color-primary, #2563eb)' }}
            >
              {loading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating your organization...
                </div>
              ) : (
                <>
                  Create Organization
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="text-center">
              <span className="text-sm text-gray-600">
                Already have an account?{" "}
                <Link 
                  href="/auth/login" 
                  className="font-semibold hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--color-primary, #2563eb)' }}
                >
                  Sign in
                </Link>
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}