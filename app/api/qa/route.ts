/**
 * Q&A (Question & Answer) API Route
 * 
 * This endpoint allows users to ask questions about their uploaded documents.
 * The system retrieves the original document from S3, extracts text, and uses AI
 * to generate contextual answers based on the document content.
 * 
 * Flow:
 * 1. Authenticate user
 * 2. Validate document exists and belongs to user
 * 3. Retrieve file from S3 storage
 * 4. Extract text from PDF or DOCX file
 * 5. Truncate text to 10,000 characters (AI token limit)
 * 6. Use AI to generate answer based on document content and question
 * 7. Return answer to user
 * 
 * Use Cases:
 * - Students asking specific questions about study materials
 * - Clarifying concepts from uploaded documents
 * - Getting explanations for complex topics
 * 
 * Security:
 * - Rate limiting to prevent abuse
 * - User can only ask questions about their own documents
 * - Ownership verification required
 * 
 * Performance:
 * - Text extraction happens on-demand (not cached)
 * - Text is truncated to ensure fast AI processing
 * 
 * @route POST /api/qa
 * @access Protected (requires authentication, own documents only)
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
  // Apply rate limiting to prevent abuse
  // Limits: 20 questions per 15 minutes per user
  const rateLimitResponse = rateLimiters.qa(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    await connectDB();

    // Authenticate user
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract document ID and question from request body
    const { documentId, question } = await request.json();

    if (!documentId || !question) {
      return NextResponse.json(
        { error: "Document ID and question are required" },
        { status: 400 }
      );
    }

    // Find document and verify ownership
    // Users can only ask questions about their own documents
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

    // Retrieve file from S3 and extract text
    // We need the original document text to answer questions
    // This is done on-demand rather than caching to ensure accuracy
    const fileBuffer = await getFileFromS3(document.s3Key);
    let extractedText = "";

    // Extract text based on file type
    if (document.fileType === "pdf") {
      const pdfData = await pdfParse(fileBuffer);
      extractedText = pdfData.text;
    } else if (document.fileType === "docx") {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      extractedText = result.value;
    }

    // Validate text extraction was successful
    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from document" },
        { status: 400 }
      );
    }

    // Truncate text to 10,000 characters for AI processing
    // This ensures consistent processing times and cost control
    // AI models have token limits, and very long documents can exceed these
    const maxLength = 10000;
    const truncatedText =
      extractedText.length > maxLength
        ? extractedText.substring(0, maxLength) + "..."
        : extractedText;

    // Generate answer using AI
    // The AI model analyzes the document content and question to provide
    // a contextual answer based on the document's information
    const answer = await answerQuestion(truncatedText, question);

    // Return answer along with the original question
    // This allows the frontend to display the Q&A pair in a conversation format
    return NextResponse.json({
      answer,
      question,
    });
  } catch (error: any) {
    console.error("Q&A error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
