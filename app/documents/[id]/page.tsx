"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import {
  BookOpen,
  Sparkles,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Trophy,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Send,
  FileText,
  ArrowLeft,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../../providers/AuthProvider";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Textarea } from "../../components/ui/textarea";
import { useToast } from "../../components/ui/use-toast";
import { Skeleton } from "../../components/ui/skeleton";

interface DocumentData {
  document: {
    id: string;
    fileName: string;
    status: string;
  };
  summary: {
    id: string;
    content: string;
  } | null;
  notes: {
    id: string;
    title: string;
    content: string;
  } | null;
  flashcards: Array<{
    id: string;
    question: string;
    answer: string;
  }>;
  quizQuestions: Array<{
    id: string;
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  }>;
}

type TabId = "summary" | "notes" | "flashcards" | "quiz" | "qa";

interface QAMessage {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: string;
}

const markdownComponents: Components = {
  h1: ({ ...props }) => (
    <h2 className="mt-8 mb-4 text-3xl font-semibold tracking-tight text-foreground" {...props} />
  ),
  h2: ({ ...props }) => (
    <h3 className="mt-6 mb-3 text-2xl font-semibold tracking-tight text-foreground" {...props} />
  ),
  h3: ({ ...props }) => (
    <h4 className="mt-4 mb-2 text-xl font-semibold tracking-tight text-foreground" {...props} />
  ),
  p: ({ ...props }) => (
    <p className="mb-4 leading-relaxed text-foreground" {...props} />
  ),
  ul: ({ ...props }) => (
    <ul className="mb-4 ml-6 list-disc space-y-2 text-foreground" {...props} />
  ),
  ol: ({ ...props }) => (
    <ol className="mb-4 ml-6 list-decimal space-y-2 text-foreground" {...props} />
  ),
  li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
  strong: ({ ...props }) => <strong className="font-semibold text-foreground" {...props} />,
  code: ({ ...props }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono text-foreground" {...props} />
  ),
  blockquote: ({ ...props }) => (
    <blockquote className="my-4 border-l-4 border-primary/30 bg-muted/50 pl-4 italic text-foreground" {...props} />
  ),
};

/**
 * Tab configuration for document detail view
 */
const tabs: Array<{ id: TabId; label: string; icon: typeof BookOpen }> = [
  { id: "summary", label: "Summary", icon: Sparkles },
  { id: "notes", label: "Notes", icon: BookOpen },
  { id: "flashcards", label: "Flashcards", icon: RotateCw },
  { id: "quiz", label: "Quiz", icon: Trophy },
  { id: "qa", label: "Q&A", icon: MessageCircle },
];

/**
 * Document detail page component - Study workspace for a single document
 * Features:
 * - AI-generated summary
 * - Study notes
 * - Interactive flashcards with feedback
 * - Quiz with scoring
 * - Q&A chat with AI tutor
 * - Study session tracking
 */
