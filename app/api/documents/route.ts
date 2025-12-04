/**
 * Document Upload and Processing API Route
 *
 * This endpoint handles file uploads, text extraction, and asynchronous AI content generation.
 * It supports PDF and DOCX files up to 10MB in size.
 *
 * POST Flow (File Upload):
 * 1. Authenticate user and validate request
 * 2. Validate file type (PDF/DOCX only) and size (10MB maximum)
 * 3. Convert file to Buffer for processing
 * 4. Upload file to AWS S3 for persistent storage
 * 5. Extract text from PDF or DOCX file using appropriate library
 * 6. Truncate text to 10,000 characters (to avoid AI token limits)
 * 7. Save document metadata to database with "processing" status
 * 8. Asynchronously generate AI content (Summary, Notes, Flashcards, Quiz)
 * 9. Update document status to "completed" or "failed" based on results
 * 10. Return immediately with document ID (non-blocking)
 *
 * GET Flow (List Documents):
 * 1. Authenticate user
 * 2. Query database for all documents belonging to the user
 * 3. Sort by creation date (newest first)
 * 4. Exclude sensitive S3 keys from response
 * 5. Transform MongoDB _id to id for frontend
 * 6. Return list of documents
 *
 * AI Content Generation:
 * The system generates four types of educational content:
 * - Summary: Comprehensive overview of the document (1 per document)
 * - Notes: Detailed study notes with markdown formatting (1 per document)
 * - Flashcards: 10 interactive Q&A flashcards for practice
 * - Quiz: 5 multiple-choice questions with explanations
 *
 * Processing Strategy:
 * - Uses Promise.allSettled() for resilience (partial failures don't block others)
 * - Processing happens asynchronously (non-blocking upload response)
 * - Frontend polls document status until processing completes
 * - Document marked as "completed" if at least one AI generation succeeds
 * - Document marked as "failed" only if all AI generations fail
 *
 * Security:
 * - Rate limiting: 10 uploads per 15 minutes per user
 * - File type validation: Only PDF and DOCX allowed
 * - File size limits: Maximum 10MB to prevent abuse
 * - User authentication required for all operations
 * - Users can only access their own documents
 *
 * Performance:
 * - Text truncation to 10,000 characters ensures consistent AI processing times
 * - Asynchronous processing prevents blocking the upload response
 * - S3 storage provides scalable file storage
 * - Database queries are optimized with proper indexing
 *
 * Error Handling:
 * - Returns 400 for invalid file type, size, or missing file
 * - Returns 401 for unauthenticated requests
 * - Returns 500 for server errors
 * - AI generation failures are logged but don't block the upload
 *
 * @route POST /api/documents - Upload and process a new document
 * @route GET /api/documents - Get list of user's documents
 * @access Protected (requires authentication)
 */

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Document } from "@/models/Document";
import { getUserIdFromRequest } from "@/lib/auth";
import { uploadToS3 } from "@/lib/s3";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import {
  generateSummary,
  generateNotes,
  generateFlashcards,
  generateQuizQuestions,
} from "@/lib/ai";
import { Summary } from "@/models/Summary";
import { Note } from "@/models/Note";
import { Flashcard } from "@/models/Flashcard";
import { QuizQuestion } from "@/models/QuizQuestion";
import { rateLimiters } from "@/lib/rate-limit";

// Force dynamic rendering since we use request.headers for authentication
// This is required for Next.js to properly handle cookies and headers in serverless environments
export const dynamic = "force-dynamic";

