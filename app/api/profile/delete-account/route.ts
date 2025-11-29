import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { Document } from "@/models/Document";
import { WrongAnswer } from "@/models/WrongAnswer";
import { getUserIdFromRequest } from "@/lib/auth";
import bcrypt from "bcryptjs";

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/profile/delete-account
 * Deletes the user's account and all associated data
 * Requires password confirmation for local accounts
 */
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { password } = await request.json();

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // For local accounts, require password confirmation
    if (user.provider === "local") {
      if (!password) {
        return NextResponse.json(
          { error: "Password is required to delete your account" },
          { status: 400 }
        );
      }

      if (!user.password) {
        return NextResponse.json(
          { error: "Password verification failed" },
          { status: 400 }
        );
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "Incorrect password" },
          { status: 401 }
        );
      }
    }

    // Delete all user's documents (this will cascade delete related data)
    const documents = await Document.find({ userId });
    const documentIds = documents.map((doc) => doc._id);

    // Delete wrong answers
    await WrongAnswer.deleteMany({ userId });

    // Delete documents (and related summaries, notes, flashcards, quiz questions will be handled by cascade or manual deletion)
    await Document.deleteMany({ userId });

    // Delete user account
    await User.findByIdAndDelete(userId);

    console.log(`✅ Account deleted for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

