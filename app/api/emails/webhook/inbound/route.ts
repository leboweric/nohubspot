import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

interface ParsedEmail {
  to: string
  from: string
  subject: string
  text?: string
  html?: string
  envelope?: string
  headers?: string
  'attachment-info'?: string
  attachments?: number
}

export async function POST(request: NextRequest) {
  try {
    // Get form data from SendGrid
    const formData = await request.formData()
    
    // Parse the email data
    const emailData: ParsedEmail = {
      to: formData.get('to') as string || '',
      from: formData.get('from') as string || '',
      subject: formData.get('subject') as string || '',
      text: formData.get('text') as string || '',
      html: formData.get('html') as string || '',
      envelope: formData.get('envelope') as string || '',
      headers: formData.get('headers') as string || '',
    }

    console.log('Received inbound email:', {
      to: emailData.to,
      from: emailData.from,
      subject: emailData.subject,
      hasText: !!emailData.text,
      hasHtml: !!emailData.html
    })

    // Parse the envelope to get more details
    let envelopeData: any = {}
    if (emailData.envelope) {
      try {
        envelopeData = JSON.parse(emailData.envelope)
      } catch (e) {
        console.error('Failed to parse envelope:', e)
      }
    }

    // Extract the sender's email address
    const fromMatch = emailData.from.match(/<(.+)>/)
    const senderEmail = fromMatch ? fromMatch[1] : emailData.from

    // Extract recipient email(s)
    const toMatch = emailData.to.match(/<(.+)>/)
    const recipientEmail = toMatch ? toMatch[1] : emailData.to

    // Get the message content (prefer text over HTML)
    const messageContent = emailData.text || emailData.html || ''

    // Backend API call to process the inbound email
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
    
    // We'll need to authenticate - for now, we'll use a system token or API key
    // You might want to add a WEBHOOK_SECRET to verify this is from SendGrid
    const webhookSecret = process.env.SENDGRID_WEBHOOK_SECRET
    
    // Create the inbound email record
    const inboundData = {
      from_email: senderEmail,
      to_email: recipientEmail,
      subject: emailData.subject,
      content: messageContent,
      raw_headers: emailData.headers,
      envelope: envelopeData,
      source: 'sendgrid_inbound'
    }

    console.log('Processing inbound email:', {
      from: senderEmail,
      to: recipientEmail,
      subject: emailData.subject
    })

    // Call backend to process the email
    const response = await fetch(`${backendUrl}/api/webhooks/inbound-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': webhookSecret || '',
      },
      body: JSON.stringify(inboundData)
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Backend failed to process inbound email:', error)
      // Still return 200 to SendGrid to prevent retries
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to process email',
        details: error
      })
    }

    const result = await response.json()
    console.log('Inbound email processed successfully:', result)

    return NextResponse.json({ 
      success: true,
      message: 'Email received and processed',
      threadId: result.thread_id,
      messageId: result.message_id
    })

  } catch (error) {
    console.error('Error processing inbound email:', error)
    // Return 200 to prevent SendGrid from retrying
    return NextResponse.json({ 
      success: false, 
      error: 'Internal error processing email' 
    })
  }
}

// SendGrid will only POST to this endpoint
export async function GET() {
  return NextResponse.json({ 
    message: 'SendGrid Inbound Email Webhook - POST only' 
  })
}