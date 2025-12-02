/**
 * User Registration API Route
 * 
 * This endpoint handles new user registration with email verification.
 * 
 * Flow:
 * 1. Apply rate limiting to prevent abuse
 * 2. Validate required fields (email, password, name)
 * 3. Validate password strength (minimum 8 characters)
 * 4. Check if user already exists
 * 5. Verify email has been verified (email verification required)
 * 6. Hash password with bcrypt (10 rounds)
 * 7. Create user in database
 * 8. Set admin role if email matches ADMIN_EMAIL env variable
 * 9. Generate JWT token and set in httpOnly cookie
 * 10. Delete email verification record after successful registration
 * 
 * Security Features:
 * - Email verification required before registration
 * - Password hashing with bcrypt (10 rounds)
 * - Password minimum length validation (8 characters)
 * - Rate limiting
 * - JWT tokens in httpOnly cookies
 * 
 * @route POST /api/auth/register
 * @access Public (but requires email verification)
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { EmailVerification } from "@/models/EmailVerification";
import { generateToken } from "@/lib/auth";
import { rateLimiters } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Apply rate limiting to prevent abuse and spam registrations
  const rateLimitResponse = rateLimiters.auth(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    await connectDB();

    // Extract registration data from request body
    const { email, password, name } = await request.json();

    // Validate all required fields are provided
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    // Validate password strength - minimum 8 characters
    // This is a basic security requirement
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // Check if user already exists in database
    // Use toLowerCase() for case-insensitive email matching
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    // Verify that email has been verified before allowing registration
    // This ensures users have access to the email they're registering with
    const verification = await EmailVerification.findOne({
      email: email.toLowerCase(),
      verified: true,
    });

    if (!verification) {
      return NextResponse.json(
        { error: "Email not verified. Please verify your email first." },
        { status: 400 }
      );
    }

    // Delete the email verification record after successful registration
    // This prevents reuse of verification codes
    await EmailVerification.deleteOne({ _id: verification._id });

    // Hash password using bcrypt with 10 salt rounds
    // bcrypt automatically generates a salt and includes it in the hash
    // This ensures even identical passwords have different hashes
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user in database
    // Set role to "admin" if email matches ADMIN_EMAIL environment variable
    // Otherwise set to "user"
    const user = await User.create({
      email: email.toLowerCase(), // Store email in lowercase for consistency
      password: hashedPassword,   // Store hashed password, never plaintext
      name,
      provider: "local",           // Indicates local email/password registration
      role: email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase() ? "admin" : "user",
    });

    // Generate JWT token with user information
    // Token will be used for authentication in subsequent requests
    const token = generateToken({
      userId: String(user._id),
      email: user.email,
      role: user.role,
    });

    // Create success response with user data (excluding password)
    const response = NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 201 }
    );

    // Determine if we should use secure cookies (HTTPS only)
    const protocol = request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
    const isSecure = protocol === "https";

    // Set JWT token in httpOnly cookie
    // This automatically logs the user in after registration
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
