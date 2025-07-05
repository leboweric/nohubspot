import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Verify SendGrid webhook signature
function verifySignature(
  publicKey: string,
  payload: string,
  signature: string,
  timestamp: string
): boolean {
  const timestampPayload = timestamp + payload
  const decoder = new TextDecoder()
  
  // Convert public key to proper format
  const keyObject = crypto.createPublicKey({
    key: `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`,
    format: 'pem'
  })

  // Decode the signature
  const signatureBuffer = Buffer.from(signature, 'base64')
  
  // Verify the signature
  const verify = crypto.createVerify('RSA-SHA256')
  verify.update(timestampPayload)
  
  return verify.verify(keyObject, signatureBuffer)
}

export async function POST(request: NextRequest) {
  try {
    // Get SendGrid signature headers
    const signature = request.headers.get('X-Twilio-Email-Event-Webhook-Signature')
    const timestamp = request.headers.get('X-Twilio-Email-Event-Webhook-Timestamp')
    
    // Get raw body for signature verification
    const rawBody = await request.text()
    
    // Verify webhook signature if webhook verification key is set
    if (process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY) {
      if (!signature || !timestamp) {
        console.error('Missing SendGrid webhook signature headers')
        return NextResponse.json(
          { error: 'Missing signature headers' },
          { status: 401 }
        )
      }
      
      const isValid = verifySignature(
        process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY,
        rawBody,
        signature,
        timestamp
      )
      
      if (!isValid) {
        console.error('Invalid SendGrid webhook signature')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    }
    
    // Parse the JSON payload
    const events = JSON.parse(rawBody)
    
    // Process each event
    for (const event of events) {
      console.log('Processing SendGrid event:', {
        type: event.event,
        email: event.email,
        messageId: event.sg_message_id,
        timestamp: event.timestamp
      })
      
      // Forward to backend API
      try {
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
        const response = await fetch(`${backendUrl}/api/email-tracking/webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event)
        })
        
        if (!response.ok) {
          const error = await response.text()
          console.error('Backend webhook processing failed:', error)
        }
      } catch (error) {
        console.error('Failed to forward event to backend:', error)
      }
    }
    
    // SendGrid expects 200 OK response
    return NextResponse.json({ received: true })
    
  } catch (error) {
    console.error('SendGrid webhook error:', error)
    // Return 200 to prevent SendGrid from retrying on errors
    return NextResponse.json({ received: true, error: 'Processing error' })
  }
}