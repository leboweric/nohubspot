import { NextResponse } from "next/server"

// This endpoint exists for Railway's healthcheck
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "NoHubSpot CRM API is running",
    timestamp: new Date().toISOString(),
  })
}
