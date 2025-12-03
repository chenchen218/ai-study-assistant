/**
 * Q&A (Question & Answer) API Route
 * 
 * This endpoint allows users to ask questions about their uploaded documents.
 * The system retrieves the original document from S3, extracts text, and uses AI
 * to generate contextual answers based on the document content.
 * 
 * Flow:
 * 1. Apply rate limiting to prevent abuse (20 questions per 15 minutes per user)
 * 2. Authenticate user and extract userId from JWT token
 * 3. Validate document ID and question are provided in request body
 * 4. Verify document exists and belongs to the authenticated user
 * 5. Retrieve file from S3 storage using the document's S3 key
 * 6. Extract text from PDF or DOCX file using appropriate library
 * 7. Validate text extraction was successful
 * 8. Truncate text to 10,000 characters (to avoid AI token limits)
 * 9. Use AI to generate answer based on document content and user's question
 * 10. Return answer along with the original question
 * 
 * Use Cases:
 * - Students asking specific questions about study materials
 * - Clarifying concepts from uploaded documents
 * - Getting explanations for complex topics
 * - Understanding specific sections of a document
 * 
 * Security:
 * - Rate limiting: 20 questions per 15 minutes per user
 * - User can only ask questions about their own documents
 * - Ownership verification required before processing
 * - Authentication required for all requests
 * 
 * Performance:
 * - Text extraction happens on-demand (not cached) to ensure accuracy
 * - Text is truncated to 10,000 characters to ensure fast AI processing
 * - AI processing uses the same model selection and caching as other AI features
 * 
 * Error Handling:
 * - Returns 400 if document ID or question is missing
 * - Returns 401 if user is not authenticated
 * - Returns 404 if document not found or doesn't belong to user
 * - Returns 400 if text extraction fails
 * - Returns 500 for server errors
 * 
 * Response Format:
 * - answer: AI-generated answer based on document content
 * - question: Echo of the original question (for frontend display)
 * 
 * @route POST /api/qa
 * @access Protected (requires authentication, own documents only)
 * @body {string} documentId - ID of the document to ask questions about
 * @body {string} question - User's question about the document
 * @returns {object} Answer and original question
 */

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Document } from "@/models/Document";
import { getFileFromS3 } from "@/lib/s3";
import { answerQuestion } from "@/lib/ai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { getUserIdFromRequest } from "@/lib/auth";
import { rateLimiters } from "@/lib/rate-limit";

// Force dynamic rendering since we use request.headers for authentication
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Apply rate limiting to prevent abuse and control costs
  // Limits: 20 questions per 15 minutes per user
  // This prevents users from overwhelming the system with questions
  // and helps control AI API costs
  const rateLimitResponse = rateLimiters.qa(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Establish connection to MongoDB database
    await connectDB();

    // Authenticate user and get userId from JWT token
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract document ID and question from JSON request body
    const { documentId, question } = await request.json();

    // Validate that both required fields are provided
    if (!documentId || !question) {
      return NextResponse.json(
        { error: "Document ID and question are required" },
        { status: 400 }
      );
    }

    // Find document and verify ownership
    // Users can only ask questions about their own documents
    // This prevents unauthorized access to other users' documents
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

    let truncatedText = "";

    // Handle YouTube documents differently
    // For YouTube videos, we use the video URL directly with the AI model
    if (document.fileType === "youtube") {
      if (!document.youtubeUrl) {
        return NextResponse.json(
          { error: "YouTube URL not found for this document" },
          { status: 400 }
        );
      }
      
      // For YouTube Q&A, we pass a context that includes the video reference
      // The AI will use its knowledge of the video to answer questions
      truncatedText = `This question is about a YouTube video titled "${document.fileName}". Video URL: ${document.youtubeUrl}. Please answer the following question based on this video content.`;
    } else {
      // For PDF/DOCX: Retrieve file from S3 storage and extract text
      // We need the original document text to answer questions accurately
      if (!document.s3Key) {
        return NextResponse.json(
          { error: "Document file not found" },
          { status: 400 }
        );
      }

      const fileBuffer = await getFileFromS3(document.s3Key);
      let extractedText = "";

      // Extract text based on file type
      // PDF: Use pdf-parse library to extract text content
      // DOCX: Use mammoth library to extract raw text (no formatting)
      if (document.fileType === "pdf") {
        const pdfData = await pdfParse(fileBuffer);
        extractedText = pdfData.text;
      } else if (document.fileType === "docx") {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        extractedText = result.value;
      }

      // Validate that text extraction was successful
      // Some files may be corrupted, password-protected, or contain only images
      if (!extractedText || extractedText.trim().length === 0) {
        return NextResponse.json(
          { error: "Could not extract text from document" },
          { status: 400 }
        );
      }

      // Truncate text to 10,000 characters for AI processing
      const maxLength = 10000;
      truncatedText =
        extractedText.length > maxLength
          ? extractedText.substring(0, maxLength) + "..."
          : extractedText;
    }

    // Generate answer using AI
    // The AI model analyzes the document content and question to provide
    // a contextual answer based on the document's information
    // The answer is generated specifically for this question and document combination
    const answer = await answerQuestion(truncatedText, question);

    // Return answer along with the original question
    // This allows the frontend to display the Q&A pair in a conversation format
    // The question is echoed back so the frontend can maintain conversation history
    return NextResponse.json({
      answer,
      question,
    });
  } catch (error: any) {
    // Log error for debugging and monitoring
    console.error("Q&A error:", error);
    // Return generic error message to prevent information leakage
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
