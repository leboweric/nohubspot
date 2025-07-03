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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Prepare email data
    const msg: any = {
      to: to,
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
      to,
      subject,
      messageId: response.headers['x-message-id']
    })

    return NextResponse.json({
      success: true,
      messageId: response.headers['x-message-id'],
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