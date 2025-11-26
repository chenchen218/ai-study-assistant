import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { WrongAnswer } from "@/models/WrongAnswer";
import { Document } from "@/models/Document";
import mongoose from "mongoose";

/**
 * GET /api/error-book/[documentId]
 * Get wrong answers for a specific document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId } = params;

    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return NextResponse.json({ error: "Invalid document ID" }, { status: 400 });
    }

    // Get document info
    const document = await Document.findOne({
      _id: documentId,
      userId,
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Get wrong answers for this document
    const wrongAnswers = await WrongAnswer.find({
      userId,
      documentId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      document: {
        id: String(document._id),
        fileName: document.fileName,
        fileType: document.fileType,
        uploadedAt: document.uploadedAt,
      },
      wrongAnswers: wrongAnswers.map((wa) => ({
        id: String(wa._id),
        question: wa.question,
        options: wa.options,
        selectedAnswer: wa.selectedAnswer,
        correctAnswer: wa.correctAnswer,
        explanation: wa.explanation,
        attemptedAt: wa.attemptedAt.toISOString(),
      })),
      count: wrongAnswers.length,
    });
  } catch (error: any) {
    console.error("Error fetching error book for document:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/error-book/[documentId]
 * Delete a wrong answer from error book
 * Works even if the document has been deleted
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId } = await params;
    const { wrongAnswerId } = await request.json();

    if (!wrongAnswerId) {
      return NextResponse.json(
        { error: "wrongAnswerId is required" },
        { status: 400 }
      );
    }

    // Validate wrongAnswerId format
    if (!mongoose.Types.ObjectId.isValid(wrongAnswerId)) {
      return NextResponse.json(
        { error: "Invalid wrong answer ID" },
        { status: 400 }
      );
    }

    // Delete by wrongAnswerId and userId only (don't check documentId)
    // This allows deletion even if document was deleted
    const wrongAnswer = await WrongAnswer.findOneAndDelete({
      _id: wrongAnswerId,
      userId,
    });

    if (!wrongAnswer) {
      return NextResponse.json(
        { error: "Wrong answer not found or you don't have permission to delete it" },
        { status: 404 }
      );
    }

    console.log("✅ Wrong answer deleted:", {
      wrongAnswerId,
      userId,
      documentId: wrongAnswer.documentId,
    });

    return NextResponse.json({
      success: true,
      message: "Wrong answer removed from error book",
    });
  } catch (error: any) {
    console.error("❌ Error deleting wrong answer:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

