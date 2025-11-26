import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { generateToken } from "@/lib/auth";

/**
 * Initiates Google OAuth login flow
 * Redirects user to Google OAuth consent screen
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const redirectUri = searchParams.get("redirect_uri") || `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/auth/oauth/google/callback`;

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

