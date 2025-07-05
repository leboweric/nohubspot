import { NextRequest, NextResponse } from 'next/server'
import sgMail from '@sendgrid/mail'

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

export async function POST(request: NextRequest) {
  try {
    // Check if SendGrid is configured
    if (!process.env.SENDGRID_API_KEY) {
      return NextResponse.json(
        { error: 'SendGrid API key not configured' },
        { status: 500 }
      )
    }

    if (!process.env.SENDGRID_FROM_EMAIL) {
      return NextResponse.json(
        { error: 'SendGrid from email not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { to, subject, message, contactName, senderName, senderEmail } = body

    // Validate required fields
    if (!to || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, message' },
        { status: 400 }
      )
    }

    // Handle multiple recipients
    const recipients = Array.isArray(to) ? to : [to]
    
    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    for (const email of recipients) {
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: `Invalid email address: ${email}` },
          { status: 400 }
        )
      }
    }

    // Prepare email data
    const msg: any = {
      to: recipients,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: senderName || process.env.SENDGRID_FROM_NAME || 'Sales Team'
      },
      subject: subject,
      text: message,
      html: message.replace(/\n/g, '<br>'),
      trackingSettings: {
        clickTracking: {
          enable: true
        },
        openTracking: {
          enable: true
        }
      },
      customArgs: {
        contact_name: contactName || '',
        sender_name: senderName || '',
        source: 'nohubspot_crm'
      }
    }

    // Add reply-to - prioritize senderEmail, then env variable
    if (senderEmail || process.env.SENDGRID_REPLY_TO_EMAIL) {
      msg.replyTo = {
        email: senderEmail || process.env.SENDGRID_REPLY_TO_EMAIL,
        name: senderName || process.env.SENDGRID_FROM_NAME || 'Sales Team'
      }
    }

    // Send email via SendGrid
    const [response] = await sgMail.send(msg)

    // Log success
    console.log('Email sent successfully:', {
      to: recipients,
      recipientCount: recipients.length,
      subject,
      messageId: response.headers['x-message-id']
    })

    // Create tracking records for each recipient
    const messageId = response.headers['x-message-id']
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
    
    // Get auth token from cookies
    const authToken = request.cookies.get('auth-token')?.value
    
    if (authToken && messageId) {
      try {
        // Create tracking record for each recipient
        for (const recipientEmail of recipients) {
          const trackingData = {
            message_id: messageId,
            to_email: recipientEmail,
            from_email: process.env.SENDGRID_FROM_EMAIL,
            subject: subject,
            sent_at: new Date().toISOString(),
            sent_by: 1 // This should come from the authenticated user
          }
          
          await fetch(`${backendUrl}/api/email-tracking`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(trackingData)
          })
        }
      } catch (error) {
        console.error('Failed to create email tracking records:', error)
        // Don't fail the email send if tracking fails
      }
    }

    return NextResponse.json({
      success: true,
      messageId: messageId,
      recipientCount: recipients.length,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('SendGrid error:', error)

    // Handle SendGrid specific errors
    if (error.response) {
      const { status, body } = error.response
      return NextResponse.json(
        { 
          error: 'Failed to send email',
          details: body.errors || [{ message: 'Unknown SendGrid error' }]
        },
        { status }
      )
    }

    // Handle other errors
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}