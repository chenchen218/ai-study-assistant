import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { getUserIdFromRequest } from "@/lib/auth";
import { uploadToS3, deleteFromS3 } from "@/lib/s3";

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

/**
 * POST /api/profile/avatar
 * Upload user avatar image
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("avatar") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type (only images)
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed." },
        { status: 400 }
      );
    }

    // Validate file size (2MB limit for avatars)
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File is too large. Maximum file size is 2MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.` },
        { status: 400 }
      );
    }

    // Get user to check for existing avatar
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Delete old avatar from S3 if exists
    if (user.avatar) {
      try {
        await deleteFromS3(user.avatar);
      } catch (error) {
        console.error("Error deleting old avatar:", error);
        // Continue even if deletion fails
      }
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to S3 with user-specific path
    const fileName = `avatars/${userId}/${Date.now()}-${file.name}`;
    const { key } = await uploadToS3(buffer, file.name, file.type, fileName);

    // Update user avatar
    user.avatar = key;
    await user.save();

    console.log(`✅ Avatar uploaded for user ${userId}`);

    return NextResponse.json({
      success: true,
      avatar: key,
      message: "Avatar uploaded successfully",
    });
  } catch (error: any) {
    console.error("Error uploading avatar:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile/avatar
 * Delete user avatar
 */
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Delete avatar from S3 if exists
    if (user.avatar) {
      try {
        await deleteFromS3(user.avatar);
      } catch (error) {
        console.error("Error deleting avatar from S3:", error);
        // Continue even if deletion fails
      }
    }

    // Clear avatar field
    user.avatar = undefined;
    await user.save();

    console.log(`✅ Avatar deleted for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: "Avatar deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting avatar:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

