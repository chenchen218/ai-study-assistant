/**
 * Get Current User API Route
 * 
 * This endpoint returns the currently authenticated user's information.
 * It is used by the frontend to check authentication status and populate user state.
 * 
 * Flow:
 * 1. Extract JWT token from request (from httpOnly cookie or Authorization header)
 * 2. Verify token and extract userId using getUserIdFromRequest()
 * 3. Query database to find user by ID
 * 4. Exclude password field from response for security
 * 5. Return user data including id, email, name, role, provider, picture, and createdAt
 * 
 * Security:
 * - Requires valid JWT token (handled by getUserIdFromRequest)
 * - Password field is explicitly excluded from response using .select("-password")
 * - Returns 401 Unauthorized if no valid token is found
 * - Returns 404 Not Found if user doesn't exist (shouldn't happen with valid token)
 * 
 * Usage:
 * - Called on app mount to check authentication status
 * - Used by AuthProvider to populate user state in React context
 * - Called after OAuth redirects to get user information
 * - Can be called periodically to refresh user data
 * 
 * Response Data:
 * - id: MongoDB ObjectId of the user
 * - email: User's email address
 * - name: User's full name
 * - role: User's role ("user" or "admin")
 * - provider: Authentication provider ("local", "google", or "github")
 * - picture: OAuth provider profile picture URL (if available)
 * - createdAt: Account creation timestamp
 * 
 * @route GET /api/auth/me
 * @access Protected (requires authentication)
 * @returns {object} User object (excluding password)
 */

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { getUserIdFromRequest } from "@/lib/auth";

// Force dynamic rendering since we use request.headers for authentication
// This is required for Next.js to properly handle cookies and headers in serverless environments
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Establish connection to MongoDB database
    await connectDB();

    // Extract user ID from JWT token in request
    // This function handles token extraction from cookies or Authorization header
    // and verifies the token is valid and not expired
    // Returns null if no valid token is found
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find user by ID and explicitly exclude password field from response
    // .select("-password") ensures password hash is never sent to client
    // This is a security best practice - never expose password hashes
    const user = await User.findById(userId).select("-password");
    if (!user) {
      // This shouldn't happen if token is valid, but handle it gracefully
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate signed URL for avatar if user has uploaded one
    // This provides temporary access to the S3-stored avatar image
    let avatarUrl = null;
    if (user.avatar) {
      try {
        const AWS = await import("aws-sdk");
        const s3Client = new AWS.default.S3({
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_REGION || "us-east-1",
        });
        avatarUrl = s3Client.getSignedUrl("getObject", {
          Bucket: process.env.AWS_S3_BUCKET_NAME || "ai-study-assistant-documents",
          Key: user.avatar,
          Expires: 3600 * 24 * 7, // 7 days
        });
      } catch (error) {
        console.error("Error generating avatar URL:", error);
      }
    }

    // Return user data (excluding password)
    // Includes all information needed by frontend for user interface
    return NextResponse.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        provider: user.provider || "local", // Default to "local" if not set
        picture: user.picture, // OAuth provider profile picture (if available)
        avatar: user.avatar, // S3 key for user-uploaded avatar
        avatarUrl: avatarUrl, // Signed URL for avatar (temporary access)
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    // Log error for debugging and monitoring
    console.error("Get user error:", error);
    // Return generic error message to prevent information leakage
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
