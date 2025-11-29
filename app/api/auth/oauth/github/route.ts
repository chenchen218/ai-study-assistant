import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering since we use request.url
export const dynamic = 'force-dynamic';

/**
 * Initiates GitHub OAuth login flow
 * Redirects user to GitHub OAuth consent screen
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Get base URL from environment or request headers
  const protocol = request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
  const host = request.headers.get("host") || request.headers.get("x-forwarded-host");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (host ? `${protocol}://${host}` : "http://localhost:3000");
  
  const redirectUri = searchParams.get("redirect_uri") || `${baseUrl}/api/auth/oauth/github/callback`;

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub OAuth not configured" },
      { status: 500 }
    );
  }

  const scope = "user:email";
  const state = Buffer.from(JSON.stringify({ redirect_uri: redirectUri })).toString("base64");
  
  const authUrl = `https://github.com/login/oauth/authorize?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
  })}`;

  return NextResponse.redirect(authUrl);
}

