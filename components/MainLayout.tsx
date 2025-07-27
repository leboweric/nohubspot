"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { getAuthState, logout, isAdmin } from "@/lib/auth"
import FloatingSupportButton from "./FloatingSupportButton"

interface MainLayoutProps {
  children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, organization, isAuthenticated } = getAuthState()

  const handleLogout = () => {
    logout()
  }

  const navigation = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Companies", href: "/companies" },
    { name: "Contacts", href: "/contacts" },
    { name: "Calendar", href: "/calendar" },
    { name: "Tasks", href: "/tasks" },
    { name: "Pipeline", href: "/pipeline" },
    { name: "Projects", href: "/projects" },
    { name: "Templates", href: "/templates" },
    { name: "Settings", href: "/settings" },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="text-xl font-semibold text-blue-600">
                <span className="font-bold">NHS</span>
              </Link>
              
              {isAuthenticated && (
                <>
                  <div className="hidden md:flex space-x-6">
                    {navigation.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`text-sm font-medium transition-colors ${
                          pathname === item.href
                            ? "text-blue-600 border-b-2 border-blue-600 pb-4"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>

                </>
              )}
            </div>

            {isAuthenticated && user ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">
                      {user.first_name?.[0] || user.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden md:block">
                    <div className="text-sm font-medium text-gray-900">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {user.role === 'owner' ? 'Owner' : 
                       user.role === 'admin' ? 'Admin' : 
                       user.role === 'user' ? 'User' : 'Read Only'}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={handleLogout}
                  className="text-sm text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded transition-colors"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  href="/auth/login"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/register"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu */}
          {isAuthenticated && (
            <div className="md:hidden border-t pt-4 pb-4">
              <div className="flex flex-col space-y-2">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`text-sm font-medium px-2 py-1 rounded transition-colors ${
                      pathname === item.href
                        ? "text-blue-600 bg-blue-50"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
                
                {/* Mobile user info and logout */}
                <div className="border-t pt-3 mt-3">
                  {user && (
                    <div className="flex items-center space-x-3 px-2 py-2">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {user.first_name?.[0] || user.email[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.role === 'owner' ? 'Owner' : 
                           user.role === 'admin' ? 'Admin' : 
                           user.role === 'user' ? 'User' : 'Read Only'}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-2 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          )}
        </nav>
      </header>

      <main className="flex-1 bg-gray-50">
        {children}
      </main>

      {/* Floating Support Button - only show when authenticated */}
      {isAuthenticated && <FloatingSupportButton />}
    </div>
  )
}