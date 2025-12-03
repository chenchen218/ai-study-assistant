/**
 * YouTube Video Submission API Route
 * 
 * Creates a document record for a YouTube video and triggers AI analysis.
 * The video content will be analyzed by Gemini to generate study materials.
 * 
 * @route POST /api/youtube
 * @access Protected (requires authentication)
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { Document } from "@/models/Document";
import { generateYouTubeContent } from "@/lib/ai";
import { Summary } from "@/models/Summary";
import { Note } from "@/models/Note";
import { Flashcard } from "@/models/Flashcard";
import { QuizQuestion } from "@/models/QuizQuestion";

// Limits (must match validate route)
const DAILY_LIMIT = 3;
const MAX_DURATION_SECONDS = 60 * 60; // 60 minutes

/**
 * Gets today's YouTube video count for a user
 */
async function getTodayUsageCount(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const count = await Document.countDocuments({
    userId: new mongoose.Types.ObjectId(userId),
    fileType: "youtube",
    createdAt: { $gte: today }
  });
  
  return count;
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // Authenticate user
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get video details from request body
    const { 
      videoId, 
      url,
      title, 
      thumbnail, 
      duration,
      categoryId,
      isEducational 
    } = await request.json();

    // Validate required fields
    if (!videoId || !url || !title) {
      return NextResponse.json(
        { error: "Missing required fields: videoId, url, title" },
        { status: 400 }
      );
    }

    // Check daily usage limit again (double-check)
    const todayCount = await getTodayUsageCount(userId);
    if (todayCount >= DAILY_LIMIT) {
      return NextResponse.json(
        { 
          error: "Daily limit reached",
          message: `You have used all ${DAILY_LIMIT} YouTube videos for today.`
        },
        { status: 429 }
      );
    }

    // Check duration limit again
    if (duration && duration > MAX_DURATION_SECONDS) {
      return NextResponse.json(
        { error: "Video exceeds maximum duration limit" },
        { status: 400 }
      );
    }

    // Check if this video was already added by this user
    const existingDoc = await Document.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      youtubeVideoId: videoId
    });

    if (existingDoc) {
      return NextResponse.json(
        { 
          error: "Video already added",
          message: "You have already added this YouTube video.",
          documentId: existingDoc._id
        },
        { status: 409 }
      );
    }

    // Create document record
    const document = await Document.create({
      userId: new mongoose.Types.ObjectId(userId),
      fileName: title,
      fileType: "youtube",
      fileSize: 0,
      originalName: title,
      youtubeUrl: url,
      youtubeVideoId: videoId,
      youtubeThumbnail: thumbnail,
      videoDuration: duration,
      youtubeCategory: categoryId,
      isEducational: isEducational !== false, // Default to true
      status: "processing"
    });

    const documentId = String(document._id);
    console.log(`📹 YouTube document created: ${documentId} for video: ${title}`);

    // Start AI processing in background (don't await)
    processYouTubeVideo(documentId, url, title).catch(error => {
      console.error(`❌ YouTube processing failed for ${documentId}:`, error);
    });

    return NextResponse.json({
      success: true,
      message: "YouTube video added successfully. Processing will begin shortly.",
      document: {
        id: documentId,
        fileName: document.fileName,
        fileType: document.fileType,
        youtubeUrl: document.youtubeUrl,
        youtubeThumbnail: document.youtubeThumbnail,
        videoDuration: document.videoDuration,
        status: document.status
      },
      remaining: DAILY_LIMIT - todayCount - 1
    });

  } catch (error: any) {
    console.error("YouTube submission error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add YouTube video" },
      { status: 500 }
    );
  }
}

/**
 * Background function to process YouTube video with AI
 */
async function processYouTubeVideo(
  documentId: string, 
  youtubeUrl: string,
  title: string
): Promise<void> {
  try {
    console.log(`🎬 Starting YouTube AI processing for: ${title}`);
    
    // Generate content using Gemini
    const content = await generateYouTubeContent(youtubeUrl, title);
    
    // Save summary
    if (content.summary) {
      await Summary.findOneAndUpdate(
        { documentId: new mongoose.Types.ObjectId(documentId) },
        { 
          documentId: new mongoose.Types.ObjectId(documentId),
          content: content.summary 
        },
        { upsert: true, new: true }
      );
      console.log(`✅ Summary saved for YouTube video: ${documentId}`);
    }

    // Save notes
    if (content.notes) {
      await Note.findOneAndUpdate(
        { documentId: new mongoose.Types.ObjectId(documentId) },
        { 
          documentId: new mongoose.Types.ObjectId(documentId),
          content: content.notes 
        },
        { upsert: true, new: true }
      );
      console.log(`✅ Notes saved for YouTube video: ${documentId}`);
    }

    // Save flashcards
    if (content.flashcards && content.flashcards.length > 0) {
      // Delete existing flashcards
      await Flashcard.deleteMany({ 
        documentId: new mongoose.Types.ObjectId(documentId) 
      });
      
      // Create new flashcards
      const flashcardDocs = content.flashcards.map((fc: any) => ({
        documentId: new mongoose.Types.ObjectId(documentId),
        question: fc.question,
        answer: fc.answer
      }));
      
      await Flashcard.insertMany(flashcardDocs);
      console.log(`✅ ${flashcardDocs.length} flashcards saved for YouTube video: ${documentId}`);
    }

    // Save quiz questions
    if (content.quiz && content.quiz.length > 0) {
      // Delete existing questions
      await QuizQuestion.deleteMany({ 
        documentId: new mongoose.Types.ObjectId(documentId) 
      });
      
      // Create new questions
      const quizDocs = content.quiz.map((q: any) => ({
        documentId: new mongoose.Types.ObjectId(documentId),
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation
      }));
      
      await QuizQuestion.insertMany(quizDocs);
      console.log(`✅ ${quizDocs.length} quiz questions saved for YouTube video: ${documentId}`);
    }

    // Update document status to completed
    await Document.findByIdAndUpdate(documentId, { status: "completed" });
    console.log(`🎉 YouTube video processing completed: ${documentId}`);

  } catch (error: any) {
    console.error(`❌ YouTube AI processing error for ${documentId}:`, error);
    
    // Update document status to failed
    await Document.findByIdAndUpdate(documentId, { status: "failed" });
    throw error;
  }
}

