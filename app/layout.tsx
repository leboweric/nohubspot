import type React from "react"
import type { Metadata } from "next"
import AuthGuard from "@/components/AuthGuard"
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
        <AuthGuard requireAuth={false}>
          {children}
        </AuthGuard>
      </body>
    </html>
  )
}
