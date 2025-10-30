import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Document } from "@/models/Document";
import { Summary } from "@/models/Summary";
import { Note } from "@/models/Note";
import { Flashcard } from "@/models/Flashcard";
import { QuizQuestion } from "@/models/QuizQuestion";
import { getUserIdFromRequest } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const documentId = resolvedParams.id;

    if (!documentId) {
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

    const [summary, notes, flashcards, quizQuestions] = await Promise.all([
      Summary.findOne({ documentId }),
      Note.findOne({ documentId }),
      Flashcard.find({ documentId }),
      QuizQuestion.find({ documentId }),
    ]);

    return NextResponse.json({
      document: {
        id: document._id,
        fileName: document.fileName,
        fileType: document.fileType,
        uploadedAt: document.uploadedAt,
        status: document.status,
      },
      summary: summary
        ? {
            id: summary._id,
            content: summary.content,
          }
        : null,
      notes: notes
        ? {
            id: notes._id,
            title: notes.title,
            content: notes.content,
          }
        : null,
      flashcards: flashcards.map((card) => ({
        id: card._id,
        question: card.question,
        answer: card.answer,
      })),
      quizQuestions: quizQuestions.map((q) => ({
        id: q._id,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      })),
    });
  } catch (error: any) {
    console.error("Get document error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
