"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import Link from "next/link";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { ChevronDown, ChevronUp, ChevronRight, Trash2, X, FileText, Trophy, Target } from "lucide-react";

// Interface for mastered flashcard data grouped by document
interface MasteredFlashcardDocument {
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
}

// Interface for quiz history grouped by document
interface QuizHistoryDocument {
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
  }>;
  totalAttempts: number;
  totalCorrect: number;
  overallAccuracy: number;
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
  const [masteredDocuments, setMasteredDocuments] = useState<MasteredFlashcardDocument[]>([]);
  const [expandedMasteredDocs, setExpandedMasteredDocs] = useState<Set<string>>(new Set());
  const [loadingMastered, setLoadingMastered] = useState(false);
  const [removingFlashcard, setRemovingFlashcard] = useState<string | null>(null);

  // Quiz history states
  const [showQuizHistory, setShowQuizHistory] = useState(false);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryDocument[]>([]);
  const [expandedQuizDocs, setExpandedQuizDocs] = useState<Set<string>>(new Set());
  const [loadingQuizHistory, setLoadingQuizHistory] = useState(false);

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
    if (masteredDocuments.length > 0) return; // Already loaded
    
    setLoadingMastered(true);
    try {
      const response = await fetch("/api/analytics/flashcards/mastered");
      if (response.ok) {
        const result = await response.json();
        setMasteredDocuments(result.documents || []);
        // Expand all documents by default
        const allDocIds = new Set<string>((result.documents || []).map((d: MasteredFlashcardDocument) => d.document.id));
        setExpandedMasteredDocs(allDocIds);
      }
    } catch (error) {
      console.error("Error fetching mastered flashcards:", error);
    } finally {
      setLoadingMastered(false);
    }
  };

  // Fetch quiz history when expanded
  const fetchQuizHistory = async () => {
    if (quizHistory.length > 0) return; // Already loaded
    
    setLoadingQuizHistory(true);
    try {
      const response = await fetch("/api/analytics/quiz/history");
      if (response.ok) {
        const result = await response.json();
        setQuizHistory(result.documents || []);
        // Expand all documents by default
        const allDocIds = new Set<string>((result.documents || []).map((d: QuizHistoryDocument) => d.document.id));
        setExpandedQuizDocs(allDocIds);
      }
    } catch (error) {
      console.error("Error fetching quiz history:", error);
    } finally {
      setLoadingQuizHistory(false);
    }
  };

  // Toggle document expansion for mastered flashcards
  const toggleMasteredDoc = (docId: string) => {
    setExpandedMasteredDocs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  // Toggle document expansion for quiz history
  const toggleQuizDoc = (docId: string) => {
    setExpandedQuizDocs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
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
        setMasteredDocuments(prev => 
          prev.map(doc => ({
            ...doc,
            flashcards: doc.flashcards.filter(f => f.flashcardId !== flashcardId)
          })).filter(doc => doc.flashcards.length > 0)
        );
        
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

  // Toggle quiz history panel
  const toggleQuizHistory = () => {
    const newState = !showQuizHistory;
    setShowQuizHistory(newState);
    if (newState) {
      fetchQuizHistory();
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

          {/* Quiz Accuracy - Clickable to expand */}
          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg ${showQuizHistory ? 'ring-2 ring-green-500' : ''}`}
            onClick={toggleQuizHistory}
          >
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
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
                <div className="text-gray-400">
                  {showQuizHistory ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </div>
              </div>
              <p className="text-xs text-green-600 mt-3">
                Click to {showQuizHistory ? 'hide' : 'view'} quiz history
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
                    {data.flashcards.known}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    {data.flashcards.known > 0 
                      ? "cards mastered"
                      : "No mastered cards"}
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

        {/* Quiz History Panel */}
        {showQuizHistory && (
          <Card className="mb-6 border-green-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-600" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    Quiz History
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowQuizHistory(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {loadingQuizHistory ? (
                <div className="text-center py-8 text-gray-500">
                  Loading quiz history...
                </div>
              ) : quizHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No quiz attempts yet. Start a quiz to see your history!
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {quizHistory.map((docData) => (
                    <div key={docData.document.id} className="border rounded-lg overflow-hidden">
                      {/* Document Header - Clickable to expand */}
                      <button
                        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleQuizDoc(docData.document.id);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-green-600" />
                          <div className="text-left">
                            <p className="font-medium text-gray-900">
                              {docData.document.fileName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {docData.sessions.length} session{docData.sessions.length !== 1 ? 's' : ''} • 
                              Overall: {docData.overallAccuracy}%
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-green-600">
                            {docData.totalCorrect}/{docData.totalAttempts}
                          </span>
                          {expandedQuizDocs.has(docData.document.id) ? (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* Quiz Sessions List */}
                      {expandedQuizDocs.has(docData.document.id) && (
                        <div className="border-t bg-white p-4 space-y-2">
                          {docData.sessions.map((session, idx) => (
                            <div
                              key={`${docData.document.id}-${session.date}-${idx}`}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  session.score >= 80 ? 'bg-green-100 text-green-600' :
                                  session.score >= 60 ? 'bg-yellow-100 text-yellow-600' :
                                  'bg-red-100 text-red-600'
                                }`}>
                                  <Trophy className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {new Date(session.date).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {session.correct} / {session.total} correct
                                  </p>
                                </div>
                              </div>
                              <div className={`text-2xl font-bold ${
                                session.score >= 80 ? 'text-green-600' :
                                session.score >= 60 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {session.score}%
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mastered Flashcards Panel */}
        {showMasteredFlashcards && (
          <Card className="mb-6 border-indigo-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-indigo-600" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    Mastered Flashcards
                  </h2>
                </div>
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

              {loadingMastered ? (
                <div className="text-center py-8 text-gray-500">
                  Loading mastered flashcards...
                </div>
              ) : masteredDocuments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No mastered flashcards yet. Keep studying!
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {masteredDocuments.map((docData) => (
                    <div key={docData.document.id} className="border rounded-lg overflow-hidden">
                      {/* Document Header - Clickable to expand */}
                      <button
                        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMasteredDoc(docData.document.id);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-indigo-600" />
                          <div className="text-left">
                            <p className="font-medium text-gray-900">
                              {docData.document.fileName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {docData.flashcards.length} flashcard{docData.flashcards.length !== 1 ? 's' : ''} mastered
                            </p>
                          </div>
                        </div>
                        {expandedMasteredDocs.has(docData.document.id) ? (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        )}
                      </button>

                      {/* Flashcards List */}
                      {expandedMasteredDocs.has(docData.document.id) && (
                        <div className="border-t bg-white p-4 space-y-3">
                          {docData.flashcards.map((flashcard) => (
                            <div
                              key={flashcard.flashcardId}
                              className="p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="flex justify-between items-start gap-4">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 mb-1">
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
