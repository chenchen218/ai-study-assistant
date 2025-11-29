import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Document } from "@/models/Document";
import { getFileFromS3 } from "@/lib/s3";
import { answerQuestion } from "@/lib/ai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { getUserIdFromRequest } from "@/lib/auth";
import { rateLimiters } from "@/lib/rate-limit";

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimiters.qa(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId, question } = await request.json();

    if (!documentId || !question) {
      return NextResponse.json(
        { error: "Document ID and question are required" },
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

    // Generate answer using AI
    const answer = await answerQuestion(truncatedText, question);

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
