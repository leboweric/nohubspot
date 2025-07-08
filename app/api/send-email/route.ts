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

    // Create tracking records and email threads for each recipient
    const messageId = response.headers['x-message-id']
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
    
    // Get auth token from request headers (passed from frontend)
    const authHeader = request.headers.get('authorization')
    const authToken = authHeader?.replace('Bearer ', '')
    
    // Debug all headers
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      headers[key] = value.substring(0, 50) + (value.length > 50 ? '...' : '')
    })
    
    console.log('Email tracking setup:', {
      messageId,
      backendUrl,
      hasAuthToken: !!authToken,
      authHeader: authHeader ? 'Present' : 'Missing',
      allHeaders: headers
    })
    
    if (authToken && messageId) {
      console.log('Starting email tracking creation...')
      try {
        // First get current user to get their ID and organization ID
        const userResponse = await fetch(`${backendUrl}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        })
        
        let userId = 1 // fallback
        let organizationId = null
        if (userResponse.ok) {
          const userData = await userResponse.json()
          userId = userData.id
          organizationId = userData.organization_id
          console.log(`Current user ID: ${userId}, Organization ID: ${organizationId}`)
        }
        
        // Create tracking record and email thread for each recipient
        for (const recipientEmail of recipients) {
          // First, try to find the contact by email
          let contactId = null
          const contactsResponse = await fetch(`${backendUrl}/api/contacts?search=${encodeURIComponent(recipientEmail)}`, {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          })
          
          if (contactsResponse.ok) {
            const contacts = await contactsResponse.json()
            console.log(`Found ${contacts.length} contacts when searching for ${recipientEmail}`)
            const matchingContact = contacts.find((c: any) => c.email.toLowerCase() === recipientEmail.toLowerCase())
            contactId = matchingContact?.id
            console.log(`Contact lookup for ${recipientEmail}: found contact ${contactId}`)
          } else {
            console.log(`Contact search failed: ${contactsResponse.status}`)
          }
          
          // Create tracking record
          const trackingData = {
            message_id: messageId,
            to_email: recipientEmail,
            from_email: process.env.SENDGRID_FROM_EMAIL,
            subject: subject,
            sent_at: new Date().toISOString(),
            sent_by: userId,
            contact_id: contactId // Include contact_id if found
          }
          
          console.log('Creating email tracking with data:', JSON.stringify(trackingData, null, 2))
          
          const trackingResponse = await fetch(`${backendUrl}/api/email-tracking`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(trackingData)
          })
          
          const trackingResponseText = await trackingResponse.text()
          console.log(`Tracking response status: ${trackingResponse.status}`)
          console.log(`Tracking response body: ${trackingResponseText}`)
          
          if (!trackingResponse.ok) {
            console.error(`Failed to create tracking record: ${trackingResponse.status} - ${trackingResponseText}`)
          } else {
            console.log(`Email tracking created successfully for ${recipientEmail}`)
            try {
              const trackingResult = JSON.parse(trackingResponseText)
              console.log('Created tracking record:', trackingResult)
            } catch (e) {
              console.log('Could not parse tracking response as JSON')
            }
          }
          
          // Only create thread if we have a contact
          if (contactId) {
            // Find or create email thread for this contact
            const threadsResponse = await fetch(`${backendUrl}/api/contacts/${contactId}/email-threads`, {
              headers: {
                'Authorization': `Bearer ${authToken}`
              }
            })

            let threadId = null
            if (threadsResponse.ok) {
              const threads = await threadsResponse.json()
              // Find thread with same or similar subject
              const existingThread = threads.find((t: any) => 
                t.subject === subject || 
                t.subject.replace(/^Re:\s*/i, '') === subject.replace(/^Re:\s*/i, '')
              )
              threadId = existingThread?.id
            }

            // Create new thread if none exists
            if (!threadId) {
              const threadData = {
                subject: subject,
                contact_id: contactId,
                preview: message.substring(0, 100) + (message.length > 100 ? '...' : '')
              }

            const createThreadResponse = await fetch(`${backendUrl}/api/email-threads`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify(threadData)
            })

            if (createThreadResponse.ok) {
              const newThread = await createThreadResponse.json()
              threadId = newThread.id
            }
          }

          // Add message to thread
          if (threadId) {
            const messageData = {
              sender: senderName || 'Sales Team',
              content: message,
              direction: 'outgoing' as const,
              message_id: messageId,
              thread_id: threadId // Add thread_id to the body as required by schema
            }

            const messageResponse = await fetch(`${backendUrl}/api/email-threads/${threadId}/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify(messageData)
            })
            
            if (!messageResponse.ok) {
              const messageError = await messageResponse.text()
              console.error(`Failed to add message to thread: ${messageResponse.status} - ${messageError}`)
            } else {
              console.log(`Message added to thread ${threadId} successfully`)
            }
          }
          } else {
            console.log(`No contact found for email ${recipientEmail}, skipping thread creation`)
          }
        }
      } catch (error) {
        console.error('Failed to create email tracking/thread records:', error)
        console.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        })
        // Don't fail the email send if tracking fails
      }
    } else {
      console.log('Skipping email tracking:', {
        hasAuthToken: !!authToken,
        hasMessageId: !!messageId,
        messageId
      })
    }

    return NextResponse.json({
      success: true,
      messageId: messageId,
      recipientCount: recipients.length,
      timestamp: new Date().toISOString(),
      debug: {
        trackingCreated: !!authToken && !!messageId,
        backendUrl: backendUrl
      }
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