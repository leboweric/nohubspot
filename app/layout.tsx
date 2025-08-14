import type React from "react"
import type { Metadata } from "next"
import ThemeInitializer from "@/components/ThemeInitializer"
import "./globals.css"

export const metadata: Metadata = {
  title: "NHS CRM",
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
        <ThemeInitializer>
          {children}
        </ThemeInitializer>
      </body>
    </html>
  )
}
