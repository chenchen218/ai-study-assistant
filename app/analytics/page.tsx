"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import Link from "next/link";

interface AnalyticsData {
  period: string;
  studyTime: {
    total: number;
    byActivity: Record<string, number>;
    daily: Array<{ _id: string; totalMinutes: number }>;
  };
  streaks: {
    current: number;
  };
  quiz: {
    total: number;
    correct: number;
    accuracy: number;
    byDocument: Array<{
      documentId: string;
      total: number;
      correct: number;
      accuracy: number;
    }>;
  };
  flashcards: {
    total: number;
    known: number;
    accuracy: number;
  };
  reports: {
    weekly: {
      totalMinutes: number;
      daysStudied: number;
      sessionsCount: number;
    };
    monthly: {
      totalMinutes: number;
      daysStudied: number;
      sessionsCount: number;
      averagePerDay: number;
    };
  };
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"week" | "month" | "all">("week");

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/analytics?period=${period}`);
        if (response.ok) {
          const analyticsData = await response.json();
          setData(analyticsData);
        }
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, period, router]);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading analytics...</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link
                href="/dashboard"
                className="text-indigo-600 hover:text-indigo-800 font-medium mr-4"
              >
                ← Back to Dashboard
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">
                Study Analytics
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Period Selector */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setPeriod("week")}
            className={`px-4 py-2 rounded-md ${
              period === "week"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setPeriod("month")}
            className={`px-4 py-2 rounded-md ${
              period === "month"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setPeriod("all")}
            className={`px-4 py-2 rounded-md ${
              period === "all"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            All Time
          </button>
        </div>

        {/* Study Streak */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-md p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100 text-sm mb-1">Current Streak</p>
              <p className="text-4xl font-bold">{data.streaks.current}</p>
              <p className="text-indigo-100 text-sm mt-1">days</p>
            </div>
            <div className="text-6xl">🔥</div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Total Study Time */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              Total Study Time
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              {formatTime(data.studyTime.total)}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {period === "week"
                ? "This week"
                : period === "month"
                ? "This month"
                : "All time"}
            </p>
          </div>

          {/* Quiz Accuracy */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              Quiz Accuracy
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              {data.quiz.total > 0
                ? `${Math.round(data.quiz.accuracy)}%`
                : "N/A"}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {data.quiz.correct} / {data.quiz.total} correct
            </p>
          </div>

          {/* Flashcard Accuracy */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              Flashcard Mastery
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              {data.flashcards.total > 0
                ? `${Math.round(data.flashcards.accuracy)}%`
                : "N/A"}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {data.flashcards.known} / {data.flashcards.total} mastered
            </p>
          </div>
        </div>

        {/* Study Time by Activity */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Study Time by Activity
          </h2>
          <div className="space-y-3">
            {Object.entries(data.studyTime.byActivity).map(
              ([activity, minutes]) => (
                <div key={activity}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {activity}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatTime(minutes)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{
                        width: `${
                          data.studyTime.total > 0
                            ? (minutes / data.studyTime.total) * 100
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Daily Study Time Chart */}
        {data.studyTime.daily.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Daily Study Time
            </h2>
            <div className="space-y-2">
              {data.studyTime.daily.map((day) => (
                <div key={day._id} className="flex items-center">
                  <span className="text-sm text-gray-600 w-24">
                    {new Date(day._id).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <div className="flex-1 mx-4">
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-indigo-600 h-4 rounded-full"
                        style={{
                          width: `${
                            Math.max(
                              ...data.studyTime.daily.map((d) => d.totalMinutes)
                            ) > 0
                              ? (day.totalMinutes /
                                  Math.max(
                                    ...data.studyTime.daily.map(
                                      (d) => d.totalMinutes
                                    )
                                  )) *
                                100
                              : 0
                          }%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-20 text-right">
                    {formatTime(day.totalMinutes)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weekly Report */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Weekly Report
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Total Time</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatTime(data.reports.weekly.totalMinutes)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Days Studied</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.reports.weekly.daysStudied}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Sessions</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.reports.weekly.sessionsCount}
              </p>
            </div>
          </div>
        </div>

        {/* Monthly Report */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Monthly Report
          </h2>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Total Time</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatTime(data.reports.monthly.totalMinutes)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Days Studied</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.reports.monthly.daysStudied}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Sessions</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.reports.monthly.sessionsCount}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg per Day</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatTime(data.reports.monthly.averagePerDay)}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
