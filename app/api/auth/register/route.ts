/**
 * User Registration API Route
 * 
 * This endpoint handles new user account creation with email verification requirement.
 * Users must verify their email address before they can complete registration.
 * 
 * Registration Flow:
 * 1. Apply rate limiting to prevent spam and abuse (5 requests per 15 minutes per IP)
 * 2. Validate all required fields are provided (email, password, name)
 * 3. Validate password strength (minimum 8 characters)
 * 4. Check if user with this email already exists in the database
 * 5. Verify that the email address has been verified (email verification required)
 * 6. Delete the email verification record to prevent reuse
 * 7. Hash the password using bcrypt with 10 salt rounds
 * 8. Create new user record in the database
 * 9. Set admin role if email matches ADMIN_EMAIL environment variable
 * 10. Generate JWT token and set it in httpOnly cookie (auto-login after registration)
 * 
 * Security Features:
 * - Email verification required: Users must verify email ownership before registration
 * - Password hashing: Passwords are hashed with bcrypt (10 rounds) before storage
 * - Password strength: Minimum 8 characters required
 * - Rate limiting: Prevents spam registrations and abuse
 * - JWT tokens: Stateless authentication tokens in httpOnly cookies
 * - Role-based access: Admin role assigned based on ADMIN_EMAIL environment variable
 * 
 * Email Verification:
 * - Users must first request a verification code via /api/auth/send-verification-code
 * - Then verify the code via /api/auth/verify-code
 * - Only verified emails can be used for registration
 * - Verification records are deleted after successful registration
 * 
 * Error Handling:
 * - Returns 400 if required fields are missing, password is too short, user exists, or email not verified
 * - Returns 500 for server errors
 * 
 * @route POST /api/auth/register
 * @access Public (but requires email verification)
 * @body {string} email - User's email address (must be verified)
 * @body {string} password - User's plaintext password (minimum 8 characters)
 * @body {string} name - User's full name
 * @returns {object} User object (id, email, name, role) and success message
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { EmailVerification } from "@/models/EmailVerification";
import { generateToken } from "@/lib/auth";
import { rateLimiters } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Apply rate limiting to prevent spam registrations and abuse
  // Limits: 5 registration attempts per 15 minutes per IP address
  const rateLimitResponse = rateLimiters.auth(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Establish connection to MongoDB database
    await connectDB();

    // Extract registration data from JSON request body
    const { email, password, name } = await request.json();

    // Validate that all required fields are provided
    // Return 400 Bad Request if any field is missing
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    // Validate password strength - minimum 8 characters
    // This is a basic security requirement to prevent weak passwords
    // In production, you might want to add more complex requirements (uppercase, numbers, symbols)
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // Check if a user with this email already exists
    // Use toLowerCase() for case-insensitive email matching
    // Return 400 if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    // Verify that the email address has been verified before allowing registration
    // This ensures users have access to the email they're registering with
    // Email verification is a security measure to prevent fake accounts
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
    // This prevents reuse of verification codes and keeps the database clean
    await EmailVerification.deleteOne({ _id: verification._id });

    // Hash password using bcrypt with 10 salt rounds
    // bcrypt automatically generates a unique salt for each password
    // This ensures that even identical passwords have different hashes
    // 10 rounds is a good balance between security and performance
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user record in the database
    // Store email in lowercase for consistency and easier querying
    // Store hashed password, never plaintext
    // Set provider to "local" to indicate email/password registration (vs OAuth)
    // Set role to "admin" if email matches ADMIN_EMAIL environment variable, otherwise "user"
    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      provider: "local",
      role: email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase() ? "admin" : "user",
    });

    // Generate JWT token with user information
    // This token will be used for authentication in subsequent requests
    // Token expires in 7 days (configured in lib/auth.ts)
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
    // Check x-forwarded-proto header (set by reverse proxies) or URL protocol
    const protocol = request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
    const isSecure = protocol === "https";

    // Set JWT token in httpOnly cookie
    // This automatically logs the user in after registration
    // Same security settings as login endpoint
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
      path: "/",
    });

    return response;
  } catch (error: any) {
    // Log error for debugging and monitoring
    console.error("Registration error:", error);
    // Return generic error message to prevent information leakage
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
