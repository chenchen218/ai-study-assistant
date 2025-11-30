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

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimiters.documents(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const fileType = file.name.split(".").pop()?.toLowerCase();
    if (fileType !== "pdf" && fileType !== "docx") {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF and DOCX files are supported." },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File is too large. Maximum file size is 10MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to S3
    const { key, url } = await uploadToS3(buffer, file.name, file.type);

    // Extract text from file
    let extractedText = "";
    if (fileType === "pdf") {
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text;
    } else if (fileType === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from file" },
        { status: 400 }
      );
    }

    // Limit text length for AI processing (to avoid token limits)
    const maxLength = 10000;
    const truncatedText =
      extractedText.length > maxLength
        ? extractedText.substring(0, maxLength) + "..."
        : extractedText;

    // Save document to database
    const document = await Document.create({
      userId,
      fileName: file.name,
      fileType: fileType as "pdf" | "docx",
      fileSize: file.size,
      s3Key: key,
      s3Url: url,
      originalName: file.name,
      status: "processing",
    });

    // Check if GEMINI_API_KEY is configured
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

    // Generate AI content asynchronously with Promise.allSettled for resilience
    Promise.allSettled([
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
      generateQuizQuestions(truncatedText, 10)
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
      const successes = results.filter((r) => r.status === "fulfilled").length;
      const failures = results.filter((r) => r.status === "rejected").length;

      console.log(
        `✅ AI content generation completed: ${successes} succeeded, ${failures} failed`
      );

      // Log detailed errors for failed operations
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

      // Mark as completed if at least one operation succeeded
      // Otherwise mark as failed
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

    return NextResponse.json(
      {
        message: "File uploaded successfully",
        document: {
          id: document._id,
          fileName: document.fileName,
          status: document.status,
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
