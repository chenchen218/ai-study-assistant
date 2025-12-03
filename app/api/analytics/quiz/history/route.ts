/**
 * Quiz History API Route
 * 
 * Returns quiz attempt history grouped by document, showing scores for each quiz session.
 * 
 * @route GET /api/analytics/quiz/history
 * @access Protected (requires authentication)
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { QuizPerformance } from "@/models/QuizPerformance";
import { Document as DocumentModel } from "@/models/Document";

// Force dynamic rendering since we use request.headers for authentication
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all quiz performances for this user
    const quizPerformances = await QuizPerformance.find({
      userId: new mongoose.Types.ObjectId(userId),
    }).sort({ attemptedAt: -1 }).lean();

    // Get unique document IDs
    const documentIds = [...new Set(quizPerformances.map(p => String(p.documentId)))];

    // Fetch document details
    const documents = await DocumentModel.find({
      _id: { $in: documentIds.map(id => new mongoose.Types.ObjectId(id)) }
    }).lean();

    // Create a map for quick lookup
    const documentMap = new Map<string, typeof documents[0]>();
    for (const d of documents) {
      documentMap.set(String(d._id), d);
    }

    // Group quiz performances by document and then by session (date)
    // A "session" is all quiz questions answered on the same day for the same document
    const groupedByDocument: Record<string, {
      document: {
        id: string;
        fileName: string;
        fileType: string;
      };
      sessions: Array<{
        date: string;
        total: number;
        correct: number;
        score: number;
        questions: Array<{
          id: string;
          isCorrect: boolean;
          timeSpent: number;
          attemptedAt: string;
        }>;
      }>;
      totalAttempts: number;
      totalCorrect: number;
      overallAccuracy: number;
    }> = {};

    for (const performance of quizPerformances) {
      const documentId = String(performance.documentId);
      const document = documentMap.get(documentId);
      
      // Get date string for grouping sessions
      const attemptDate = new Date(performance.attemptedAt);
      const dateStr = attemptDate.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!groupedByDocument[documentId]) {
        groupedByDocument[documentId] = {
          document: {
            id: documentId,
            fileName: document?.fileName || "[Document Deleted]",
            fileType: document?.fileType || "unknown",
          },
          sessions: [],
          totalAttempts: 0,
          totalCorrect: 0,
          overallAccuracy: 0,
        };
      }

      // Find or create session for this date
      let session = groupedByDocument[documentId].sessions.find(s => s.date === dateStr);
      if (!session) {
        session = {
          date: dateStr,
          total: 0,
          correct: 0,
          score: 0,
          questions: [],
        };
        groupedByDocument[documentId].sessions.push(session);
      }

      // Add question to session
      session.questions.push({
        id: String(performance._id),
        isCorrect: performance.isCorrect,
        timeSpent: performance.timeSpent || 0,
        attemptedAt: attemptDate.toISOString(),
      });
      session.total++;
      if (performance.isCorrect) {
        session.correct++;
      }

      // Update document totals
      groupedByDocument[documentId].totalAttempts++;
      if (performance.isCorrect) {
        groupedByDocument[documentId].totalCorrect++;
      }
    }

    // Calculate scores and accuracy for each document and session
    for (const docData of Object.values(groupedByDocument)) {
      // Sort sessions by date (newest first)
      docData.sessions.sort((a, b) => b.date.localeCompare(a.date));
      
      // Calculate session scores
      for (const session of docData.sessions) {
        session.score = session.total > 0 
          ? Math.round((session.correct / session.total) * 100) 
          : 0;
      }
      
      // Calculate overall accuracy
      docData.overallAccuracy = docData.totalAttempts > 0 
        ? Math.round((docData.totalCorrect / docData.totalAttempts) * 100) 
        : 0;
    }

    // Convert to array and sort by most recent activity
    const result = Object.values(groupedByDocument).sort((a, b) => {
      const aLatest = a.sessions[0]?.date || '';
      const bLatest = b.sessions[0]?.date || '';
      return bLatest.localeCompare(aLatest);
    });

    // Calculate totals
    const totalAttempts = result.reduce((sum, d) => sum + d.totalAttempts, 0);
    const totalCorrect = result.reduce((sum, d) => sum + d.totalCorrect, 0);

    return NextResponse.json({
      success: true,
      documents: result,
      totalDocuments: result.length,
      totalAttempts,
      totalCorrect,
      overallAccuracy: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
    });
  } catch (error: any) {
    console.error("Get quiz history error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

