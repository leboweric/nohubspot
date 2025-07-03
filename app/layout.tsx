import type React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import "./globals.css"

export const metadata: Metadata = {
  title: "NotHubSpot CRM",
  description: "A simple CRM system for managing companies and contacts"
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b">
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center space-x-8">
                  <Link href="/" className="text-xl font-semibold">
                    NotHubSpot
                  </Link>
                  <div className="hidden md:flex space-x-6">
                    <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                      Dashboard
                    </Link>
                    <Link href="/companies" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                      Companies
                    </Link>
                    <Link href="/contacts" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                      Contacts
                    </Link>
                    <Link href="/tasks" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                      Tasks
                    </Link>
                    <Link href="/settings" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                      Settings
                    </Link>
                  </div>
                </div>
              </div>
            </nav>
          </header>
          <main className="flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
