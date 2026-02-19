import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { getUserIdFromRequest } from "@/lib/auth";
import { updateNameSchema, validateRequestWithError } from "@/lib/validations";

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

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

    // Extract and validate name from request body
    const body = await request.json();
    const validation = validateRequestWithError(updateNameSchema, body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }

    const { name } = validation.data;

    const user = await User.findByIdAndUpdate(
      userId,
      { name }, // Already trimmed by Zod
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

