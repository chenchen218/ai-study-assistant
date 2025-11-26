import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { generateToken, verifyGoogleToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json(
        { error: "Google ID token is required" },
        { status: 400 }
      );
    }

    const googleData = await verifyGoogleToken(idToken);
    if (!googleData || !googleData.email) {
      return NextResponse.json(
        { error: "Invalid Google token" },
        { status: 401 }
      );
    }

    let user = await User.findOne({
      $or: [{ email: googleData.email }, { googleId: googleData.googleId }],
    });

    if (!user) {
      user = await User.create({
        email: googleData.email,
        name: googleData.name,
        googleId: googleData.googleId,
        role: "user",
      });
    } else if (!user.googleId) {
      user.googleId = googleData.googleId;
      await user.save();
    }

    const userId = (user._id as { toString(): string }).toString();

    const token = generateToken({
      userId,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json(
      {
        message: "Login successful",
        user: {
          id: userId,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 200 }
    );

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    console.error("Google login error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
