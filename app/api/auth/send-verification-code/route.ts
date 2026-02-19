import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { EmailVerification } from "@/models/EmailVerification";
import { User } from "@/models/User";
import { sendVerificationCode } from "@/lib/email";
import { rateLimiters } from "@/lib/rate-limit";
import { sendVerificationCodeSchema, validateRequestWithError } from "@/lib/validations";

// Force dynamic rendering since we use request.json
export const dynamic = 'force-dynamic';

/**
 * Generates a random 6-digit verification code
 * @returns 6-digit code as string
 */
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * POST /api/auth/send-verification-code
 * Sends a verification code to the provided email address
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

    // Extract and validate email from request body
    const body = await request.json();
    const validation = validateRequestWithError(sendVerificationCodeSchema, body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }

    const { email } = validation.data;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
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
      console.log(`✅ Verification code sent to: ${email}`);
    } catch (emailError: any) {
      console.error("❌ Error sending email:", emailError);
      console.error("❌ Full error:", JSON.stringify(emailError, null, 2));
      return NextResponse.json(
        {
          error: `Failed to send verification email: ${emailError.message || "Please check your email configuration."}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Verification code sent to your email",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error sending verification code:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

