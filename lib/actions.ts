"use server"

import { revalidatePath } from "next/cache"
import { companies, contacts, emailThreads, attachments, activities } from "./mock-data"

// Remove the uuid import and use a simple ID generator instead
function generateId() {
  return Math.random().toString(36).substr(2, 9)
}

export async function createCompany(formData: FormData) {
  // In a real app, this would save to a database
  const name = formData.get("name") as string
  const industry = formData.get("industry") as string
  const website = formData.get("website") as string
  const description = formData.get("description") as string
  const address = formData.get("address") as string
  const status = formData.get("status") as string

  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 1000))

  console.log("Creating company:", { name, industry, website, description, address, status })

  const id = generateId()
  const newCompany = {
    id,
    name,
    industry,
    website,
    description,
    address,
    status,
    contactCount: 0,
    attachmentCount: 0,
    createdAt: new Date().toISOString(),
  }

  companies.push(newCompany)

  // Add activity
  activities.push({
    id: generateId(),
    title: "Company Added",
    description: `Added ${name} as a new company`,
    type: "company",
    entityId: id,
    date: new Date().toISOString(),
  })

  revalidatePath("/companies")
  return id
}

export async function createContact(formData: FormData) {
  // In a real app, this would save to a database
  const firstName = formData.get("firstName") as string
  const lastName = formData.get("lastName") as string
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const title = formData.get("title") as string
  const companyId = formData.get("companyId") as string
  const status = formData.get("status") as string
  const notes = formData.get("notes") as string

  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 1000))

  console.log("Creating contact:", { firstName, lastName, email, phone, title, companyId, status, notes })

  // Get company name
  const company = companies.find((c) => c.id === companyId)
  if (!company) throw new Error("Company not found")

  const id = generateId()
  const newContact = {
    id,
    firstName,
    lastName,
    email,
    phone,
    title,
    companyId,
    companyName: company.name,
    status,
    notes,
    createdAt: new Date().toISOString(),
  }

  contacts.push(newContact)

  // Update company contact count
  company.contactCount += 1

  // Add activity
  activities.push({
    id: generateId(),
    title: "Contact Added",
    description: `Added ${firstName} ${lastName} as a new contact`,
    type: "contact",
    entityId: id,
    date: new Date().toISOString(),
  })

  revalidatePath("/contacts")
  revalidatePath(`/companies/${companyId}`)
  return id
}

export async function createEmailThread(data: {
  contactId: string
  subject: string
  content: string
}) {
  // In a real app, this would save to a database
  const threadId = generateId()
  const messageId = generateId()
  const timestamp = new Date().toISOString()

  const newThread = {
    id: threadId,
    subject: data.subject,
    contactId: data.contactId,
    preview: data.content.substring(0, 100) + (data.content.length > 100 ? "..." : ""),
    messageCount: 1,
    createdAt: timestamp,
    messages: [
      {
        id: messageId,
        threadId,
        sender: "Sales Rep",
        content: data.content,
        direction: "outgoing" as const,
        timestamp,
      },
    ],
  }

  emailThreads.push(newThread)

  // Add activity
  const contact = contacts.find((c) => c.id === data.contactId)
  activities.push({
    id: generateId(),
    title: "Email Sent",
    description: `Sent email to ${contact?.firstName} ${contact?.lastName}`,
    type: "email",
    entityId: messageId,
    date: timestamp,
  })

  revalidatePath(`/contacts/${data.contactId}`)
  return threadId
}

export async function replyToEmailThread(data: {
  threadId: string
  contactId: string
  content: string
}) {
  // In a real app, this would save to a database
  const messageId = generateId()
  const timestamp = new Date().toISOString()

  const thread = emailThreads.find((t) => t.id === data.threadId)
  if (!thread) throw new Error("Thread not found")

  const newMessage = {
    id: messageId,
    threadId: data.threadId,
    sender: "Sales Rep",
    content: data.content,
    direction: "outgoing" as const,
    timestamp,
  }

  thread.messages.push(newMessage)
  thread.messageCount += 1
  thread.preview = data.content.substring(0, 100) + (data.content.length > 100 ? "..." : "")

  // Add activity
  const contact = contacts.find((c) => c.id === data.contactId)
  activities.push({
    id: generateId(),
    title: "Email Sent",
    description: `Replied to ${contact?.firstName} ${contact?.lastName}`,
    type: "email",
    entityId: messageId,
    date: timestamp,
  })

  revalidatePath(`/contacts/${data.contactId}`)
  return messageId
}

export async function uploadAttachment(formData: FormData) {
  // In a real app, this would upload to storage and save metadata to a database
  const id = generateId()
  const file = formData.get("file") as File
  const description = formData.get("description") as string
  const companyId = formData.get("companyId") as string
  const timestamp = new Date().toISOString()

  const newAttachment = {
    id,
    name: file.name,
    description,
    size: file.size,
    type: file.type,
    url: "#", // In a real app, this would be the URL to the uploaded file
    companyId,
    uploadedAt: timestamp,
    uploadedBy: "Sales Rep",
  }

  attachments.push(newAttachment)

  // Update company attachment count
  const company = companies.find((c) => c.id === companyId)
  if (company) {
    company.attachmentCount += 1
  }

  // Add activity
  activities.push({
    id: generateId(),
    title: "Attachment Uploaded",
    description: `Uploaded ${file.name}`,
    type: "attachment",
    entityId: id,
    date: timestamp,
  })

  revalidatePath(`/companies/${companyId}`)
  return id
}
