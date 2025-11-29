import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { Flashcard } from "@/models/Flashcard";
import { FlashcardPerformance } from "@/models/FlashcardPerformance";
import { verifyFlashcardAnswer } from "@/lib/ai";
import { rateLimiters } from "@/lib/rate-limit";

/**
 * POST /api/flashcards/verify-answer
 * Verifies a user's answer to a flashcard question using AI
 * If correct, marks the flashcard as mastered
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimiters.auth(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { flashcardId, userAnswer } = await request.json();

    if (!flashcardId || !userAnswer) {
      return NextResponse.json(
        { error: "Flashcard ID and user answer are required" },
        { status: 400 }
      );
    }

    // Find the flashcard
    const flashcard = await Flashcard.findById(flashcardId);
    if (!flashcard) {
      return NextResponse.json(
        { error: "Flashcard not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (String(flashcard.userId) !== userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Verify the answer using AI
    const verification = await verifyFlashcardAnswer(
      flashcard.question,
      flashcard.answer,
      userAnswer.trim()
    );

    // Always create/update performance record
    // If correct, mark as mastered (isKnown = true)
    // If incorrect, mark as not known (isKnown = false) but still record the attempt
    await FlashcardPerformance.findOneAndUpdate(
      {
        userId,
        documentId: flashcard.documentId,
        flashcardId: flashcard._id,
      },
      {
        isKnown: verification.isCorrect, // true if correct, false if incorrect
        reviewedAt: new Date(),
      },
      {
        upsert: true,
        new: true,
      }
    );

    return NextResponse.json({
      success: true,
      isCorrect: verification.isCorrect,
      feedback: verification.feedback,
    });
  } catch (error: any) {
    console.error("Error verifying flashcard answer:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

