import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    sendgridConfigured: !!process.env.SENDGRID_API_KEY,
    sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL || 'not set',
    sendgridFromName: process.env.SENDGRID_FROM_NAME || 'not set',
    // Don't expose the actual API key for security
    sendgridKeyPrefix: process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.substring(0, 6) + '...' : 'not set',
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  })
}