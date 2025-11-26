import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import connectDB from "@/lib/db";
import { User, IUser } from "@/models/User";
import { sendVerificationEmail } from "@/lib/email";
import { validateEmail } from "@/lib/email-validation";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    // Validate email (format, disposable, MX records)
    const emailValidation = await validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json(
        { error: emailValidation.reason || "Invalid email address" },
        { status: 400 }
      );
    }

    // Email domain whitelist check (if configured)
    const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS?.split(",").map(
      (d) => d.trim().toLowerCase()
    );
    if (allowedDomains && allowedDomains.length > 0) {
      const emailDomain = email.split("@")[1]?.toLowerCase();
      if (!emailDomain || !allowedDomains.includes(emailDomain)) {
        return NextResponse.json(
          {
            error: `Registration is restricted to the following email domains: ${allowedDomains.join(
              ", "
            )}`,
          },
          { status: 403 }
        );
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if email verification is enabled
    const emailVerificationEnabled =
      process.env.ENABLE_EMAIL_VERIFICATION !== "false";

    // Generate verification token (only if verification is enabled)
    let verificationToken: string | undefined;
    let verificationTokenExpiry: Date | undefined;
    if (emailVerificationEnabled) {
      verificationToken = crypto.randomBytes(32).toString("hex");
      verificationTokenExpiry = new Date();
      verificationTokenExpiry.setHours(verificationTokenExpiry.getHours() + 24); // 24 hours
    }

    // Create user (verified by default if verification is disabled)
    const user = (await User.create({
      email,
      password: hashedPassword,
      name,
      role: email === process.env.ADMIN_EMAIL ? "admin" : "user",
      isVerified: !emailVerificationEnabled, // Auto-verify if verification is disabled
      verificationToken,
      verificationTokenExpiry,
    })) as IUser;

    // Send verification email (only if verification is enabled)
    if (emailVerificationEnabled && verificationToken) {
      const emailResult = await sendVerificationEmail(
        email,
        name,
        verificationToken
      );

      if (!emailResult.success) {
        console.error("Failed to send verification email:", emailResult.error);
        // Still return success, but log the error
      }

      return NextResponse.json(
        {
          message:
            "Registration successful! Please check your email to verify your account.",
          user: {
            id: String(user._id),
            email: user.email,
            name: user.name,
            role: user.role,
            isVerified: false,
          },
          requiresVerification: true,
        },
        { status: 201 }
      );
    }

    // If verification is disabled, return success without verification requirement
    return NextResponse.json(
      {
        message: "Registration successful!",
        user: {
          id: String(user._id),
          email: user.email,
          name: user.name,
          role: user.role,
          isVerified: true,
        },
        requiresVerification: false,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