export default function DocumentPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const documentId = (params?.id as string) || "";

  const [data, setData] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [currentFlashcard, setCurrentFlashcard] = useState(0);
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false);
  const [flashcardFeedbackLoading, setFlashcardFeedbackLoading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizSelectedAnswer, setQuizSelectedAnswer] = useState<number | null>(null);
  const [quizShowResult, setQuizShowResult] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(() => Date.now());
  const [qaMessages, setQaMessages] = useState<QAMessage[]>(() => [
    {
      id: "welcome",
      type: "ai",
      content: "Hi there! I'm your AI study assistant. Ask me anything about this document and I'll help you understand it better.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [question, setQuestion] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const qaScrollRef = useRef<HTMLDivElement>(null);
  const [studySessionId, setStudySessionId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!documentId) {
      setLoading(false);
      return;
    }

    let sessionId: string | null = null;
    let startTime: number | null = null;

    const startSession = async () => {
      try {
        const response = await fetch("/api/analytics/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "start",
            documentId,
            activityType: "reading",
          }),
        });
        if (response.ok) {
          const session = await response.json();
          sessionId = session.sessionId;
          startTime = Date.now();
          setStudySessionId(sessionId);
          setSessionStartTime(startTime);
        }
      } catch (error) {
        console.error("Error starting study session:", error);
      }
    };

    const endSession = async () => {
      if (!sessionId || !startTime) return;
      const duration = Math.max(1, Math.floor((Date.now() - startTime) / 60000));
      try {
        await fetch("/api/analytics/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "end",
            sessionId,
            duration,
          }),
        });
      } catch (error) {
        console.error("Error ending study session:", error);
      }
    };

    /**
     * Fetches document data including summary, notes, flashcards, and quiz questions
     * @throws {Error} If the API request fails or document is not found
     */
    const fetchDoc = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            error: `HTTP ${response.status}: ${response.statusText}`,
          }));
          
          if (response.status === 404) {
            toast({
              title: "Document not found",
              description: "The document you're looking for doesn't exist or has been deleted.",
              variant: "destructive",
            });
          } else {
            throw new Error(errorData.error || `Failed to load document: ${response.statusText}`);
          }
          router.push("/dashboard");
          return;
        }

        const documentData = (await response.json()) as DocumentData;
        setData(documentData);
        setActiveTab("summary");
        setCurrentFlashcard(0);
        setIsFlashcardFlipped(false);
        setCurrentQuestionIndex(0);
        setQuizSelectedAnswer(null);
        setQuizShowResult(false);
        setQuizCompleted(false);
        setQuizScore(0);
        setQuestionStartTime(Date.now());
      } catch (error) {
        console.error("Error fetching document:", error);
        const errorMessage = error instanceof Error 
          ? error.message 
          : "Failed to load document. Please try again.";
        toast({
          title: "Error loading document",
          description: errorMessage,
          variant: "destructive",
        });
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
    startSession();

    return () => {
      void endSession();
    };
  }, [user, documentId, router]);

  useEffect(() => {
    if (qaScrollRef.current) {
      qaScrollRef.current.scrollTo({
        top: qaScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [qaMessages]);

  const handleFlashcardNavigation = (direction: "next" | "previous") => {
    if (!data?.flashcards.length) return;
    setIsFlashcardFlipped(false);
    setCurrentFlashcard((prev) => {
      if (direction === "next") {
        return (prev + 1) % data.flashcards.length;
      }
      return (prev - 1 + data.flashcards.length) % data.flashcards.length;
    });
  };

  /**
   * Records user feedback for a flashcard (known/needs review)
   * @param isKnown - Whether the user knows the answer
   * @throws {Error} If the API request fails (non-blocking, logged only)
   */
  const handleFlashcardFeedback = async (isKnown: boolean) => {
    if (!data || !data.flashcards.length) return;
    const flashcard = data.flashcards[currentFlashcard];
    if (!flashcard) return;
    setFlashcardFeedbackLoading(true);
    try {
      const response = await fetch("/api/analytics/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          flashcardId: flashcard.id,
          isKnown,
          timeSpent: 30,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new Error(errorData.error || `Failed to record feedback: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Error recording flashcard feedback:", error);
      // Non-blocking error - don't show toast to user for analytics failures
    } finally {
      setFlashcardFeedbackLoading(false);
    }
  };

  const quizQuestions = useMemo(() => data?.quizQuestions ?? [], [data?.quizQuestions]);
  const currentQuestion = quizQuestions[currentQuestionIndex];

  /**
   * Submits the selected answer for the current quiz question
   * Records analytics and updates the score
   * @throws {Error} If the API request fails (non-blocking, logged only)
   */
  const handleSubmitAnswer = async () => {
    if (quizSelectedAnswer === null || !currentQuestion || quizShowResult) {
      return;
    }
    setQuizShowResult(true);
    if (quizSelectedAnswer === currentQuestion.correctAnswer) {
      setQuizScore((previous) => previous + 1);
    }

    const timeSpent = Math.max(1, Math.round((Date.now() - questionStartTime) / 1000));
    try {
      const response = await fetch("/api/analytics/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          quizQuestionId: currentQuestion.id,
          selectedAnswer: quizSelectedAnswer,
          correctAnswer: currentQuestion.correctAnswer,
          timeSpent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new Error(errorData.error || `Failed to record quiz answer: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Error recording quiz analytics:", error);
      // Non-blocking error - don't show toast to user for analytics failures
    }
  };

  const handleNextQuestion = () => {
    if (!quizQuestions.length) return;
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setQuizSelectedAnswer(null);
      setQuizShowResult(false);
      setQuestionStartTime(Date.now());
    } else {
      setQuizCompleted(true);
    }
  };

  const handleRestartQuiz = () => {
    setCurrentQuestionIndex(0);
    setQuizSelectedAnswer(null);
    setQuizShowResult(false);
    setQuizScore(0);
    setQuizCompleted(false);
    setQuestionStartTime(Date.now());
  };

  /**
   * Sends a question to the AI and receives an answer
   * @throws {Error} If the API request fails
   */
  const handleAskQuestion = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;
    
    const userMessage: QAMessage = {
      id: `user-${Date.now()}`,
      type: "user",
      content: trimmedQuestion,
      timestamp: new Date().toISOString(),
    };
    setQaMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setQaLoading(true);

    try {
      const response = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, question: trimmedQuestion }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new Error(errorData.error || `Failed to get answer: ${response.statusText}`);
      }

      const qaResponse = await response.json();
      const aiMessage: QAMessage = {
        id: `ai-${Date.now()}`,
        type: "ai",
        content: qaResponse.answer || "I wasn't able to find an answer just yet.",
        timestamp: new Date().toISOString(),
      };
      setQaMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Q&A error:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to get answer. Please check your connection and try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      // Remove the user message if the request failed
      setQaMessages((prev) => prev.filter((msg) => msg.id !== userMessage.id));
    } finally {
      setQaLoading(false);
    }
  };

  const handleQuestionKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!qaLoading) {
        void handleAskQuestion();
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success/10 text-success border-success/20";
      case "processing":
        return "bg-warning/10 text-warning border-warning/20";
      case "failed":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-6 w-px" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-24" />
              ))}
            </div>
          </div>
        </div>
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => router.push("/dashboard")}
                variant="ghost"
                size="sm"
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">
                    {data.document.fileName}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusColor(data.document.status)}`}>
                      {data.document.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {data.document.status === "processing" && (
          <div className="mb-6 flex items-start gap-3 rounded-lg bg-warning/10 border border-warning/20 p-4 text-sm text-warning">
            <Clock className="h-5 w-5 shrink-0 mt-0.5 animate-spin" />
            <div>
              <p className="font-medium">Processing in progress</p>
              <p className="mt-1 text-warning/80">
                This document is still being processed. Some sections may take a moment to appear.
              </p>
            </div>
          </div>
        )}

        {/* Summary Tab */}
        {activeTab === "summary" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.summary ? (
                <div className="prose prose-slate max-w-none">
                  <ReactMarkdown components={markdownComponents}>
                    {data.summary.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Summary not available yet. Please check back once processing completes.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notes Tab */}
        {activeTab === "notes" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Study Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.notes ? (
                <div className="prose prose-slate max-w-none">
                  {data.notes.title && (
                    <h2 className="text-2xl font-semibold mb-4">{data.notes.title}</h2>
                  )}
                  <ReactMarkdown components={markdownComponents}>
                    {data.notes.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Notes not available yet. They will appear once processing is complete.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Flashcards Tab */}
        {activeTab === "flashcards" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <RotateCw className="h-5 w-5 text-primary" />
                  Flashcards
                </CardTitle>
                {data.flashcards.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {currentFlashcard + 1} / {data.flashcards.length}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {data.flashcards.length ? (
                <div className="space-y-6">
                  <div
                    className="relative h-64 cursor-pointer"
                    style={{ perspective: "1000px" }}
                    onClick={() => setIsFlashcardFlipped((prev) => !prev)}
                  >
                    <div
                      className="relative h-full w-full transition-transform duration-500"
                      style={{
                        transformStyle: "preserve-3d",
                        transform: isFlashcardFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                      }}
                    >
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border-2 border-primary/20 bg-primary/5 p-8 text-center"
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        <p className="mb-2 text-sm font-medium text-muted-foreground">Question</p>
                        <p className="text-xl font-medium text-foreground">
                          {data.flashcards[currentFlashcard].question}
                        </p>
                        <p className="mt-4 text-xs text-muted-foreground">Click to flip</p>
                      </div>
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border-2 border-primary bg-primary/10 p-8 text-center"
                        style={{
                          backfaceVisibility: "hidden",
                          transform: "rotateY(180deg)",
                        }}
                      >
                        <p className="mb-2 text-sm font-medium text-primary">Answer</p>
                        <p className="text-lg leading-relaxed text-foreground">
                          {data.flashcards[currentFlashcard].answer}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <Button
                      onClick={() => handleFlashcardNavigation("previous")}
                      variant="outline"
                      size="sm"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      onClick={() => setIsFlashcardFlipped((prev) => !prev)}
                      variant="outline"
                      size="sm"
                    >
                      <RotateCw className="mr-2 h-4 w-4" />
                      Flip
                    </Button>
                    <Button
                      onClick={() => handleFlashcardNavigation("next")}
                      variant="outline"
                      size="sm"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {isFlashcardFlipped && (
                    <div className="flex items-center justify-center gap-3 pt-4 border-t">
                      <Button
                        onClick={() => void handleFlashcardFeedback(true)}
                        disabled={flashcardFeedbackLoading}
                        variant="outline"
                        size="sm"
                        className="text-success border-success/20 hover:bg-success/10"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        I know this
                      </Button>
                      <Button
                        onClick={() => void handleFlashcardFeedback(false)}
                        disabled={flashcardFeedbackLoading}
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/20 hover:bg-destructive/10"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Need review
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Flashcards will appear here once they are ready.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quiz Tab */}
        {activeTab === "quiz" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Quiz
                </CardTitle>
                {!quizCompleted && quizQuestions.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    Question {currentQuestionIndex + 1} / {quizQuestions.length} • Score: {quizScore}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {quizQuestions.length ? (
                !quizCompleted ? (
                  currentQuestion && (
                    <div className="space-y-6">
                      <div className="rounded-lg border bg-muted/50 p-6">
                        <p className="text-lg font-medium text-foreground">
                          {currentQuestion.question}
                        </p>
                      </div>

                      <div className="space-y-3">
                        {currentQuestion.options.map((option, index) => {
                          const isSelected = quizSelectedAnswer === index;
                          const isCorrect = index === currentQuestion.correctAnswer;
                          let className = "w-full text-left rounded-lg border-2 p-4 transition-all hover:bg-muted";
                          let letterClassName = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-base font-bold";
                          
                          if (quizShowResult) {
                            if (isCorrect) {
                              className += " border-green-500 bg-green-50 text-foreground shadow-sm";
                              letterClassName += " border-green-500 bg-green-600 text-white";
                            } else if (isSelected) {
                              className += " border-red-500 bg-red-50 text-foreground shadow-sm";
                              letterClassName += " border-red-500 bg-red-600 text-white";
                            } else {
                              className += " border-border bg-muted/30 text-foreground";
                              letterClassName += " border-slate-300 bg-slate-200 text-slate-700";
                            }
                          } else if (isSelected) {
                            className += " border-primary bg-primary/15 text-foreground shadow-md ring-2 ring-primary/20";
                            letterClassName += " border-primary bg-blue-600 text-white";
                          } else {
                            className += " border-border hover:border-primary/50 text-foreground";
                            letterClassName += " border-slate-300 bg-slate-100 text-slate-700";
                          }

                          return (
                            <button
                              key={index}
                              type="button"
                              onClick={() => !quizShowResult && setQuizSelectedAnswer(index)}
                              disabled={quizShowResult}
                              className={className}
                            >
                              <div className="flex items-center gap-3">
                                <span className={letterClassName}>
                                  {String.fromCharCode(65 + index)}
                                </span>
                                <span className="flex-1 font-medium">{option}</span>
                                {!quizShowResult && isSelected && (
                                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                                    <CheckCircle2 className="h-4 w-4" />
                                  </div>
                                )}
                                {quizShowResult && isCorrect && (
                                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                                )}
                                {quizShowResult && isSelected && !isCorrect && (
                                  <XCircle className="h-5 w-5 shrink-0 text-destructive" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {quizShowResult && currentQuestion.explanation && (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                          <p className="text-sm font-medium text-foreground mb-1">Explanation:</p>
                          <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                        </div>
                      )}

                      <div className="flex justify-end">
                        {!quizShowResult ? (
                          <Button
                            onClick={async () => await handleSubmitAnswer()}
                            disabled={quizSelectedAnswer === null}
                          >
                            Submit Answer
                          </Button>
                        ) : (
                          <Button onClick={handleNextQuestion}>
                            {currentQuestionIndex < quizQuestions.length - 1
                              ? "Next Question"
                              : "View Results"}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="py-12 text-center">
                    <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <Trophy className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="mb-2 text-2xl font-semibold">Quiz Completed!</h3>
                    <div className="mx-auto mt-6 max-w-xs rounded-lg border bg-muted/50 p-6">
                      <p className="text-sm text-muted-foreground">Your Score</p>
                      <p className="mt-2 text-4xl font-bold text-foreground">
                        {quizScore} / {quizQuestions.length}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {Math.round((quizScore / quizQuestions.length) * 100)}% correct
                      </p>
                    </div>
                    <Button onClick={handleRestartQuiz} className="mt-6">
                      Restart Quiz
                    </Button>
                  </div>
                )
              ) : (
                <div className="py-12 text-center">
                  <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Quiz questions will appear once they are generated for this document.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Q&A Tab */}
        {activeTab === "qa" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                Ask Questions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea ref={qaScrollRef} className="h-96 mb-4 rounded-lg border bg-muted/30 p-4">
                <div className="space-y-4">
                  {qaMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg border p-4 ${
                          message.type === "user"
                            ? "border-primary/20 bg-primary/10"
                            : "border-border bg-card"
                        }`}
                      >
                        {message.type === "ai" && (
                          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <Sparkles className="h-3 w-3" />
                            AI Assistant
                          </div>
                        )}
                        <p className="text-sm text-foreground">{message.content}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {qaLoading && (
                    <div className="flex justify-start">
                      <div className="rounded-lg border border-border bg-card p-4">
                        <p className="text-sm text-muted-foreground">Thinking...</p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleAskQuestion();
                }}
                className="space-y-3"
              >
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleQuestionKeyDown}
                  placeholder="Ask a question about this document..."
                  disabled={qaLoading}
                  rows={3}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Press Enter to send, Shift+Enter for new line
                  </p>
                  <Button type="submit" disabled={!question.trim() || qaLoading} size="sm">
                    <Send className="mr-2 h-4 w-4" />
                    {qaLoading ? "Sending..." : "Send"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
