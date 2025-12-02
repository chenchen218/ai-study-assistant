/**
 * User Login API Route
 * 
 * This endpoint handles user authentication by verifying credentials
 * and setting a secure JWT token in an httpOnly cookie.
 * 
 * Flow:
 * 1. Apply rate limiting to prevent brute force attacks
 * 2. Validate email and password are provided
 * 3. Find user in database by email
 * 4. Verify password using bcrypt comparison
 * 5. Generate JWT token with user info (userId, email, role)
 * 6. Set token in httpOnly cookie for security
 * 7. Return user data (without password)
 * 
 * Security Features:
 * - Rate limiting to prevent brute force attacks
 * - Password hashing with bcrypt (10 rounds)
 * - JWT tokens stored in httpOnly cookies (XSS protection)
 * - Secure flag set based on protocol (HTTPS in production)
 * - SameSite: "lax" for CSRF protection
 * 
 * @route POST /api/auth/login
 * @access Public
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { generateToken } from "@/lib/auth";
import { rateLimiters } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Apply rate limiting to prevent brute force attacks
  // Limits: 5 requests per 15 minutes per IP
  const rateLimitResponse = rateLimiters.auth(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Connect to MongoDB database
    await connectDB();

    // Extract email and password from request body
    const { email, password } = await request.json();

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find user by email in database
    // Note: We check both user existence and password field
    // (OAuth users may not have passwords)
    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Verify password using bcrypt comparison
    // bcrypt.compare() securely compares plaintext password with hashed password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Generate JWT token containing user information
    // Token includes: userId, email, and role (for authorization)
    // Expires in 7 days (configured in lib/auth.ts)
    const token = generateToken({
      userId: String(user._id),
      email: user.email,
      role: user.role,
    });

    // Determine if we should use secure cookies (HTTPS only)
    // Check x-forwarded-proto header (set by reverse proxies like Vercel)
    // or check if URL starts with https
    const protocol = request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
    const isSecure = protocol === "https";

    // Create success response with user data (excluding password)
    const response = NextResponse.json(
      {
        message: "Login successful",
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 200 }
    );

    // Set JWT token in httpOnly cookie
    // httpOnly: true - Prevents JavaScript access (XSS protection)
    // secure: true in production - Only sent over HTTPS
    // sameSite: "lax" - CSRF protection
    // maxAge: 7 days - Token expiration time
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
