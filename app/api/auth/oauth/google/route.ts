import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering so each invocation can compute the redirect URI
export const dynamic = "force-dynamic";

/**
 * Initiates Google OAuth login flow
 * Redirects user to Google OAuth consent screen
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Build the public-facing base URL, falling back to localhost for local dev
  const protocol =
    request.headers.get("x-forwarded-proto") ||
    (request.url.startsWith("https") ? "https" : "http");
  const host = request.headers.get("host") || request.headers.get("x-forwarded-host");
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (host ? `${protocol}://${host}` : "http://localhost:3000");

  // Allow the caller to override the post-login landing page via ?redirect_uri=
  const redirectUri =
    searchParams.get("redirect_uri") ||
    `${baseUrl}/api/auth/oauth/google/callback`;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Google OAuth not configured" },
      { status: 500 }
    );
  }

  // Ask Google for basic identity (OpenID), email, and profile information
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

