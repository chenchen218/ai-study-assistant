import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Document } from "@/models/Document";
import { StudySession } from "@/models/StudySession";
import { QuizPerformance } from "@/models/QuizPerformance";
import { getUserIdFromRequest } from "@/lib/auth";

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

/**
 * GET /api/profile/stats
 * Gets user's account statistics for profile page
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get document count
    const documentCount = await Document.countDocuments({ userId });

    // Get total study time (in minutes)
    const studySessions = await StudySession.find({ userId });
    const totalStudyTime = studySessions.reduce(
      (total, session) => total + (session.duration || 0),
      0
    );

    // Get quiz count
    const quizCount = await QuizPerformance.countDocuments({ userId });

    // Calculate study streak (consecutive days)
    const sessions = await StudySession.find({ userId })
      .sort({ startTime: -1 })
      .limit(30);

    let studyStreak = 0;
    if (sessions.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let currentDate = new Date(today);
      let consecutiveDays = 0;

      for (const session of sessions) {
        const sessionDate = new Date(session.startTime);
        sessionDate.setHours(0, 0, 0, 0);

        if (sessionDate.getTime() === currentDate.getTime()) {
          consecutiveDays++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else if (sessionDate.getTime() < currentDate.getTime()) {
          break;
        }
      }

      studyStreak = consecutiveDays;
    }

    return NextResponse.json({
      success: true,
      stats: {
        documentCount,
        totalStudyTime, // in minutes
        quizCount,
        studyStreak,
      },
    });
  } catch (error: any) {
    console.error("Error fetching profile stats:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

