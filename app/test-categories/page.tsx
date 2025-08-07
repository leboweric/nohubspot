"use client"

import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import TestDocumentCategories from "@/components/TestDocumentCategories"

export default function TestCategoriesPage() {
  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-6">Document Categories Diagnostic</h1>
          <TestDocumentCategories />
          
          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <h3 className="font-semibold mb-2">If the test shows the table doesn't exist:</h3>
            <p className="text-sm">Run this SQL migration:</p>
            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
              {`psql $DATABASE_URL < backend/migrations/add_document_management.sql`}
            </pre>
          </div>
        </div>
      </MainLayout>
    </AuthGuard>
  )
}