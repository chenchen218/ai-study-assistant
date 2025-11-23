import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Generates a JWT token for user authentication
 * @param payload - User information to encode in the token (userId, email, role)
 * @returns JWT token string (expires in 7 days)
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

/**
 * Verifies and decodes a JWT token
 * @param token - The JWT token to verify
 * @returns Decoded payload if valid, null if invalid or expired
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Extracts JWT token from request headers or cookies
 * Checks Authorization header (Bearer token) first, then cookies
 * @param request - Next.js request object
 * @returns Token string if found, null otherwise
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  const cookieToken = request.cookies.get("token")?.value;
  return cookieToken || null;
}

/**
 * Gets the user ID from the JWT token in the request
 * @param request - Next.js request object
 * @returns User ID string if authenticated, null otherwise
 */
export function getUserIdFromRequest(request: NextRequest): string | null {
  const token = getTokenFromRequest(request);
  if (!token) return null;

  const payload = verifyToken(token);
  return payload?.userId || null;
}

/**
 * Checks if the request is from an admin user
 * @param request - Next.js request object
 * @returns True if user is admin, false otherwise
 */
export function isAdmin(request: NextRequest): boolean {
  const token = getTokenFromRequest(request);
  if (!token) return false;

  const payload = verifyToken(token);
  return payload?.role === "admin";
}
