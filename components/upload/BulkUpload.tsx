"use client"

import { useState, useRef } from "react"

export interface BulkUploadData {
  headers: string[]
  rows: string[][]
  file: File
}

export interface FieldMapping {
  csvColumn: string
  targetField: string
}

interface BulkUploadProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (data: BulkUploadData, mappings: FieldMapping[]) => void
  type: 'contacts' | 'companies'
  requiredFields: string[]
  availableFields: { key: string; label: string }[]
}

export default function BulkUpload({ 
  isOpen, 
  onClose, 
  onUpload, 
  type, 
  requiredFields, 
  availableFields 
}: BulkUploadProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload')
  const [csvData, setCsvData] = useState<BulkUploadData | null>(null)
  const [mappings, setMappings] = useState<FieldMapping[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      processFile(files[0])
    }
  }

  const processFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please upload a CSV file.')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n').map(line => line.trim()).filter(line => line)
      
      if (lines.length < 2) {
        alert('CSV file must contain at least a header row and one data row.')
        return
      }

      const headers = parseCSVLine(lines[0])
      const rows = lines.slice(1).map(line => parseCSVLine(line))

      const data: BulkUploadData = {
        headers,
        rows: rows.filter(row => row.some(cell => cell.trim())), // Filter out empty rows
        file
      }

      setCsvData(data)
      
      // Auto-generate mappings based on column names
      const autoMappings = generateAutoMappings(headers, availableFields)
      setMappings(autoMappings)
      
      setStep('mapping')
    }

    reader.readAsText(file)
  }

  const parseCSVLine = (line: string): string[] => {
    const result = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    result.push(current.trim())
    return result.map(cell => cell.replace(/^"|"$/g, '')) // Remove surrounding quotes
  }

  const generateAutoMappings = (headers: string[], fields: { key: string; label: string }[]): FieldMapping[] => {
    return headers.map(header => {
      const headerLower = header.toLowerCase().trim()
      
      // Try to find exact matches first
      let targetField = fields.find(field => 
        field.label.toLowerCase() === headerLower || 
        field.key.toLowerCase() === headerLower
      )?.key || ''

      // If no exact match, try partial matches
      if (!targetField) {
        if (headerLower.includes('first') && headerLower.includes('name')) {
          targetField = 'firstName'
        } else if (headerLower.includes('last') && headerLower.includes('name')) {
          targetField = 'lastName'
        } else if (headerLower.includes('email')) {
          targetField = 'email'
        } else if (headerLower.includes('phone')) {
          targetField = 'phone'
        } else if (headerLower.includes('company') || headerLower.includes('organization')) {
          targetField = type === 'companies' ? 'name' : 'company'
        } else if (headerLower.includes('title') || headerLower.includes('position')) {
          targetField = 'title'
        } else if (headerLower.includes('website') || headerLower.includes('url')) {
          targetField = 'website'
        } else if (headerLower.includes('industry')) {
          targetField = 'industry'
        } else if (headerLower.includes('description') || headerLower.includes('notes')) {
          targetField = 'description'
        }
      }

      return {
        csvColumn: header,
        targetField
      }
    })
  }

  const updateMapping = (csvColumn: string, targetField: string) => {
    setMappings(prev => prev.map(mapping => 
      mapping.csvColumn === csvColumn 
        ? { ...mapping, targetField }
        : mapping
    ))
  }

  const validateMappings = (): string[] => {
    const errors = []
    const mappedFields = new Set(mappings.map(m => m.targetField).filter(Boolean))
    
    for (const required of requiredFields) {
      if (!mappedFields.has(required)) {
        const field = availableFields.find(f => f.key === required)
        errors.push(`Required field "${field?.label || required}" is not mapped`)
      }
    }

    return errors
  }

  const handleNext = () => {
    if (step === 'mapping') {
      const errors = validateMappings()
      if (errors.length > 0) {
        alert('Please fix the following mapping errors:\n\n' + errors.join('\n'))
        return
      }
      setStep('preview')
    }
  }

  const handleUpload = () => {
    if (csvData) {
      onUpload(csvData, mappings)
      handleClose()
    }
  }

  const handleClose = () => {
    setStep('upload')
    setCsvData(null)
    setMappings([])
    setIsDragging(false)
    onClose()
  }

  const getPreviewData = () => {
    if (!csvData) return []
    
    return csvData.rows.slice(0, 5).map(row => {
      const record: Record<string, string> = {}
      mappings.forEach(mapping => {
        if (mapping.targetField) {
          const columnIndex = csvData.headers.indexOf(mapping.csvColumn)
          if (columnIndex !== -1) {
            record[mapping.targetField] = row[columnIndex] || ''
          }
        }
      })
      return record
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card border rounded-lg w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            Bulk Upload {type === 'contacts' ? 'Contacts' : 'Companies'}
          </h2>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === 'upload' && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Upload CSV File</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a CSV file containing your {type}. The first row should contain column headers.
                </p>
                
                <div className="bg-muted p-4 rounded-md mb-4">
                  <h4 className="font-medium mb-2">Required Fields:</h4>
                  <ul className="text-sm text-muted-foreground">
                    {requiredFields.map(field => {
                      const fieldLabel = availableFields.find(f => f.key === field)?.label || field
                      return <li key={field}>• {fieldLabel}</li>
                    })}
                  </ul>
                </div>
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleFileUpload}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                  isDragging 
                    ? 'border-primary bg-primary/5 scale-105' 
                    : 'border-muted-foreground/30 hover:border-primary hover:bg-accent/50'
                }`}
              >
                <div className="text-4xl mb-4">📁</div>
                <div className="text-lg font-medium mb-2">
                  {isDragging ? 'Drop CSV file here' : 'Upload CSV File'}
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  Click to browse or drag and drop your CSV file
                </div>
                <div className="text-xs text-muted-foreground">
                  Supported format: .csv
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".csv"
              />
            </div>
          )}

          {step === 'mapping' && csvData && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Map CSV Columns</h3>
                <p className="text-sm text-muted-foreground">
                  Map your CSV columns to the appropriate fields. Required fields are marked with *.
                </p>
              </div>

              <div className="space-y-4">
                {mappings.map((mapping, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{mapping.csvColumn}</div>
                      <div className="text-sm text-muted-foreground">
                        Sample: {csvData.rows[0]?.[csvData.headers.indexOf(mapping.csvColumn)] || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <select
                        value={mapping.targetField}
                        onChange={(e) => updateMapping(mapping.csvColumn, e.target.value)}
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">-- Skip this column --</option>
                        {availableFields.map(field => (
                          <option key={field.key} value={field.key}>
                            {field.label} {requiredFields.includes(field.key) ? '*' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 'preview' && csvData && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Preview Import</h3>
                <p className="text-sm text-muted-foreground">
                  Review the first 5 records before importing {csvData.rows.length} total records.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse border">
                  <thead>
                    <tr className="bg-muted">
                      {availableFields
                        .filter(field => mappings.some(m => m.targetField === field.key))
                        .map(field => (
                          <th key={field.key} className="border p-2 text-left font-medium">
                            {field.label}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getPreviewData().map((record, index) => (
                      <tr key={index}>
                        {availableFields
                          .filter(field => mappings.some(m => m.targetField === field.key))
                          .map(field => (
                            <td key={field.key} className="border p-2 text-sm">
                              {record[field.key] || '-'}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-4 border-t">
          <div className="text-sm text-muted-foreground">
            {step === 'upload' && 'Step 1 of 3: Upload CSV'}
            {step === 'mapping' && `Step 2 of 3: Map Columns (${csvData?.rows.length || 0} records)`}
            {step === 'preview' && `Step 3 of 3: Preview (${csvData?.rows.length || 0} records)`}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 border rounded-md hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            
            {step === 'mapping' && (
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 border rounded-md hover:bg-accent transition-colors"
              >
                Back
              </button>
            )}
            
            {step === 'preview' && (
              <button
                onClick={() => setStep('mapping')}
                className="px-4 py-2 border rounded-md hover:bg-accent transition-colors"
              >
                Back
              </button>
            )}
            
            {step === 'mapping' && (
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Next
              </button>
            )}
            
            {step === 'preview' && (
              <button
                onClick={handleUpload}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Import {csvData?.rows.length} Records
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}