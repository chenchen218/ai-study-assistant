import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { generateToken } from "@/lib/auth";

// Force dynamic rendering so each request inspects its own callback URL
export const dynamic = "force-dynamic";

/**
 * Handles Google OAuth callback
 * Exchanges authorization code for user info and creates/logs in user
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Get base URL from environment or request headers
    // Reconstruct the public base URL so redirects behave correctly behind proxies
    const protocol = request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
    const host = request.headers.get("host") || request.headers.get("x-forwarded-host");
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (host ? `${protocol}://${host}` : "http://localhost:3000");

    if (error) {
      return NextResponse.redirect(
        `${baseUrl}/login?error=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${baseUrl}/login?error=no_code`
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${baseUrl}/api/auth/oauth/google/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${baseUrl}/login?error=oauth_not_configured`
      );
    }

    // Exchange the one-time authorization code for an access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Google token exchange error:", errorData);
      return NextResponse.redirect(
        `${baseUrl}/login?error=token_exchange_failed`
      );
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;

    // Fetch the Google profile so we can map it to a local user record
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!userInfoResponse.ok) {
      return NextResponse.redirect(
        `${baseUrl}/login?error=user_info_failed`
      );
    }

    const googleUser = await userInfoResponse.json();

    // Locate an existing account or create/link one using the Google identity
    let user = await User.findOne({ googleId: googleUser.id });

    if (!user) {
      // Check if user exists with same email
      const existingUser = await User.findOne({ email: googleUser.email });
      if (existingUser) {
        // Link Google account to existing email-only user to preserve history
        existingUser.googleId = googleUser.id;
        existingUser.provider = "google";
        existingUser.picture = googleUser.picture;
        await existingUser.save();
        user = existingUser;
      } else {
        // Create a brand-new account populated with Google profile data
        user = await User.create({
          email: googleUser.email,
          name: googleUser.name,
          provider: "google",
          googleId: googleUser.id,
          picture: googleUser.picture,
          role: googleUser.email === process.env.ADMIN_EMAIL ? "admin" : "user",
        });
      }
    }

    // Issue our own session token so the rest of the app treats this as a normal login
    const token = generateToken({
      userId: String(user._id),
      email: user.email,
      role: user.role,
    });

    // Send the user to the dashboard once the cookie is set
    const response = NextResponse.redirect(`${baseUrl}/dashboard`);

    // Persist the JWT inside an httpOnly cookie; "secure" depends on the current scheme
    const isSecure = baseUrl.startsWith("https://");
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    console.log("✅ Google OAuth login successful:", {
      userId: user._id,
      email: user.email,
      role: user.role,
    });

    return response;
  } catch (error: any) {
    console.error("Google OAuth callback error:", error);
    // Get base URL for error redirect
    const protocol = request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
    const host = request.headers.get("host") || request.headers.get("x-forwarded-host");
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (host ? `${protocol}://${host}` : "http://localhost:3000");
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent(error.message || "oauth_error")}`
    );
  }
}
