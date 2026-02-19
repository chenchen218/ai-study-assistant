import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { EmailVerification } from "@/models/EmailVerification";
import { getUserIdFromRequest } from "@/lib/auth";
import { sendEmailChangeNotification } from "@/lib/email";
import { z } from "zod";
import { validateRequestWithError } from "@/lib/validations";

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

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

    // Extract and validate email update data from request body
    const updateEmailSchema = z.object({
      newEmail: z.string().min(1, "Email is required").email("Invalid email format").toLowerCase().max(255),
      verificationCode: z.string().min(1, "Verification code is required").regex(/^\d{6}$/, "Verification code must be 6 digits"),
    });

    const body = await request.json();
    const validation = validateRequestWithError(updateEmailSchema, body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }

    const { newEmail, verificationCode } = validation.data;

    // Check if new email is already taken
    const existingUser = await User.findOne({ email: newEmail }); // Already lowercased by Zod
    if (existingUser && String(existingUser._id) !== userId) {
      return NextResponse.json(
        { error: "Email is already in use by another account" },
        { status: 400 }
      );
    }

    // Verify the verification code
    const verification = await EmailVerification.findOne({
      email: newEmail, // Already lowercased by Zod
      code: verificationCode,
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
      { email: newEmail }, // Already lowercased by Zod
      { new: true }
    ).select("-password");

    // Delete verification record
    await EmailVerification.deleteOne({ _id: verification._id });

    // Send notification to old email
    if (oldEmail !== newEmail) { // Already lowercased by Zod
      try {
        await sendEmailChangeNotification(oldEmail, newEmail);
      } catch (emailError) {
        console.error("Failed to send email change notification:", emailError);
        // Don't fail the request if notification fails
      }
    }

    console.log(`✅ Email updated for user ${userId}: ${oldEmail} -> ${newEmail}`);

    // Reload user to get updated data
    const updatedUser = await User.findById(userId);
    if (!updatedUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email updated successfully",
      user: {
        id: String(updatedUser._id),
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
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

