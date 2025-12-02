/**
 * Document Upload and Processing API Route
 * 
 * This endpoint handles file uploads, text extraction, and asynchronous AI content generation.
 * 
 * Flow:
 * 1. Authenticate user and validate request
 * 2. Validate file type (PDF/DOCX only) and size (10MB max)
 * 3. Upload file to AWS S3 for persistent storage
 * 4. Extract text from PDF or DOCX file
 * 5. Truncate text to 10,000 characters (to avoid AI token limits)
 * 6. Save document metadata to database with "processing" status
 * 7. Asynchronously generate AI content (Summary, Notes, Flashcards, Quiz)
 * 8. Update document status to "completed" or "failed"
 * 
 * AI Content Generation:
 * - Summary: Comprehensive overview of the document
 * - Notes: Detailed study notes with markdown formatting
 * - Flashcards: 10 interactive Q&A flashcards
 * - Quiz: 5 multiple-choice questions with explanations
 * 
 * Processing Strategy:
 * - Uses Promise.allSettled() for resilience (partial failures don't block others)
 * - Processing happens asynchronously (non-blocking upload response)
 * - Frontend polls document status until processing completes
 * 
 * Security:
 * - Rate limiting to prevent abuse
 * - File type validation
 * - File size limits
 * - User authentication required
 * 
 * @route POST /api/documents
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
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Apply rate limiting to prevent abuse
  // Limits: 10 uploads per 15 minutes per user
  const rateLimitResponse = rateLimiters.documents(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    await connectDB();

    // Authenticate user and get userId from JWT token
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract file from FormData (multipart/form-data)
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type - only PDF and DOCX are supported
    // Extract file extension from filename
    const fileType = file.name.split(".").pop()?.toLowerCase();
    if (fileType !== "pdf" && fileType !== "docx") {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF and DOCX files are supported." },
        { status: 400 }
      );
    }

    // Validate file size - maximum 10MB to prevent abuse and ensure reasonable processing times
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File is too large. Maximum file size is 10MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.` },
        { status: 400 }
      );
    }

    // Convert file to Buffer for processing
    // ArrayBuffer is needed for Node.js Buffer operations
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload file to AWS S3 for persistent storage
    // Returns S3 key (file path) and public URL
    const { key, url } = await uploadToS3(buffer, file.name, file.type);

    // Extract text from file based on file type
    // PDF: Use pdf-parse library
    // DOCX: Use mammoth library to extract raw text
    let extractedText = "";
    if (fileType === "pdf") {
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text;
    } else if (fileType === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    }

    // Validate that text extraction was successful
    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from file" },
        { status: 400 }
      );
    }

    // Truncate text to 10,000 characters to avoid AI token limits
    // Most AI models have token limits, and very long documents can exceed these
    // This ensures consistent processing and cost control
    const maxLength = 10000;
    const truncatedText =
      extractedText.length > maxLength
        ? extractedText.substring(0, maxLength) + "..."
        : extractedText;

    // Save document metadata to database with "processing" status
    // Status will be updated to "completed" or "failed" after AI processing
    const document = await Document.create({
      userId,
      fileName: file.name,
      fileType: fileType as "pdf" | "docx",
      fileSize: file.size,
      s3Key: key,        // S3 object key for file retrieval
      s3Url: url,        // Public URL (if bucket is public) or signed URL
      originalName: file.name,
      status: "processing", // Will be updated after AI processing completes
    });

    // Check if GEMINI_API_KEY is configured
    // If not, mark document as failed and return early
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
    // This allows partial success - if one AI generation fails, others can still succeed
    // Processing happens in the background, so we return immediately to the client
    Promise.allSettled([
      // Generate Summary: Comprehensive overview of the document
      generateSummary(truncatedText)
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
      generateNotes(truncatedText)
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
      generateFlashcards(truncatedText, 10)
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
      generateQuizQuestions(truncatedText, 5)
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
      const successes = results.filter((r) => r.status === "fulfilled").length;
      const failures = results.filter((r) => r.status === "rejected").length;

      console.log(
        `✅ AI content generation completed: ${successes} succeeded, ${failures} failed`
      );

      // Log detailed errors for failed operations to help with debugging
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

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const documents = await Document.find({ userId })
      .sort({ createdAt: -1 })
      .select("-s3Key");

    // Transform MongoDB _id to id for frontend
    const transformedDocuments = documents.map((doc) => ({
      id: String(doc._id),
      fileName: doc.fileName,
      fileType: doc.fileType,
      status: doc.status,
      folderId: doc.folderId ? String(doc.folderId) : null,
      uploadedAt: doc.uploadedAt,
    }));

    return NextResponse.json({ documents: transformedDocuments });
  } catch (error: any) {
    console.error("Get documents error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
