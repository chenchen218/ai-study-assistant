import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { OAuth2Client } from "google-auth-library";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

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

export async function verifyGoogleToken(
  idToken: string
): Promise<{
  email: string;
  name: string;
  googleId: string;
  picture?: string;
} | null> {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) return null;

    return {
      email: payload.email || "",
      name: payload.name || "",
      googleId: payload.sub,
      picture: payload.picture,
    };
  } catch (error) {
    console.error("Error verifying Google token:", error);
    return null;
  }
}
