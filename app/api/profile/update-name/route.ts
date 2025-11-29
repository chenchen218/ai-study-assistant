import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { getUserIdFromRequest } from "@/lib/auth";

/**
 * PUT /api/profile/update-name
 * Updates the user's name
 * Requires authentication
 */
export async function PUT(request: NextRequest) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await request.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required and cannot be empty" },
        { status: 400 }
      );
    }

    if (name.trim().length > 100) {
      return NextResponse.json(
        { error: "Name must be less than 100 characters" },
        { status: 400 }
      );
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { name: name.trim() },
      { new: true }
    ).select("-password");

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log(`✅ Name updated for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: "Name updated successfully",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Error updating name:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

