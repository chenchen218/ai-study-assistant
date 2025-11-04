import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { FlashcardPerformance } from "@/models/FlashcardPerformance";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId, flashcardId, isKnown, timeSpent } =
      await request.json();

    // Update or create performance record
    const performance = await FlashcardPerformance.findOneAndUpdate(
      {
        userId,
        documentId,
        flashcardId,
      },
      {
        isKnown,
        timeSpent: timeSpent || 0,
        reviewedAt: new Date(),
      },
      {
        upsert: true,
        new: true,
      }
    );

    return NextResponse.json({
      success: true,
      performanceId: String(performance._id),
    });
  } catch (error: any) {
    console.error("Flashcard performance tracking error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
