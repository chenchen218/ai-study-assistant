/**
 * Authentication Utility Functions
 * 
 * This module provides JWT-based authentication utilities for the application.
 * It handles token generation, verification, and extraction from HTTP requests.
 * 
 * JWT (JSON Web Token) Overview:
 * - Stateless authentication: No need to store sessions in database
 * - Self-contained: Token contains all necessary user information
 * - Signed: Tokens are cryptographically signed to prevent tampering
 * - Expires: Tokens expire after 7 days for security
 * 
 * Security Features:
 * - JWT tokens with 7-day expiration
 * - Token extraction from httpOnly cookies (XSS protection) or Authorization header (API clients)
 * - Role-based access control (user/admin)
 * - Cryptographic signing with secret key
 * 
 * Token Structure:
 * The JWT payload contains:
 * - userId: MongoDB ObjectId of the user (as string)
 * - email: User's email address
 * - role: User's role ("user" or "admin")
 * 
 * Token Storage:
 * - Primary: httpOnly cookie (for web browsers) - prevents XSS attacks
 * - Fallback: Authorization header with "Bearer" prefix (for API clients)
 * 
 * @module lib/auth
 */

import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

// JWT secret key from environment variables
// In production, this should be a strong, randomly generated string
// Generate with: openssl rand -base64 32
// This secret is used to sign and verify JWT tokens
// If the secret is compromised, all tokens become invalid
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

/**
 * JWT Token Payload Interface
 * 
 * Defines the structure of data encoded in JWT tokens.
 * This information is available in the token without needing a database lookup.
 */
export interface JWTPayload {
  userId: string;  // MongoDB ObjectId as string
  email: string;   // User's email address
  role: string;    // User's role: "user" or "admin"
}

/**
 * Generates a JWT token for user authentication
 * 
 * Creates a signed JWT token containing user information that can be used
 * for stateless authentication. The token is self-contained and doesn't require
 * database lookups for basic authentication checks.
 * 
 * Token Expiration:
 * - Tokens expire after 7 days
 * - After expiration, users must log in again
 * - This balances security (shorter expiration) with user experience (longer expiration)
 * 
 * @param payload - User information to encode in the token
 * @returns JWT token string (expires in 7 days)
 * 
 * @example
 * const token = generateToken({
 *   userId: "507f1f77bcf86cd799439011",
 *   email: "user@example.com",
 *   role: "user"
 * });
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

/**
 * Verifies and decodes a JWT token
 * 
 * Validates the token signature and expiration, then returns the decoded payload.
 * This function ensures the token hasn't been tampered with and hasn't expired.
 * 
 * Verification Process:
 * 1. Check token signature matches the secret key
 * 2. Check token hasn't expired
 * 3. Return decoded payload if valid
 * 4. Return null if invalid, expired, or tampered with
 * 
 * @param token - The JWT token string to verify
 * @returns Decoded payload if valid, null if invalid or expired
 * 
 * @example
 * const payload = verifyToken(token);
 * if (payload) {
 *   console.log("User ID:", payload.userId);
 *   console.log("Role:", payload.role);
 * }
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    // jwt.verify() throws an error if token is invalid, expired, or tampered with
    // We catch the error and return null instead
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    // Token is invalid, expired, or tampered with
    return null;
  }
}

/**
 * Extracts JWT token from request headers or cookies
 * 
 * Checks multiple sources for the token in order of preference:
 * 1. Authorization header with "Bearer" prefix (for API clients)
 * 2. Cookie named "token" (for web browsers)
 * 
 * This dual approach allows the API to work with both:
 * - Web browsers: Use httpOnly cookies (more secure, XSS protection)
 * - API clients: Use Authorization header (more flexible, standard practice)
 * 
 * @param request - Next.js request object
 * @returns Token string if found, null otherwise
 * 
 * @example
 * // From Authorization header: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * // From cookie: "token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  // Check Authorization header first (for API clients)
  // Format: "Bearer <token>"
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7); // Remove "Bearer " prefix
  }

  // Check cookies (for web browsers)
  // The token is stored in an httpOnly cookie set during login/registration
  // httpOnly cookies cannot be accessed by JavaScript, providing XSS protection
  const cookieToken = request.cookies.get("token")?.value;
  return cookieToken || null;
}

/**
 * Gets the user ID from the JWT token in the request
 * 
 * This is a convenience function that combines token extraction and verification
 * to get just the user ID. It's commonly used for authorization checks and
 * database queries that need to filter by user.
 * 
 * Flow:
 * 1. Extract token from request (cookie or header)
 * 2. Verify token is valid and not expired
 * 3. Extract userId from token payload
 * 4. Return userId or null if authentication fails
 * 
 * @param request - Next.js request object
 * @returns User ID string if authenticated, null otherwise
 * 
 * @example
 * const userId = getUserIdFromRequest(request);
 * if (userId) {
 *   // User is authenticated, proceed with request
 *   const documents = await Document.find({ userId });
 * }
 */
export function getUserIdFromRequest(request: NextRequest): string | null {
  const token = getTokenFromRequest(request);
  if (!token) return null;

  const payload = verifyToken(token);
  return payload?.userId || null;
}

/**
 * Checks if the request is from an admin user
 * 
 * Verifies the JWT token and checks if the user's role is "admin".
 * This is used for admin-only endpoints and features that require elevated privileges.
 * 
 * Admin Role:
 * - Assigned during registration if email matches ADMIN_EMAIL environment variable
 * - Can be manually changed in database if needed
 * - Provides access to admin dashboard and system statistics
 * 
 * @param request - Next.js request object
 * @returns True if user is admin, false otherwise
 * 
 * @example
 * if (isAdmin(request)) {
 *   // Allow admin-only operation
 *   return NextResponse.json({ stats: adminStats });
 * } else {
 *   return NextResponse.json(
 *     { error: "Admin access required" },
 *     { status: 403 }
 *   );
 * }
 */
export function isAdmin(request: NextRequest): boolean {
  const token = getTokenFromRequest(request);
  if (!token) return false;

  const payload = verifyToken(token);
  return payload?.role === "admin";
}
