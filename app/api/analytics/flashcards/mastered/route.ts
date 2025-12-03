/**
 * Mastered Flashcards API Route
 * 
 * This endpoint manages flashcard mastery records:
 * - GET: Retrieve list of mastered flashcards with details
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
import { Flashcard, IFlashcard } from "@/models/Flashcard";
import { Document as DocumentModel, IDocument } from "@/models/Document";

// Force dynamic rendering since we use request.headers for authentication
export const dynamic = 'force-dynamic';

/**
 * GET: Retrieve list of mastered flashcards with details
 * 
 * Returns all flashcards the user has marked as "known" with:
 * - Flashcard question and answer
 * - Document name it belongs to
 * - When it was mastered
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
    }).sort({ reviewedAt: -1 });

    // Get unique flashcard IDs
    const flashcardIds = [...new Set(masteredPerformances.map(p => p.flashcardId.toString()))];

    // Fetch flashcard details with explicit typing
    const flashcards: IFlashcard[] = await Flashcard.find({
      _id: { $in: flashcardIds.map(id => new mongoose.Types.ObjectId(id)) }
    });

    // Create a map for quick lookup
    const flashcardMap = new Map<string, IFlashcard>(
      flashcards.map(f => [f._id.toString(), f])
    );

    // Get document IDs from flashcards
    const documentIds = [...new Set(flashcards.map(f => f.documentId.toString()))];

    // Fetch document details with explicit typing
    const documents: IDocument[] = await DocumentModel.find({
      _id: { $in: documentIds.map(id => new mongoose.Types.ObjectId(id)) }
    });

    // Create a map for quick lookup
    const documentMap = new Map<string, IDocument>(
      documents.map(d => [d._id.toString(), d])
    );

    // Build response with flashcard details
    // Group by flashcard to avoid duplicates (user might have marked same card multiple times)
    const masteredFlashcardsMap = new Map();

    for (const performance of masteredPerformances) {
      const flashcardId = performance.flashcardId.toString();
      
      // Skip if we already have this flashcard (keep the most recent one)
      if (masteredFlashcardsMap.has(flashcardId)) continue;

      const flashcard = flashcardMap.get(flashcardId);
      if (!flashcard) continue; // Flashcard might have been deleted

      const document = documentMap.get(flashcard.documentId.toString());

      masteredFlashcardsMap.set(flashcardId, {
        performanceId: performance._id.toString(),
        flashcardId: flashcardId,
        question: flashcard.question,
        answer: flashcard.answer,
        documentId: flashcard.documentId.toString(),
        documentName: document?.fileName || "Unknown Document",
        masteredAt: performance.reviewedAt,
      });
    }

    const masteredFlashcards = Array.from(masteredFlashcardsMap.values());

    return NextResponse.json({
      total: masteredFlashcards.length,
      flashcards: masteredFlashcards,
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
 * 
 * When a user feels they've forgotten a flashcard, they can remove it from
 * their mastered list so it will be counted as "not known" again.
 * 
 * @body performanceId - ID of the FlashcardPerformance record to delete
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

