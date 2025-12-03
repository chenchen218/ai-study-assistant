/**
 * Mastered Flashcards API Route
 * 
 * This endpoint manages flashcard mastery records:
 * - GET: Retrieve list of mastered flashcards grouped by document
 * - DELETE: Remove a flashcard mastery record (user forgot the card)
 * 
 * @route GET /api/analytics/flashcards/mastered
 * @route DELETE /api/analytics/flashcards/mastered
 * @access Protected (requires authentication)
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { FlashcardPerformance } from "@/models/FlashcardPerformance";
import { Flashcard } from "@/models/Flashcard";
import { Document as DocumentModel } from "@/models/Document";

// Force dynamic rendering since we use request.headers for authentication
export const dynamic = 'force-dynamic';

/**
 * GET: Retrieve list of mastered flashcards grouped by document
 * 
 * Returns flashcards grouped by their parent document, similar to Error Book
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all mastered flashcard performances for this user
    const masteredPerformances = await FlashcardPerformance.find({
      userId: new mongoose.Types.ObjectId(userId),
      isKnown: true,
    }).sort({ reviewedAt: -1 }).lean();

    // Get unique flashcard IDs
    const flashcardIds = [...new Set(masteredPerformances.map(p => String(p.flashcardId)))];

    // Fetch flashcard details
    const flashcards = await Flashcard.find({
      _id: { $in: flashcardIds.map(id => new mongoose.Types.ObjectId(id)) }
    }).lean();

    // Create a map for quick lookup
    const flashcardMap = new Map<string, typeof flashcards[0]>();
    for (const f of flashcards) {
      flashcardMap.set(String(f._id), f);
    }

    // Get document IDs from flashcards
    const documentIds = [...new Set(flashcards.map(f => String(f.documentId)))];

    // Fetch document details
    const documents = await DocumentModel.find({
      _id: { $in: documentIds.map(id => new mongoose.Types.ObjectId(id)) }
    }).lean();

    // Create a map for quick lookup
    const documentMap = new Map<string, typeof documents[0]>();
    for (const d of documents) {
      documentMap.set(String(d._id), d);
    }

    // Group flashcards by document
    const groupedByDocument: Record<string, {
      document: {
        id: string;
        fileName: string;
        fileType: string;
      };
      flashcards: Array<{
        performanceId: string;
        flashcardId: string;
        question: string;
        answer: string;
        masteredAt: string;
      }>;
    }> = {};

    // Track which flashcards we've already added (to avoid duplicates)
    const addedFlashcards = new Set<string>();

    for (const performance of masteredPerformances) {
      const flashcardId = String(performance.flashcardId);
      
      // Skip if we already have this flashcard
      if (addedFlashcards.has(flashcardId)) continue;
      addedFlashcards.add(flashcardId);

      const flashcard = flashcardMap.get(flashcardId);
      if (!flashcard) continue; // Flashcard might have been deleted

      const documentId = String(flashcard.documentId);
      const document = documentMap.get(documentId);

      if (!groupedByDocument[documentId]) {
        groupedByDocument[documentId] = {
          document: {
            id: documentId,
            fileName: document?.fileName || "[Document Deleted]",
            fileType: document?.fileType || "unknown",
          },
          flashcards: [],
        };
      }

      groupedByDocument[documentId].flashcards.push({
        performanceId: String(performance._id),
        flashcardId: flashcardId,
        question: flashcard.question,
        answer: flashcard.answer,
        masteredAt: performance.reviewedAt ? new Date(performance.reviewedAt).toISOString() : new Date().toISOString(),
      });
    }

    // Convert to array and sort by document name
    const result = Object.values(groupedByDocument).sort((a, b) => 
      a.document.fileName.localeCompare(b.document.fileName)
    );

    return NextResponse.json({
      success: true,
      documents: result,
      totalDocuments: result.length,
      totalFlashcards: addedFlashcards.size,
    });
  } catch (error: any) {
    console.error("Get mastered flashcards error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Remove a flashcard mastery record
 */
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { performanceId, flashcardId } = await request.json();

    if (!performanceId && !flashcardId) {
      return NextResponse.json(
        { error: "performanceId or flashcardId is required" },
        { status: 400 }
      );
    }

    let deleteResult;

    if (flashcardId) {
      // Delete all mastery records for this flashcard (for this user)
      deleteResult = await FlashcardPerformance.deleteMany({
        userId: new mongoose.Types.ObjectId(userId),
        flashcardId: new mongoose.Types.ObjectId(flashcardId),
        isKnown: true,
      });
    } else {
      // Delete specific performance record
      deleteResult = await FlashcardPerformance.deleteOne({
        _id: new mongoose.Types.ObjectId(performanceId),
        userId: new mongoose.Types.ObjectId(userId),
      });
    }

    if (deleteResult.deletedCount === 0) {
      return NextResponse.json(
        { error: "Mastery record not found or already removed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Flashcard mastery removed successfully",
      deletedCount: deleteResult.deletedCount,
    });
  } catch (error: any) {
    console.error("Delete flashcard mastery error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
