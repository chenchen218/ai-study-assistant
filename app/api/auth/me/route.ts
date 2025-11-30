import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { getUserIdFromRequest } from "@/lib/auth";

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

        // Get avatar URL if exists
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
            Expires: 3600 * 24 * 7, // 7 days
          });
        }

        return NextResponse.json({
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            provider: user.provider || "local",
            picture: user.picture,
            avatar: user.avatar,
            avatarUrl: avatarUrl,
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
