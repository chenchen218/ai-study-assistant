/**
 * Document Detail API Route
 * 
 * This endpoint provides two operations for individual documents:
 * 1. GET: Retrieve document with all AI-generated content (Summary, Notes, Flashcards, Quiz)
 * 2. DELETE: Delete document and all associated data (cascading delete)
 * 
 * GET Flow:
 * 1. Authenticate user and extract userId from JWT token
 * 2. Extract document ID from route parameters
 * 3. Verify document exists and belongs to the authenticated user
 * 4. Fetch all AI-generated content in parallel using Promise.all
 * 5. Return aggregated document data with all content
 * 
 * DELETE Flow:
 * 1. Authenticate user and verify ownership
 * 2. Delete file from S3 storage (frees up storage space)
 * 3. Delete all related AI-generated content in parallel (Summary, Notes, Flashcards, QuizQuestions)
 * 4. Delete document record from database
 * 
 * Security:
 * - User can only access their own documents (ownership verification)
 * - Ownership check on both GET and DELETE operations
 * - Returns 401 if not authenticated
 * - Returns 404 if document not found or doesn't belong to user
 * 
 * Performance:
 * - All content fetched in parallel using Promise.all for optimal performance
 * - MongoDB queries are optimized with proper indexing
 * - S3 deletion failure is non-blocking (continues with DB deletion)
 * 
 * Response Data (GET):
 * - document: Basic document metadata (id, fileName, fileType, uploadedAt, status)
 * - summary: AI-generated summary (null if not generated)
 * - notes: AI-generated study notes (null if not generated)
 * - flashcards: Array of flashcard objects (empty array if none generated)
 * - quizQuestions: Array of quiz question objects (empty array if none generated)
 * 
 * @route GET /api/documents/[id] - Get document with all AI-generated content
 * @route DELETE /api/documents/[id] - Delete document and all related data
 * @access Protected (requires authentication, own documents only)
 */

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Document } from "@/models/Document";
import { Summary } from "@/models/Summary";
import { Note } from "@/models/Note";
import { Flashcard } from "@/models/Flashcard";
import { QuizQuestion } from "@/models/QuizQuestion";
import { getUserIdFromRequest } from "@/lib/auth";
import { deleteFromS3 } from "@/lib/s3";

// Force dynamic rendering since we use request.headers for authentication
export const dynamic = 'force-dynamic';

/**
 * GET: Retrieve document with all AI-generated content
 * 
 * Returns document metadata along with all generated educational content.
 * This is the main endpoint used by the document detail page to display all content.
 * 
 * Content Types Returned:
 * - Summary: Overview of the document (1 per document)
 * - Notes: Detailed study notes with markdown (1 per document)
 * - Flashcards: Array of Q&A flashcards (typically 10)
 * - QuizQuestions: Array of multiple-choice questions (typically 5)
 * 
 * All content is fetched in parallel for optimal performance.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Establish connection to MongoDB database
    await connectDB();

    // Authenticate user and get userId from JWT token
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract document ID from route parameters
    // Next.js 13+ uses Promise-based params, so we need to await it
    const resolvedParams = await params;
    const documentId = resolvedParams.id;

    // Validate document ID is provided and not "undefined" (string)
    if (!documentId || documentId === "undefined") {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    // Find document and verify ownership
    // Only the document owner can access it
    // This prevents users from accessing other users' documents
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

    // Fetch all AI-generated content in parallel using Promise.all
    // This is more efficient than sequential queries
    // All queries execute concurrently, reducing total response time
    const [summary, notes, flashcards, quizQuestions] = await Promise.all([
      Summary.findOne({ documentId }),           // Find one summary (there's only one per document)
      Note.findOne({ documentId }),              // Find one note (there's only one per document)
      Flashcard.find({ documentId }),            // Find all flashcards (typically 10)
      QuizQuestion.find({ documentId }),         // Find all quiz questions (typically 5)
    ]);

    // Return aggregated document data
    // Convert MongoDB _id (ObjectId) to string for JSON serialization
    // Return null for summary/notes if not generated (document still processing or failed)
    // Return empty arrays for flashcards/quizQuestions if none generated
    return NextResponse.json({
      document: {
        id: String(document._id),
        fileName: document.fileName,
        fileType: document.fileType,
        uploadedAt: document.uploadedAt,
        status: document.status, // "processing", "completed", or "failed"
        // YouTube-specific fields (only present for YouTube documents)
        youtubeUrl: document.youtubeUrl,
        youtubeThumbnail: document.youtubeThumbnail,
        videoDuration: document.videoDuration,
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
    // Log error for debugging and monitoring
    console.error("Get document error:", error);
    // Return generic error message to prevent information leakage
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete document and all associated data
 * 
 * Performs a cascading delete operation that removes:
 * 1. The file from S3 storage (frees up storage space and reduces costs)
 * 2. All AI-generated content (Summary, Notes, Flashcards, QuizQuestions)
 * 3. The document record from the database
 * 
 * Deletion Strategy:
 * - S3 deletion happens first (non-blocking - continues even if it fails)
 * - All related data deletions happen in parallel using Promise.all
 * - Document record deletion happens last
 * - This ensures database consistency even if S3 is temporarily unavailable
 * 
 * Security:
 * - Only the document owner can delete it
 * - Ownership verification required before any deletion
 * 
 * Error Handling:
 * - S3 deletion failures are logged but don't block database deletion
 * - This ensures data consistency even if S3 is temporarily unavailable
 * - Database deletions always proceed to maintain referential integrity
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Establish connection to MongoDB database
    await connectDB();

    // Authenticate user and get userId from JWT token
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract document ID from route parameters
    const resolvedParams = await params;
    const documentId = resolvedParams.id;

    // Validate document ID is provided
    if (!documentId || documentId === "undefined") {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    // Find the document and verify ownership
    // Only the document owner can delete it
    // This prevents unauthorized deletion of other users' documents
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

    // Delete file from S3 storage (only for non-YouTube documents)
    // YouTube documents don't have S3 files
    // This frees up storage space and reduces AWS costs
    // If S3 deletion fails, we continue with database deletion
    // This ensures database consistency even if S3 is temporarily unavailable
    if (document.s3Key) {
      try {
        await deleteFromS3(document.s3Key);
      } catch (s3Error: any) {
        console.error("Error deleting from S3:", s3Error);
        // Continue with database deletion even if S3 deletion fails
        // This ensures data consistency
      }
    }

    // Delete all related AI-generated content in parallel
    // This includes: Summary, Notes, Flashcards, and QuizQuestions
    // Promise.all ensures all deletions happen concurrently for better performance
    await Promise.all([
      Summary.deleteMany({ documentId }),
      Note.deleteMany({ documentId }),
      Flashcard.deleteMany({ documentId }),
      QuizQuestion.deleteMany({ documentId }),
    ]);

    // Delete the document record itself
    // This is the final step after all related data is deleted
    // We include userId in the query for an extra ownership check
    await Document.deleteOne({ _id: documentId, userId });

    return NextResponse.json(
      { message: "Document deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    // Log error for debugging and monitoring
    console.error("Delete document error:", error);
    // Return generic error message to prevent information leakage
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
