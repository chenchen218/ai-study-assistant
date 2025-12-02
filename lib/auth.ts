/**
 * Authentication Utility Functions
 * 
 * This module provides JWT-based authentication utilities for the application.
 * It handles token generation, verification, and extraction from requests.
 * 
 * Security Features:
 * - JWT tokens with 7-day expiration
 * - Token extraction from cookies (httpOnly) or Authorization header
 * - Role-based access control (user/admin)
 * 
 * Token Structure:
 * - userId: MongoDB ObjectId of the user
 * - email: User's email address
 * - role: User's role ("user" or "admin")
 * 
 * @module lib/auth
 */

import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

// JWT secret key from environment variables
// In production, this should be a strong, randomly generated string
// Generate with: openssl rand -base64 32
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

/**
 * JWT Token Payload Interface
 * Contains user information encoded in the JWT token
 */
export interface JWTPayload {
  userId: string;  // MongoDB ObjectId as string
  email: string;  // User's email address
  role: string;   // User's role: "user" or "admin"
}

/**
 * Generates a JWT token for user authentication
 * 
 * The token contains user information (userId, email, role) and expires in 7 days.
 * This token is used for stateless authentication - no need to store sessions in database.
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
 * Returns null if token is invalid, expired, or tampered with.
 * 
 * @param token - The JWT token string to verify
 * @returns Decoded payload if valid, null if invalid or expired
 * 
 * @example
 * const payload = verifyToken(token);
 * if (payload) {
 *   console.log("User ID:", payload.userId);
 * }
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
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
 * 1. Authorization header (Bearer token) - for API clients
 * 2. Cookie named "token" - for web browsers
 * 
 * This allows the API to work with both web browsers (cookies) and API clients (headers).
 * 
 * @param request - Next.js request object
 * @returns Token string if found, null otherwise
 * 
 * @example
 * // From Authorization header: "Bearer eyJhbGc..."
 * // From cookie: "token=eyJhbGc..."
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  // Check Authorization header first (for API clients)
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7); // Remove "Bearer " prefix
  }

  // Check cookies (for web browsers)
  // The token is stored in an httpOnly cookie set during login
  const cookieToken = request.cookies.get("token")?.value;
  return cookieToken || null;
}

/**
 * Gets the user ID from the JWT token in the request
 * 
 * This is a convenience function that combines token extraction and verification
 * to get just the user ID. Used for authorization checks.
 * 
 * @param request - Next.js request object
 * @returns User ID string if authenticated, null otherwise
 * 
 * @example
 * const userId = getUserIdFromRequest(request);
 * if (userId) {
 *   // User is authenticated, proceed with request
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
 * Used for admin-only endpoints and features.
 * 
 * @param request - Next.js request object
 * @returns True if user is admin, false otherwise
 * 
 * @example
 * if (isAdmin(request)) {
 *   // Allow admin-only operation
 * } else {
 *   return NextResponse.json({ error: "Admin access required" }, { status: 403 });
 * }
 */
export function isAdmin(request: NextRequest): boolean {
  const token = getTokenFromRequest(request);
  if (!token) return false;

  const payload = verifyToken(token);
  return payload?.role === "admin";
}
