import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  const cookieToken = request.cookies.get("token")?.value;
  return cookieToken || null;
}

export function getUserIdFromRequest(request: NextRequest): string | null {
  const token = getTokenFromRequest(request);
  if (!token) return null;

  const payload = verifyToken(token);
  return payload?.userId || null;
}

export function isAdmin(request: NextRequest): boolean {
  const token = getTokenFromRequest(request);
  if (!token) return false;

  const payload = verifyToken(token);
  return payload?.role === "admin";
}
