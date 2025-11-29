import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Document } from "@/models/Document";
import { Summary } from "@/models/Summary";
import { Note } from "@/models/Note";
import { Flashcard } from "@/models/Flashcard";
import { QuizQuestion } from "@/models/QuizQuestion";
import { getUserIdFromRequest } from "@/lib/auth";
import { deleteFromS3 } from "@/lib/s3";

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

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

    const [summary, notes, flashcards, quizQuestions] = await Promise.all([
      Summary.findOne({ documentId }),
      Note.findOne({ documentId }),
      Flashcard.find({ documentId }),
      QuizQuestion.find({ documentId }),
    ]);

    return NextResponse.json({
      document: {
        id: String(document._id),
        fileName: document.fileName,
        fileType: document.fileType,
        uploadedAt: document.uploadedAt,
        status: document.status,
      },
      summary: summary
        ? {
            id: String(summary._id),
            content: summary.content,
          }
        : null,
      notes: notes
        ? {
            id: String(notes._id),
            title: notes.title,
            content: notes.content,
          }
        : null,
      flashcards: flashcards.map((card) => ({
        id: String(card._id),
        question: card.question,
        answer: card.answer,
      })),
      quizQuestions: quizQuestions.map((q) => ({
        id: String(q._id),
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

export async function DELETE(
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

    if (!documentId || documentId === "undefined") {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    // Find the document and verify ownership
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

    // Delete file from S3
    try {
      await deleteFromS3(document.s3Key);
    } catch (s3Error: any) {
      console.error("Error deleting from S3:", s3Error);
      // Continue with database deletion even if S3 deletion fails
    }

    // Delete all related data
    await Promise.all([
      Summary.deleteMany({ documentId }),
      Note.deleteMany({ documentId }),
      Flashcard.deleteMany({ documentId }),
      QuizQuestion.deleteMany({ documentId }),
    ]);

    // Delete the document itself
    await Document.deleteOne({ _id: documentId, userId });

    return NextResponse.json(
      { message: "Document deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Delete document error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
