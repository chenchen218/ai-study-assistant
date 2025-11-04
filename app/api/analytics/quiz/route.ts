import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { QuizPerformance } from "@/models/QuizPerformance";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      documentId,
      quizQuestionId,
      selectedAnswer,
      correctAnswer,
      timeSpent,
    } = await request.json();

    const isCorrect = selectedAnswer === correctAnswer;

    const performance = await QuizPerformance.create({
      userId,
      documentId,
      quizQuestionId,
      selectedAnswer,
      correctAnswer,
      isCorrect,
      timeSpent: timeSpent || 0,
      attemptedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      performanceId: String(performance._id),
      isCorrect,
    });
  } catch (error: any) {
    console.error("Quiz performance tracking error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
