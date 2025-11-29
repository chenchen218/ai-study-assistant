import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { EmailVerification } from "@/models/EmailVerification";
import { rateLimiters } from "@/lib/rate-limit";

// Force dynamic rendering since we use request.json
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/reset-password
 * Resets user's password using verification code
 * Rate limited to prevent brute force attacks
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimiters.auth(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    await connectDB();

    const { email, code, newPassword } = await request.json();

    if (!email || !code || !newPassword) {
      return NextResponse.json(
        { error: "Email, code, and new password are required" },
        { status: 400 }
      );
    }

    // Validate new password
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // Find verification record
    const verification = await EmailVerification.findOne({
      email: email.toLowerCase(),
      code: code.toString(),
    });

    if (!verification) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Check if code has expired
    if (new Date() > verification.expiresAt) {
      await EmailVerification.deleteOne({ _id: verification._id });
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Check if already verified
    if (verification.verified) {
      return NextResponse.json(
        { error: "This code has already been used" },
        { status: 400 }
      );
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.password) {
      return NextResponse.json(
        { error: "User not found or account doesn't support password reset" },
        { status: 404 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await User.findByIdAndUpdate(user._id, { password: hashedPassword });

    // Mark verification as used
    verification.verified = true;
    await verification.save();

    console.log(`✅ Password reset for user: ${email}`);

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. You can now login with your new password.",
    });
  } catch (error: any) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

