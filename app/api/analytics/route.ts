import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { StudySession } from "@/models/StudySession";
import { QuizPerformance } from "@/models/QuizPerformance";
import { FlashcardPerformance } from "@/models/FlashcardPerformance";

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "week"; // week, month, all

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    if (period === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "month") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(0); // All time
    }

    // Get study sessions
    const studySessions = await StudySession.find({
      userId,
      startTime: { $gte: startDate },
    }).sort({ startTime: -1 });

    // Calculate total study time
    const totalStudyTime = studySessions.reduce(
      (total, session) => total + (session.duration || 0),
      0
    );

    // Study time by activity type
    const studyTimeByActivity = studySessions.reduce((acc, session) => {
      acc[session.activityType] =
        (acc[session.activityType] || 0) + (session.duration || 0);
      return acc;
    }, {} as Record<string, number>);

    // Study streaks (consecutive days with study sessions)
    const studyStreak = await calculateStudyStreak(userId);

    // Get quiz performances
    const quizPerformances = await QuizPerformance.find({
      userId,
      attemptedAt: { $gte: startDate },
    });

    // Quiz statistics
    const totalQuizzes = quizPerformances.length;
    const correctQuizzes = quizPerformances.filter((p) => p.isCorrect).length;
    const quizAccuracy =
      totalQuizzes > 0 ? (correctQuizzes / totalQuizzes) * 100 : 0;

    // Quiz accuracy by document
    const quizByDocument = await QuizPerformance.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          attemptedAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: "$documentId",
          total: { $sum: 1 },
          correct: {
            $sum: { $cond: ["$isCorrect", 1, 0] },
          },
        },
      },
      {
        $project: {
          documentId: "$_id",
          total: 1,
          correct: 1,
          accuracy: {
            $cond: [
              { $eq: ["$total", 0] },
              0,
              { $multiply: [{ $divide: ["$correct", "$total"] }, 100] },
            ],
          },
        },
      },
    ]);

    // Get flashcard performances
    const flashcardPerformances = await FlashcardPerformance.find({
      userId,
      reviewedAt: { $gte: startDate },
    });

    // Flashcard statistics
    const totalFlashcards = flashcardPerformances.length;
    const knownFlashcards = flashcardPerformances.filter(
      (p) => p.isKnown
    ).length;
    const flashcardAccuracy =
      totalFlashcards > 0 ? (knownFlashcards / totalFlashcards) * 100 : 0;

    // Daily study time (for charts)
    const dailyStudyTime = await StudySession.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          startTime: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$startTime" },
          },
          totalMinutes: { $sum: "$duration" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Weekly/Monthly reports data
    const weeklyReport = await generateWeeklyReport(userId);
    const monthlyReport = await generateMonthlyReport(userId);

    return NextResponse.json({
      period,
      studyTime: {
        total: totalStudyTime, // in minutes
        byActivity: studyTimeByActivity,
        daily: dailyStudyTime,
      },
      streaks: {
        current: studyStreak,
      },
      quiz: {
        total: totalQuizzes,
        correct: correctQuizzes,
        accuracy: Math.round(quizAccuracy * 100) / 100,
        byDocument: quizByDocument,
      },
      flashcards: {
        total: totalFlashcards,
        known: knownFlashcards,
        accuracy: Math.round(flashcardAccuracy * 100) / 100,
      },
      reports: {
        weekly: weeklyReport,
        monthly: monthlyReport,
      },
    });
  } catch (error: any) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

async function calculateStudyStreak(userId: string): Promise<number> {
  const sessions = await StudySession.find({
    userId,
  })
    .sort({ startTime: -1 })
    .limit(30);

  if (sessions.length === 0) return 0;

  // Get unique study dates
  const studyDates = new Set<string>();
  sessions.forEach((session) => {
    const date = new Date(session.startTime).toDateString();
    studyDates.add(date);
  });

  // Calculate consecutive days
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toDateString();

    if (studyDates.has(dateStr)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

async function generateWeeklyReport(userId: string) {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const sessions = await StudySession.find({
    userId,
    startTime: { $gte: weekStart },
  });

  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const daysStudied = new Set(
    sessions.map((s) => new Date(s.startTime).toDateString())
  ).size;

  return {
    totalMinutes,
    daysStudied,
    sessionsCount: sessions.length,
  };
}

async function generateMonthlyReport(userId: string) {
  const monthStart = new Date();
  monthStart.setDate(monthStart.getDate() - 30);
  monthStart.setHours(0, 0, 0, 0);

  const sessions = await StudySession.find({
    userId,
    startTime: { $gte: monthStart },
  });

  const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const daysStudied = new Set(
    sessions.map((s) => new Date(s.startTime).toDateString())
  ).size;

  return {
    totalMinutes,
    daysStudied,
    sessionsCount: sessions.length,
    averagePerDay: daysStudied > 0 ? Math.round(totalMinutes / daysStudied) : 0,
  };
}
