import { NextRequest, NextResponse } from "next/server";

/**
 * Initiates GitHub OAuth login flow
 * Redirects user to GitHub OAuth consent screen
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const redirectUri = searchParams.get("redirect_uri") || `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/auth/oauth/github/callback`;

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

