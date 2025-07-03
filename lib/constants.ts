// Common constants used throughout the application

export const INDUSTRIES = [
  "Accounting",
  "Advertising & Marketing",
  "Agriculture",
  "Architecture & Engineering",
  "Automotive",
  "Banking & Finance",
  "Biotechnology",
  "Construction",
  "Consulting",
  "Consumer Goods",
  "Education",
  "Energy & Utilities",
  "Entertainment & Media",
  "Environmental Services",
  "Fashion & Apparel",
  "Food & Beverage",
  "Government",
  "Healthcare",
  "Hospitality & Tourism",
  "Information Technology",
  "Insurance",
  "Legal Services",
  "Logistics & Transportation",
  "Manufacturing",
  "Mining",
  "Non-Profit",
  "Pharmaceuticals",
  "Real Estate",
  "Retail",
  "Sports & Recreation",
  "Telecommunications",
  "Other"
] as const

export type Industry = typeof INDUSTRIES[number]