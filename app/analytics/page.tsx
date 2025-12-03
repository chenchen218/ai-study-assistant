"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import Link from "next/link";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { ChevronDown, ChevronUp, Trash2, X } from "lucide-react";

// Interface for mastered flashcard data
interface MasteredFlashcard {
  performanceId: string;
  flashcardId: string;
  question: string;
  answer: string;
  documentId: string;
  documentName: string;
  masteredAt: string;
}

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
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"week" | "month" | "all">("week");
  
  // Flashcard mastery management states
  const [showMasteredFlashcards, setShowMasteredFlashcards] = useState(false);
  const [masteredFlashcards, setMasteredFlashcards] = useState<MasteredFlashcard[]>([]);
  const [loadingMastered, setLoadingMastered] = useState(false);
  const [removingFlashcard, setRemovingFlashcard] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return; // Still checking auth, don't do anything yet
    }
    if (!user) {
      router.push("/login");
      return;
    }
    /**
     * Fetches analytics data for the selected time period
     * @throws {Error} If the API request fails
     */
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/analytics?period=${period}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            error: `HTTP ${response.status}: ${response.statusText}`,
          }));
          throw new Error(errorData.error || `Failed to load analytics: ${response.statusText}`);
        }

        const analyticsData = await response.json();
        setData(analyticsData);
      } catch (error) {
        console.error("Error fetching analytics:", error);
        // Analytics errors are non-critical, just log them
        // Could add a toast notification here if needed
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

  // Fetch mastered flashcards when expanded
  const fetchMasteredFlashcards = async () => {
    if (masteredFlashcards.length > 0) return; // Already loaded
    
    setLoadingMastered(true);
    try {
      const response = await fetch("/api/analytics/flashcards/mastered");
      if (response.ok) {
        const data = await response.json();
        setMasteredFlashcards(data.flashcards);
      }
    } catch (error) {
      console.error("Error fetching mastered flashcards:", error);
    } finally {
      setLoadingMastered(false);
    }
  };

  // Remove flashcard mastery
  const removeMastery = async (flashcardId: string) => {
    if (!confirm("Remove this flashcard from your mastered list? It will count as 'not known' again.")) {
      return;
    }

    setRemovingFlashcard(flashcardId);
    try {
      const response = await fetch("/api/analytics/flashcards/mastered", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flashcardId }),
      });

      if (response.ok) {
        // Remove from local state
        setMasteredFlashcards(prev => prev.filter(f => f.flashcardId !== flashcardId));
        
        // Update the main analytics data
        if (data) {
          setData({
            ...data,
            flashcards: {
              ...data.flashcards,
              known: Math.max(0, data.flashcards.known - 1),
              accuracy: data.flashcards.total > 0 
                ? ((data.flashcards.known - 1) / data.flashcards.total) * 100 
                : 0,
            },
          });
        }
      } else {
        const error = await response.json();
        alert(error.error || "Failed to remove mastery");
      }
    } catch (error) {
      console.error("Error removing mastery:", error);
      alert("Failed to remove mastery. Please try again.");
    } finally {
      setRemovingFlashcard(null);
    }
  };

  // Toggle mastered flashcards panel
  const toggleMasteredFlashcards = () => {
    const newState = !showMasteredFlashcards;
    setShowMasteredFlashcards(newState);
    if (newState) {
      fetchMasteredFlashcards();
    }
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
      <nav className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link
                href="/dashboard"
                className="text-primary hover:underline mr-4"
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
          <Button
            onClick={() => setPeriod("week")}
            variant={period === "week" ? "default" : "outline"}
          >
            This Week
          </Button>
          <Button
            onClick={() => setPeriod("month")}
            variant={period === "month" ? "default" : "outline"}
          >
            This Month
          </Button>
          <Button
            onClick={() => setPeriod("all")}
            variant={period === "all" ? "default" : "outline"}
          >
            All Time
          </Button>
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
          <Card>
            <CardContent className="p-6">
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
            </CardContent>
          </Card>

          {/* Quiz Accuracy */}
          <Card>
            <CardContent className="p-6">
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
            </CardContent>
          </Card>

          {/* Flashcard Mastery - Clickable to expand */}
          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg ${showMasteredFlashcards ? 'ring-2 ring-indigo-500' : ''}`}
            onClick={toggleMasteredFlashcards}
          >
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
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
                <div className="text-gray-400">
                  {showMasteredFlashcards ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </div>
              </div>
              <p className="text-xs text-indigo-600 mt-3">
                Click to {showMasteredFlashcards ? 'hide' : 'manage'} mastered flashcards
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Mastered Flashcards Panel */}
        {showMasteredFlashcards && (
          <Card className="mb-6 border-indigo-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Mastered Flashcards
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMasteredFlashcards(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Review your mastered flashcards. If you feel you&apos;ve forgotten one, click the remove button to reset its mastery status.
              </p>

              {loadingMastered ? (
                <div className="text-center py-8 text-gray-500">
                  Loading mastered flashcards...
                </div>
              ) : masteredFlashcards.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No mastered flashcards yet. Keep studying!
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {masteredFlashcards.map((flashcard) => (
                    <div
                      key={flashcard.flashcardId}
                      className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-indigo-600 font-medium mb-1">
                            {flashcard.documentName}
                          </p>
                          <p className="font-medium text-gray-900 mb-2">
                            Q: {flashcard.question}
                          </p>
                          <p className="text-sm text-gray-600">
                            A: {flashcard.answer}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            Mastered: {new Date(flashcard.masteredAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMastery(flashcard.flashcardId);
                          }}
                          disabled={removingFlashcard === flashcard.flashcardId}
                        >
                          {removingFlashcard === flashcard.flashcardId ? (
                            <span className="text-xs">Removing...</span>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-1" />
                              <span className="text-xs">Remove</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Study Time by Activity */}
        <Card className="mb-6">
          <CardContent className="p-6">
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
          </CardContent>
        </Card>

        {/* Daily Study Time Chart */}
        {data.studyTime.daily.length > 0 && (
          <Card className="mb-6">
            <CardContent className="p-6">
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
            </CardContent>
          </Card>
        )}

        {/* Weekly Report */}
        <Card className="mb-6">
          <CardContent className="p-6">
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
          </CardContent>
        </Card>

        {/* Monthly Report */}
        <Card>
          <CardContent className="p-6">
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
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
