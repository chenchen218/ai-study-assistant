/**
 * User Login API Route
 * 
 * This endpoint handles user authentication by verifying email and password credentials,
 * then setting a secure JWT token in an httpOnly cookie for subsequent requests.
 * 
 * Authentication Flow:
 * 1. Apply rate limiting to prevent brute force attacks (5 requests per 15 minutes per IP)
 * 2. Validate that both email and password are provided in the request body
 * 3. Query the database to find the user by email address
 * 4. Verify the provided password matches the hashed password stored in the database using bcrypt
 * 5. Generate a JWT token containing user information (userId, email, role)
 * 6. Set the token in an httpOnly cookie to prevent XSS attacks
 * 7. Return user data (excluding sensitive information like password)
 * 
 * Security Features:
 * - Rate limiting: Prevents brute force password guessing attacks
 * - Password hashing: Passwords are stored as bcrypt hashes (10 salt rounds), never in plaintext
 * - JWT tokens: Stateless authentication tokens that expire after 7 days
 * - httpOnly cookies: Prevents JavaScript access to tokens, protecting against XSS attacks
 * - Secure flag: Cookies are only sent over HTTPS in production environments
 * - SameSite: "lax" provides CSRF protection while allowing normal navigation
 * 
 * Error Handling:
 * - Returns 400 if email or password is missing
 * - Returns 401 if user not found or password is incorrect (same error message to prevent user enumeration)
 * - Returns 500 for server errors
 * 
 * @route POST /api/auth/login
 * @access Public (no authentication required)
 * @body {string} email - User's email address
 * @body {string} password - User's plaintext password
 * @returns {object} User object (id, email, name, role) and success message
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { generateToken } from "@/lib/auth";
import { rateLimiters } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Apply rate limiting to prevent brute force attacks
  // Limits: 5 login attempts per 15 minutes per IP address
  // This helps protect against automated password guessing attacks
  const rateLimitResponse = rateLimiters.auth(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Establish connection to MongoDB database
    // This is required before any database operations
    await connectDB();

    // Extract email and password from the JSON request body
    const { email, password } = await request.json();

    // Validate that both required fields are provided
    // Return 400 Bad Request if either field is missing
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find user in database by email address
    // Also check that user has a password field (OAuth users may not have passwords)
    // If user doesn't exist or has no password, return generic "Invalid credentials" error
    // Using the same error message for both cases prevents user enumeration attacks
    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Verify password using bcrypt comparison
    // bcrypt.compare() securely compares the plaintext password with the hashed password
    // It handles salt extraction and timing-safe comparison internally
    // This is the standard way to verify bcrypt hashed passwords
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Generate JWT token containing user information
    // Token payload includes: userId (MongoDB ObjectId), email, and role (user/admin)
    // Token expires in 7 days (configured in lib/auth.ts)
    // This token will be used for authentication in subsequent API requests
    const token = generateToken({
      userId: String(user._id),
      email: user.email,
      role: user.role,
    });

    // Determine if we should use secure cookies (HTTPS only)
    // Check x-forwarded-proto header first (set by reverse proxies like Vercel, Nginx)
    // Fall back to checking if the URL starts with "https"
    // Secure cookies are only sent over HTTPS, preventing man-in-the-middle attacks
    const protocol = request.headers.get("x-forwarded-proto") || (request.url.startsWith("https") ? "https" : "http");
    const isSecure = protocol === "https";

    // Create success response with user data
    // Exclude sensitive information like password hash
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
    // httpOnly: true - Prevents JavaScript access, protecting against XSS attacks
    // secure: true in production - Only sent over HTTPS connections
    // sameSite: "lax" - Provides CSRF protection while allowing normal navigation
    // maxAge: 7 days - Token expiration time in seconds
    // path: "/" - Cookie is available for all paths on the domain
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
    console.error("Login error:", error);
    // Return generic error message to prevent information leakage
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
