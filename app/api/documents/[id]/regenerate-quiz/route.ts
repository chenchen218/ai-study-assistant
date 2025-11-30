import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Document } from "@/models/Document";
import { QuizQuestion } from "@/models/QuizQuestion";
import { getFileFromS3 } from "@/lib/s3";
import { generateQuizQuestions } from "@/lib/ai";
import { getUserIdFromRequest } from "@/lib/auth";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

/**
 * POST /api/documents/[id]/regenerate-quiz
 * Regenerates quiz questions for a document
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const documentId = params.id;

    if (!documentId || documentId === "undefined") {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    const document = await Document.findOne({
      _id: documentId,
      userId,
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Get file from S3 and extract text
    const fileBuffer = await getFileFromS3(document.s3Key);
    let extractedText = "";

    if (document.fileType === "pdf") {
      const pdfData = await pdfParse(fileBuffer);
      extractedText = pdfData.text;
    } else if (document.fileType === "docx") {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      extractedText = result.value;
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from document" },
        { status: 400 }
      );
    }

    // Limit text length for AI processing
    const maxLength = 10000;
    const truncatedText =
      extractedText.length > maxLength
        ? extractedText.substring(0, maxLength) + "..."
        : extractedText;

    // Get existing quiz questions before deleting (to avoid duplicates)
    const existingQuestions = await QuizQuestion.find({
      documentId: document._id,
      userId,
    }).select("question");

    // Delete existing quiz questions
    await QuizQuestion.deleteMany({ documentId: document._id, userId });

    // Generate new quiz questions (5 questions) with previous questions context
    const previousQuestionsText = existingQuestions.length > 0
      ? existingQuestions.map((q, i) => `${i + 1}. ${q.question}`).join("\n")
      : null;

    const questions = await generateQuizQuestions(truncatedText, 5, previousQuestionsText);

    if (questions && questions.length > 0) {
      await QuizQuestion.insertMany(
        questions.map(
          (q: {
            question: string;
            options: string[];
            correctAnswer: number;
            explanation?: string;
          }) => ({
            documentId: document._id,
            userId,
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
          })
        )
      );
      console.log(`✅ Regenerated ${questions.length} quiz questions for document ${document._id}`);
    } else {
      return NextResponse.json(
        { error: "Failed to generate quiz questions. Please try again." },
        { status: 500 }
      );
    }

    // Fetch the new quiz questions
    const newQuizQuestions = await QuizQuestion.find({
      documentId: document._id,
      userId,
    }).sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      quizQuestions: newQuizQuestions.map((qq) => ({
        id: qq._id,
        question: qq.question,
        options: qq.options,
        correctAnswer: qq.correctAnswer,
        explanation: qq.explanation,
      })),
    });
  } catch (error: any) {
    console.error("Error regenerating quiz:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