/**
 * POST: Upload and process a new document
 *
 * Handles file upload, text extraction, and triggers asynchronous AI content generation.
 * Returns immediately with document ID - processing happens in the background.
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting to prevent abuse and ensure fair resource usage
  // Limits: 10 uploads per 15 minutes per user
  // This prevents users from overwhelming the system with uploads
  const rateLimitResponse = rateLimiters.documents(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Establish connection to MongoDB database
    await connectDB();

    // Authenticate user and get userId from JWT token
    // This ensures only authenticated users can upload documents
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract file from FormData (multipart/form-data encoding)
    // This is the standard way to upload files via HTTP
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type - only PDF and DOCX are supported
    // Extract file extension from filename
    // We support these formats because they're common for educational documents
    // and we have reliable text extraction libraries for them
    const fileType = file.name.split(".").pop()?.toLowerCase();
    if (fileType !== "pdf" && fileType !== "docx") {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF and DOCX files are supported." },
        { status: 400 }
      );
    }

    // Validate file size - maximum 10MB to prevent abuse and ensure reasonable processing times
    // Large files take longer to process and cost more in terms of storage and AI processing
    // 10MB is a reasonable limit for most educational documents
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File is too large. Maximum file size is 10MB. Your file is ${(
            file.size /
            (1024 * 1024)
          ).toFixed(2)}MB.`,
        },
        { status: 400 }
      );
    }

    // Convert file to Buffer for processing
    // ArrayBuffer is needed for Node.js Buffer operations
    // Buffer is required for both S3 upload and text extraction libraries
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload file to AWS S3 for persistent storage
    // S3 provides scalable, reliable file storage
    // Returns S3 key (file path) and public URL
    // Files are stored with unique keys to prevent collisions
    const { key, url } = await uploadToS3(buffer, file.name, file.type);

    // Extract text from file based on file type
    // PDF: Use pdf-parse library to extract text content
    // DOCX: Use mammoth library to extract raw text (no formatting)
    // Text extraction is necessary for AI processing
    let extractedText = "";
    if (fileType === "pdf") {
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text;
    } else if (fileType === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    }

    // Validate that text extraction was successful
    // Some files may be corrupted, password-protected, or contain only images
    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from file" },
        { status: 400 }
      );
    }

    // Truncate text to 10,000 characters to avoid AI token limits
    // Most AI models have token limits (e.g., 32k tokens for Gemini)
    // Very long documents can exceed these limits and cause errors
    // This ensures consistent processing and cost control
    // We take the first 10,000 characters which usually contains the most important content
    const maxLength = 10000;
    const truncatedText =
      extractedText.length > maxLength
        ? extractedText.substring(0, maxLength) + "..."
        : extractedText;

    // Save document metadata to database with "processing" status
    // Status will be updated to "completed" or "failed" after AI processing
    // We save the document immediately so the frontend can start polling for status
    const document = await Document.create({
      userId,
      fileName: file.name,
      fileType: fileType as "pdf" | "docx",
      fileSize: file.size,
      s3Key: key, // S3 object key for file retrieval
      s3Url: url, // Public URL (if bucket is public) or signed URL
      originalName: file.name,
      status: "processing", // Will be updated after AI processing completes
    });

    // Check if GEMINI_API_KEY is configured
    // If not, mark document as failed and return early
    // This allows file upload to succeed even if AI features are not configured
    if (!process.env.GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY is not set in environment variables");
      document.status = "failed";
      await document.save();
      return NextResponse.json(
        {
          message: "File uploaded successfully",
          document: {
            id: document._id,
            fileName: document.fileName,
            status: document.status,
          },
          warning: "AI processing failed: GEMINI_API_KEY not configured",
        },
        { status: 201 }
      );
    }

    // Generate AI content asynchronously using Promise.allSettled
    // Promise.allSettled allows partial success - if one AI generation fails, others can still succeed
    // This provides resilience and better user experience
    // Processing happens in the background, so we return immediately to the client
    // The frontend will poll the document status until processing completes
    Promise.allSettled([
      // Generate Summary: Comprehensive overview of the document
      // This provides users with a quick understanding of the document's main points
      generateSummary(truncatedText, userId, String(document._id))
        .then(async (summaryContent) => {
          if (summaryContent && summaryContent.trim()) {
            await Summary.create({
              documentId: document._id,
              userId,
              content: summaryContent,
            });
            console.log("✅ Summary created successfully");
          } else {
            console.warn("⚠️ Summary generation returned empty content");
          }
        })
        .catch((err) => {
          console.error("❌ Error generating summary:", err?.message || err);
          throw err;
        }),

      // Generate Notes: Detailed study notes with markdown formatting
      // These notes are organized with headings, bullet points, and key concepts
      // Users can edit these notes after generation
      generateNotes(truncatedText, userId, String(document._id))
        .then(async (notesContent) => {
          if (notesContent && notesContent.trim()) {
            await Note.create({
              documentId: document._id,
              userId,
              title: "Study Notes",
              content: notesContent,
            });
            console.log("✅ Notes created successfully");
          } else {
            console.warn("⚠️ Notes generation returned empty content");
          }
        })
        .catch((err) => {
          console.error("❌ Error generating notes:", err?.message || err);
          throw err;
        }),

      // Generate Flashcards: 10 interactive Q&A flashcards for practice
      // Flashcards help users memorize key concepts through active recall
      // Each flashcard has a question and answer pair
      generateFlashcards(truncatedText, 10, userId, String(document._id))
        .then(async (flashcards) => {
          if (flashcards && flashcards.length > 0) {
            await Flashcard.insertMany(
              flashcards.map((card: { question: string; answer: string }) => ({
                documentId: document._id,
                userId,
                question: card.question,
                answer: card.answer,
              }))
            );
            console.log(`✅ Created ${flashcards.length} flashcards`);
          } else {
            console.warn("⚠️ Flashcard generation returned empty array");
          }
        })
        .catch((err) => {
          console.error("❌ Error generating flashcards:", err?.message || err);
          throw err;
        }),

      // Generate Quiz Questions: 5 multiple-choice questions with explanations
      // Quiz questions test understanding and help identify knowledge gaps
      // Each question has 4 options, one correct answer, and an optional explanation
      generateQuizQuestions(
        truncatedText,
        5,
        null,
        userId,
        String(document._id)
      )
        .then(async (questions) => {
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
            console.log(`✅ Created ${questions.length} quiz questions`);
          } else {
            console.warn("⚠️ Quiz generation returned empty array");
          }
        })
        .catch((err) => {
          console.error(
            "❌ Error generating quiz questions:",
            err?.message || err
          );
          throw err;
        }),
    ]).then(async (results) => {
      // Count successful and failed operations
      // This helps us determine the overall status of the document
      const successes = results.filter((r) => r.status === "fulfilled").length;
      const failures = results.filter((r) => r.status === "rejected").length;

      console.log(
        `✅ AI content generation completed: ${successes} succeeded, ${failures} failed`
      );

      // Log detailed errors for failed operations to help with debugging
      // This helps identify which AI generation failed and why
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          const operationNames = [
            "Summary",
            "Notes",
            "Flashcards",
            "Quiz Questions",
          ];
          console.error(
            `❌ ${operationNames[index]} generation failed:`,
            result.reason?.message || result.reason
          );
        }
      });

      // Update document status based on results
      // If at least one AI generation succeeded, mark as completed
      // This allows partial success - user can still use successfully generated content
      // If all failed, mark as failed
      // This approach provides better user experience than requiring all to succeed
      if (successes > 0) {
        document.status = "completed";
        console.log(
          `✅ Document marked as completed (${successes}/${results.length} operations succeeded)`
        );
      } else {
        document.status = "failed";
        console.error(
          "❌ All AI content generation failed. Document marked as failed."
        );
      }
      await document.save();
    });

    // Return immediately with document ID and status
    // Client will poll /api/documents/:id to check when processing completes
    // This non-blocking approach provides better user experience
    // The user doesn't have to wait for AI processing to complete
    return NextResponse.json(
      {
        message: "File uploaded successfully",
        document: {
          id: document._id,
          fileName: document.fileName,
          status: document.status, // Will be "processing" initially
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET: Retrieve list of user's documents
 *
 * Returns all documents belonging to the authenticated user, sorted by creation date (newest first).
 * This is used by the dashboard to display the user's document list.
 *
 * Security:
 * - Only returns documents belonging to the authenticated user
 * - Excludes sensitive S3 keys from response
 *
 * Response Format:
 * - Array of document objects with: id, fileName, fileType, status, uploadedAt
 * - Sorted by createdAt in descending order (newest first)
 */
export async function GET(request: NextRequest) {
  try {
    // Establish connection to MongoDB database
    await connectDB();

    // Authenticate user and get userId from JWT token
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Query database for all documents belonging to this user
    // Sort by creation date in descending order (newest first)
    // Exclude s3Key field from response for security (sensitive information)
    const documents = await Document.find({ userId })
      .sort({ createdAt: -1 })
      .select("-s3Key");

    // Transform MongoDB documents for frontend consumption
    // Convert MongoDB _id (ObjectId) to string id
    // This is necessary because MongoDB ObjectIds don't serialize well to JSON
    const transformedDocuments = documents.map((doc) => ({
      id: String(doc._id),
      fileName: doc.fileName,
      fileType: doc.fileType,
      status: doc.status, // "processing", "completed", or "failed"
      uploadedAt: doc.uploadedAt,
    }));

    return NextResponse.json({ documents: transformedDocuments });
  } catch (error: any) {
    // Log error for debugging and monitoring
    console.error("Get documents error:", error);
    // Return generic error message to prevent information leakage
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
