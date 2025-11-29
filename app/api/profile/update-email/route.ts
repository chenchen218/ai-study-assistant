import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { EmailVerification } from "@/models/EmailVerification";
import { getUserIdFromRequest } from "@/lib/auth";
import { sendEmailChangeNotification } from "@/lib/email";

/**
 * PUT /api/profile/update-email
 * Updates the user's email address
 * Requires email verification before updating
 */
export async function PUT(request: NextRequest) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { newEmail, verificationCode } = await request.json();

    if (!newEmail || !verificationCode) {
      return NextResponse.json(
        { error: "New email and verification code are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check if new email is already taken
    const existingUser = await User.findOne({ email: newEmail.toLowerCase() });
    if (existingUser && existingUser._id.toString() !== userId) {
      return NextResponse.json(
        { error: "Email is already in use by another account" },
        { status: 400 }
      );
    }

    // Verify the verification code
    const verification = await EmailVerification.findOne({
      email: newEmail.toLowerCase(),
      code: verificationCode.toString(),
      verified: true,
    });

    if (!verification) {
      return NextResponse.json(
        { error: "Invalid or unverified code. Please verify your new email first." },
        { status: 400 }
      );
    }

    // Get current user to get old email
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const oldEmail = currentUser.email;

    // Update email
    const user = await User.findByIdAndUpdate(
      userId,
      { email: newEmail.toLowerCase() },
      { new: true }
    ).select("-password");

    // Delete verification record
    await EmailVerification.deleteOne({ _id: verification._id });

    // Send notification to old email
    if (oldEmail !== newEmail.toLowerCase()) {
      try {
        await sendEmailChangeNotification(oldEmail, newEmail);
      } catch (emailError) {
        console.error("Failed to send email change notification:", emailError);
        // Don't fail the request if notification fails
      }
    }

    console.log(`✅ Email updated for user ${userId}: ${oldEmail} -> ${newEmail}`);

    return NextResponse.json({
      success: true,
      message: "Email updated successfully",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Error updating email:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

