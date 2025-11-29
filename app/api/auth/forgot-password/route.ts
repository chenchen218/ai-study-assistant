import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { EmailVerification } from "@/models/EmailVerification";
import { sendVerificationCode } from "@/lib/email";
import { rateLimiters } from "@/lib/rate-limit";

/**
 * Generates a random 6-digit verification code
 * @returns 6-digit code as string
 */
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * POST /api/auth/forgot-password
 * Sends a password reset code to the user's email
 * Rate limited to prevent abuse
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimiters.auth(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    await connectDB();

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check if user exists and has a password (local account)
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if user exists for security
      return NextResponse.json(
        {
          success: true,
          message: "If an account exists with this email, a password reset code has been sent.",
        },
        { status: 200 }
      );
    }

    // Check if user has a password (not OAuth-only account)
    if (!user.password) {
      // Don't reveal account type for security
      return NextResponse.json(
        {
          success: true,
          message: "If an account exists with this email, a password reset code has been sent.",
        },
        { status: 200 }
      );
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing verification codes for this email
    await EmailVerification.deleteMany({ email: email.toLowerCase() });

    // Create new verification record
    await EmailVerification.create({
      email: email.toLowerCase(),
      code,
      expiresAt,
      verified: false,
    });

    // Send verification email
    try {
      await sendVerificationCode(email.toLowerCase(), code);
      console.log(`✅ Password reset code sent to: ${email}`);
    } catch (emailError: any) {
      console.error("❌ Error sending email:", emailError);
      // Still return success to prevent email enumeration
      return NextResponse.json(
        {
          success: true,
          message: "If an account exists with this email, a password reset code has been sent.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "If an account exists with this email, a password reset code has been sent.",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error sending password reset code:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

