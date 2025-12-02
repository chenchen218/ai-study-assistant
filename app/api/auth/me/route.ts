/**
 * Get Current User API Route
 * 
 * This endpoint returns the currently authenticated user's information.
 * It's used by the frontend to check authentication status and get user data.
 * 
 * Flow:
 * 1. Extract JWT token from request (cookie or Authorization header)
 * 2. Verify token and extract userId
 * 3. Find user in database (excluding password field)
 * 4. Generate signed URL for avatar if user has one stored in S3
 * 5. Return user data
 * 
 * Security:
 * - Requires valid JWT token (handled by getUserIdFromRequest)
 * - Password field is excluded from response
 * - Avatar URLs are signed with 7-day expiration
 * 
 * Usage:
 * - Called on app mount to check auth status
 * - Used by AuthProvider to populate user state
 * - Called after OAuth redirects to get user info
 * 
 * @route GET /api/auth/me
 * @access Protected (requires authentication)
 */

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { getUserIdFromRequest } from "@/lib/auth";

// Force dynamic rendering since we use request.headers
// This is required for Next.js to properly handle cookies and headers
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // Extract user ID from JWT token in request
    // This function handles token extraction from cookies or Authorization header
    // and verifies the token is valid
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find user by ID and exclude password field from response
    // .select("-password") ensures password hash is never sent to client
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate signed URL for avatar if user has one stored in S3
    // Signed URLs allow temporary access to private S3 objects
    // Expires after 7 days for security
    let avatarUrl = null;
    if (user.avatar) {
      const AWS = await import("aws-sdk");
      const s3Client = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || "us-east-1",
      });
      avatarUrl = s3Client.getSignedUrl("getObject", {
        Bucket: process.env.AWS_S3_BUCKET_NAME || "ai-study-assistant-documents",
        Key: user.avatar,
        Expires: 3600 * 24 * 7, // 7 days in seconds
      });
    }

    // Return user data (excluding password)
    // Includes all user information needed by frontend
    return NextResponse.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        provider: user.provider || "local",
        picture: user.picture,        // OAuth provider profile picture
        avatar: user.avatar,          // S3 key for uploaded avatar
        avatarUrl: avatarUrl,         // Signed URL for avatar access
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
