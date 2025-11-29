import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { WrongAnswer } from "@/models/WrongAnswer";
import { Document } from "@/models/Document";

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

/**
 * GET /api/error-book
 * Get all wrong answers grouped by document
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all wrong answers for the user
    const wrongAnswers = await WrongAnswer.find({ userId })
      .populate("documentId", "fileName fileType uploadedAt")
      .sort({ createdAt: -1 })
      .lean();

    console.log(`📚 Found ${wrongAnswers.length} wrong answers for user ${userId}`);

    // Group by document
    const groupedByDocument: Record<
      string,
      {
        document: {
          id: string;
          fileName: string;
          fileType: string;
          uploadedAt: string;
          isDeleted?: boolean;
        };
        wrongAnswers: Array<{
          id: string;
          question: string;
          options: string[];
          selectedAnswer: number;
          correctAnswer: number;
          explanation?: string;
          attemptedAt: string;
        }>;
      }
    > = {};

    for (const wrongAnswer of wrongAnswers) {
      // Handle cases where document was deleted
      const docId = wrongAnswer.documentId?._id 
        ? String(wrongAnswer.documentId._id) 
        : String(wrongAnswer.documentId) || "deleted";
      
      const doc = wrongAnswer.documentId as any;
      const isDocumentDeleted = !doc || !doc._id || !doc.fileName;

      if (!groupedByDocument[docId]) {
        groupedByDocument[docId] = {
          document: {
            id: docId,
            fileName: doc?.fileName || "[Document Deleted]",
            fileType: doc?.fileType || "unknown",
            uploadedAt: doc?.uploadedAt 
              ? new Date(doc.uploadedAt).toISOString() 
              : new Date().toISOString(),
            isDeleted: isDocumentDeleted,
          },
          wrongAnswers: [],
        };
      }

      groupedByDocument[docId].wrongAnswers.push({
        id: String(wrongAnswer._id),
        question: wrongAnswer.question,
        options: wrongAnswer.options,
        selectedAnswer: wrongAnswer.selectedAnswer,
        correctAnswer: wrongAnswer.correctAnswer,
        explanation: wrongAnswer.explanation,
        attemptedAt: wrongAnswer.attemptedAt 
          ? wrongAnswer.attemptedAt.toISOString() 
          : new Date().toISOString(),
      });
    }

    // Convert to array
    const result = Object.values(groupedByDocument);

    return NextResponse.json({
      success: true,
      errorBooks: result,
      totalDocuments: result.length,
      totalWrongAnswers: wrongAnswers.length,
    });
  } catch (error: any) {
    console.error("Error fetching error book:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

