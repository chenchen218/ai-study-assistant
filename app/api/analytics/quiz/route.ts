import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { QuizPerformance } from "@/models/QuizPerformance";
import { WrongAnswer } from "@/models/WrongAnswer";
import { QuizQuestion } from "@/models/QuizQuestion";

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

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
    
    console.log("📊 Quiz answer received:", {
      userId,
      documentId,
      quizQuestionId,
      selectedAnswer,
      correctAnswer,
      isCorrect,
    });

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

    // If answer is wrong, save to error book
    if (!isCorrect) {
      try {
        const quizQuestion = await QuizQuestion.findById(quizQuestionId);
        if (quizQuestion) {
          // Use upsert to avoid duplicates (handled by unique index)
          const wrongAnswer = await WrongAnswer.findOneAndUpdate(
            {
              userId,
              quizQuestionId,
            },
            {
              userId,
              documentId,
              quizQuestionId,
              question: quizQuestion.question,
              options: quizQuestion.options,
              selectedAnswer,
              correctAnswer: quizQuestion.correctAnswer, // Use correctAnswer from question, not from request
              explanation: quizQuestion.explanation,
              attemptedAt: new Date(),
            },
            {
              upsert: true,
              new: true,
            }
          );
          console.log("✅ Wrong answer saved to error book:", {
            wrongAnswerId: wrongAnswer._id,
            userId,
            documentId,
            quizQuestionId,
          });
        } else {
          console.warn("⚠️ Quiz question not found:", quizQuestionId);
        }
      } catch (error: any) {
        // Log error but don't fail the request
        console.error("❌ Error saving to error book:", error);
        if (error.code === 11000) {
          console.log("ℹ️ Duplicate wrong answer (already exists)");
        }
      }
    }

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
