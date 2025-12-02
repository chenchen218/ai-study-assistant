import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { generateToken } from "@/lib/auth";

// Force dynamic rendering since we use request.url
export const dynamic = 'force-dynamic';

/**
 * Initiates Google OAuth login flow
 * Redirects user to Google OAuth consent screen
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Get base URL from environment or request headers
  const protocol = request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
  const host = request.headers.get("host") || request.headers.get("x-forwarded-host");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (host ? `${protocol}://${host}` : "http://localhost:3000");
  
  const redirectUri = searchParams.get("redirect_uri") || `${baseUrl}/api/auth/oauth/google/callback`;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Google OAuth not configured" },
      { status: 500 }
    );
  }

  const scope = "openid email profile";
  const state = Buffer.from(JSON.stringify({ redirect_uri: redirectUri })).toString("base64");
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    state,
    access_type: "offline",
    prompt: "consent",
  })}`;

  return NextResponse.redirect(authUrl);
}

