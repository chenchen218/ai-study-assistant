import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { EmailVerification } from "@/models/EmailVerification";
import { rateLimiters } from "@/lib/rate-limit";

// Force dynamic rendering since we use request.json
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/verify-code
 * Verifies the email verification code
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

    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and code are required" },
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

    // Mark as verified
    verification.verified = true;
    await verification.save();

    console.log(`✅ Email verified: ${email}`);

    return NextResponse.json(
      {
        success: true,
        message: "Email verified successfully",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error verifying code:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

