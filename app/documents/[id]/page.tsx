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
} from "lucide-react";
import { useAuth } from "../../providers/AuthProvider";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Textarea } from "../../components/ui/textarea";

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
    <h2
      className="mt-6 text-3xl font-semibold tracking-tight text-white"
      {...props}
    />
  ),
  h2: ({ ...props }) => (
    <h3
      className="mt-6 text-2xl font-semibold tracking-tight text-white"
      {...props}
    />
  ),
  h3: ({ ...props }) => (
    <h4
      className="mt-4 text-xl font-semibold tracking-tight text-white"
      {...props}
    />
  ),
  p: ({ ...props }) => (
    <p className="leading-relaxed text-white/80" {...props} />
  ),
  ul: ({ ...props }) => (
    <ul className="list-disc space-y-2 pl-6 text-white/80" {...props} />
  ),
  ol: ({ ...props }) => (
    <ol className="list-decimal space-y-2 pl-6 text-white/80" {...props} />
  ),
  li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
  strong: ({ ...props }) => <strong className="text-white" {...props} />,
  code: ({ ...props }) => (
    <code
      className="rounded-md bg-white/10 px-1.5 py-0.5 text-sm text-white"
      {...props}
    />
  ),
  blockquote: ({ ...props }) => (
    <blockquote
      className="border-l-4 border-white/40 pl-4 text-white/80"
      {...props}
    />
  ),
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "summary", label: "Summary" },
  { id: "notes", label: "Notes" },
  { id: "flashcards", label: "Flashcards" },
  { id: "quiz", label: "Quiz" },
  { id: "qa", label: "Q&A" },
];

export default function DocumentPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const documentId = (params?.id as string) || "";

  const [data, setData] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [currentFlashcard, setCurrentFlashcard] = useState(0);
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false);
  const [flashcardFeedbackLoading, setFlashcardFeedbackLoading] = useState(
    false
  );
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizSelectedAnswer, setQuizSelectedAnswer] = useState<number | null>(
    null
  );
  const [quizShowResult, setQuizShowResult] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(() => Date.now());
  const [qaMessages, setQaMessages] = useState<QAMessage[]>(() => [
    {
      id: "welcome",
      type: "ai",
      content:
        "Hi there! I'm your AI study coach. Ask me anything about this document and I'll help you break it down.",
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

    const fetchDoc = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}`);
        if (response.ok) {
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
        } else {
          alert("Document not found");
          router.push("/dashboard");
        }
      } catch (error) {
        console.error("Error fetching document:", error);
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

  const handleFlashcardFeedback = async (isKnown: boolean) => {
    if (!data || !data.flashcards.length) return;
    const flashcard = data.flashcards[currentFlashcard];
    if (!flashcard) return;
    setFlashcardFeedbackLoading(true);
    try {
      await fetch("/api/analytics/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          flashcardId: flashcard.id,
          isKnown,
          timeSpent: 30,
        }),
      });
    } catch (error) {
      console.error("Error recording flashcard feedback:", error);
    } finally {
      setFlashcardFeedbackLoading(false);
    }
  };

  const quizQuestions = useMemo(
    () => data?.quizQuestions ?? [],
    [data?.quizQuestions]
  );
  const currentQuestion = quizQuestions[currentQuestionIndex];

  const handleSubmitAnswer = async () => {
    if (
      quizSelectedAnswer === null ||
      !currentQuestion ||
      quizShowResult
    ) {
      return;
    }
    setQuizShowResult(true);
    if (quizSelectedAnswer === currentQuestion.correctAnswer) {
      setQuizScore((previous) => previous + 1);
    }

    const timeSpent = Math.max(
      1,
      Math.round((Date.now() - questionStartTime) / 1000)
    );
    try {
      await fetch("/api/analytics/quiz", {
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
    } catch (error) {
      console.error("Error recording quiz analytics:", error);
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

      if (response.ok) {
        const qaResponse = await response.json();
        const aiMessage: QAMessage = {
          id: `ai-${Date.now()}`,
          type: "ai",
          content: qaResponse.answer || "I wasn't able to find an answer just yet.",
          timestamp: new Date().toISOString(),
        };
        setQaMessages((prev) => [...prev, aiMessage]);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to get answer");
      }
    } catch (error) {
      alert("Failed to get answer. Please try again.");
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

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="fixed inset-0 bg-gradient-to-br from-purple-400 via-pink-300 to-blue-400 animate-gradient" />
        <div className="fixed top-20 left-20 h-72 w-72 rounded-full bg-purple-300 mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
        <div className="fixed top-40 right-20 h-72 w-72 rounded-full bg-yellow-300 mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
        <div className="fixed bottom-20 left-1/2 h-72 w-72 rounded-full bg-pink-300 mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />
        <div className="relative z-10 flex min-h-screen items-center justify-center text-white/80">
          <p>Loading your study workspace...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div className="fixed inset-0 bg-gradient-to-br from-purple-400 via-pink-300 to-blue-400 animate-gradient" />
      <div className="fixed top-20 left-20 h-72 w-72 rounded-full bg-purple-300 mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
      <div className="fixed top-40 right-20 h-72 w-72 rounded-full bg-yellow-300 mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
      <div className="fixed bottom-20 left-1/2 h-72 w-72 rounded-full bg-pink-300 mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />

      <div className="relative z-10">
        <header className="px-4 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm text-white/80 transition hover:bg-white/20 hover:text-white"
              >
                <span aria-hidden>←</span>
                Back to dashboard
              </Link>
              <span
                className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-wide ${
                  data.document.status === "completed"
                    ? "bg-emerald-400/20 text-emerald-100"
                    : data.document.status === "processing"
                    ? "bg-yellow-300/25 text-yellow-100"
                    : "bg-red-400/25 text-red-100"
                }`}
              >
                {data.document.status}
              </span>
            </div>

            <div className="rounded-3xl border border-white/20 bg-white/10 px-6 py-7 backdrop-blur-2xl">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="space-y-3">
                  <p className="text-sm uppercase tracking-wider text-white/60">
                    Study workspace
                  </p>
                  <h1 className="text-4xl font-semibold tracking-tight">
                    {data.document.fileName}
                  </h1>
                  <p className="text-white/70">
                    Dive into AI-generated summaries, flashcards, quizzes, and
                    an interactive Q&A experience tailored to this document.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-sm text-white/70 backdrop-blur-xl">
                  <p>
                    Session status:{" "}
                    {studySessionId ? "Tracking engagement" : "Starting..."}
                  </p>
                  {sessionStartTime && (
                    <p className="mt-2">
                      Started {new Date(sessionStartTime).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-12 text-white sm:px-6 lg:px-8">
          {data.document.status === "processing" && (
            <div className="mb-8 rounded-3xl border border-yellow-200/30 bg-yellow-400/20 px-6 py-4 text-sm text-yellow-50 backdrop-blur-xl">
              This document is still processing. Some sections may take a moment
              to appear.
            </div>
          )}

          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-sm uppercase tracking-wider text-white/60">
                Learning hub
              </p>
              <h2 className="text-3xl font-semibold tracking-tight">
                Everything you need to master this material
              </h2>
            </div>
            <div className="inline-flex rounded-3xl border border-white/30 bg-white/10 px-5 py-3 text-sm text-white/70 backdrop-blur-xl">
              {tabs.length} adaptive study modes
            </div>
          </div>

          <div className="mb-10 inline-flex flex-wrap gap-2 rounded-2xl border border-white/20 bg-white/10 p-2 backdrop-blur-xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl px-5 py-2.5 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "border border-white/50 bg-white/30 text-white shadow-lg"
                    : "border border-transparent text-white/70 hover:border-white/30 hover:bg-white/15 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <section className="space-y-10">
            {activeTab === "summary" && (
              <Card className="rounded-3xl border border-white/20 bg-white/10 p-8 text-white backdrop-blur-2xl shadow-2xl">
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-xl bg-gradient-to-br from-purple-400 to-pink-400 p-3">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-semibold">AI Generated Summary</h3>
                </div>
                {data.summary ? (
                  <div className="space-y-4">
                    <ReactMarkdown components={markdownComponents}>
                      {data.summary.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-white/70">
                    Summary not available yet. Please check back once processing
                    completes.
                  </p>
                )}
              </Card>
            )}

            {activeTab === "notes" && (
              <Card className="rounded-3xl border border-white/20 bg-white/10 p-8 text-white backdrop-blur-2xl shadow-2xl">
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-xl bg-gradient-to-br from-blue-400 to-cyan-400 p-3">
                    <BookOpen className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-semibold">Study Notes</h3>
                </div>
                {data.notes ? (
                  <div className="space-y-4">
                    {data.notes.title && (
                      <h4 className="text-xl font-semibold text-white">
                        {data.notes.title}
                      </h4>
                    )}
                    <ReactMarkdown components={markdownComponents}>
                      {data.notes.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-white/70">
                    Notes not available yet. They will appear once processing is
                    complete.
                  </p>
                )}
              </Card>
            )}

            {activeTab === "flashcards" && (
              <Card className="rounded-3xl border border-white/20 bg-white/10 p-8 text-white backdrop-blur-2xl shadow-2xl">
                {data.flashcards.length ? (
                  <>
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm uppercase tracking-wider text-white/60">
                          Flashcards
                        </p>
                        <h3 className="text-2xl font-semibold">
                          Test your recall one concept at a time
                        </h3>
                      </div>
                      <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/70 backdrop-blur-xl">
                        Card {currentFlashcard + 1} of {data.flashcards.length}
                      </div>
                    </div>

                    <div
                      className="mb-8"
                      style={{ perspective: "1200px" }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          setIsFlashcardFlipped((previous) => !previous)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setIsFlashcardFlipped((previous) => !previous);
                          }
                        }}
                        className="relative h-80 cursor-pointer"
                      >
                        <div
                          className="relative h-full w-full rounded-3xl border border-white/30 bg-white/5 p-8 transition-transform duration-500"
                          style={{
                            transformStyle: "preserve-3d",
                            transform: isFlashcardFlipped
                              ? "rotateY(180deg)"
                              : "rotateY(0deg)",
                          }}
                        >
                          <div
                            className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-purple-400/30 to-pink-400/30 text-center backdrop-blur-xl"
                            style={{ backfaceVisibility: "hidden" }}
                          >
                            <p className="mb-4 text-sm text-white/60">
                              Question
                            </p>
                            <p className="text-2xl font-medium text-white">
                              {data.flashcards[currentFlashcard].question}
                            </p>
                            <div className="mt-8 flex items-center gap-2 text-white/60">
                              <RotateCw className="h-4 w-4" />
                              <span className="text-sm">
                                Tap to reveal the answer
                              </span>
                            </div>
                          </div>
                          <div
                            className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-blue-400/30 to-cyan-400/30 text-center backdrop-blur-xl"
                            style={{
                              backfaceVisibility: "hidden",
                              transform: "rotateY(180deg)",
                            }}
                          >
                            <p className="mb-4 text-sm text-white/60">
                              Answer
                            </p>
                            <p className="text-xl leading-relaxed text-white">
                              {data.flashcards[currentFlashcard].answer}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-3">
                      <Button
                        onClick={() => handleFlashcardNavigation("previous")}
                        className="rounded-xl border border-white/30 bg-white/15 backdrop-blur-sm text-white hover:bg-white/25"
                      >
                        <ChevronLeft className="h-5 w-5" />
                        Previous
                      </Button>
                      <Button
                        onClick={() =>
                          setIsFlashcardFlipped((previous) => !previous)
                        }
                        className="rounded-xl border border-white/30 bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
                      >
                        <RotateCw className="mr-2 h-5 w-5" />
                        Flip Card
                      </Button>
                      <Button
                        onClick={() => handleFlashcardNavigation("next")}
                        className="rounded-xl border border-white/30 bg-white/15 backdrop-blur-sm text-white hover:bg-white/25"
                      >
                        Next
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>

                    {isFlashcardFlipped && (
                      <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <Button
                          onClick={() => void handleFlashcardFeedback(true)}
                          disabled={flashcardFeedbackLoading}
                          className="rounded-xl border border-emerald-200/30 bg-emerald-400/25 text-white hover:bg-emerald-400/35 disabled:opacity-60"
                        >
                          ✓ I know this
                        </Button>
                        <Button
                          onClick={() => void handleFlashcardFeedback(false)}
                          disabled={flashcardFeedbackLoading}
                          className="rounded-xl border border-red-200/30 bg-red-400/25 text-white hover:bg-red-400/35 disabled:opacity-60"
                        >
                          ✗ Need review
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-white/70">
                    Flashcards will appear here once they are ready.
                  </p>
                )}
              </Card>
            )}

            {activeTab === "quiz" && (
              <Card className="rounded-3xl border border-white/20 bg-white/10 p-8 text-white backdrop-blur-2xl shadow-2xl">
                {quizQuestions.length ? (
                  !quizCompleted ? (
                    <>
                      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-sm uppercase tracking-wider text-white/60">
                            Smart quiz
                          </p>
                          <h3 className="text-2xl font-semibold">
                            Question {currentQuestionIndex + 1} of{" "}
                            {quizQuestions.length}
                          </h3>
                        </div>
                        <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/70 backdrop-blur-xl">
                          Score: {quizScore}
                        </div>
                      </div>

                      {currentQuestion && (
                        <div className="space-y-6">
                          <div className="rounded-2xl border border-white/20 bg-white/10 p-6 text-lg font-medium text-white">
                            {currentQuestion.question}
                          </div>

                          <div className="space-y-3">
                            {currentQuestion.options.map((option, index) => {
                              const isSelected = quizSelectedAnswer === index;
                              const isCorrect =
                                index === currentQuestion.correctAnswer;
                              let optionClasses =
                                "border-white/20 bg-white/10 hover:bg-white/20";
                              if (quizShowResult) {
                                if (isCorrect) {
                                  optionClasses =
                                    "border-emerald-300/60 bg-emerald-400/20";
                                } else if (isSelected) {
                                  optionClasses =
                                    "border-red-300/60 bg-red-400/20";
                                } else {
                                  optionClasses = "border-white/10 bg-white/5";
                                }
                              } else if (isSelected) {
                                optionClasses =
                                  "border-white/40 bg-white/25 shadow-lg";
                              }
                              return (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() =>
                                    !quizShowResult &&
                                    setQuizSelectedAnswer(index)
                                  }
                                  disabled={quizShowResult}
                                  className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition ${optionClasses}`}
                                >
                                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 text-sm font-medium">
                                    {String.fromCharCode(65 + index)}
                                  </span>
                                  <span className="flex-1 text-white">
                                    {option}
                                  </span>
                                  {quizShowResult && isCorrect && (
                                    <CheckCircle2 className="h-6 w-6 text-emerald-200" />
                                  )}
                                  {quizShowResult &&
                                    isSelected &&
                                    !isCorrect && (
                                      <XCircle className="h-6 w-6 text-red-200" />
                                    )}
                                </button>
                              );
                            })}
                          </div>

                          {quizShowResult &&
                            currentQuestion.explanation && (
                              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-sm text-white/80">
                                {currentQuestion.explanation}
                              </div>
                            )}

                          <div className="flex flex-wrap justify-end gap-3">
                            {!quizShowResult ? (
                              <Button
                                onClick={() => void handleSubmitAnswer()}
                                disabled={quizSelectedAnswer === null}
                                className="rounded-xl border border-white/30 bg-white/20 px-6 py-3 text-white hover:bg-white/30 disabled:opacity-60"
                              >
                                Submit answer
                              </Button>
                            ) : (
                              <Button
                                onClick={handleNextQuestion}
                                className="rounded-xl border border-white/30 bg-white/20 px-6 py-3 text-white hover:bg-white/30"
                              >
                                {currentQuestionIndex < quizQuestions.length - 1
                                  ? "Next question"
                                  : "View results"}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-6 text-center">
                      <div className="flex justify-center">
                        <div className="rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 p-6">
                          <Trophy className="h-16 w-16 text-white" />
                        </div>
                      </div>
                      <h3 className="text-3xl font-semibold">
                        Quiz completed!
                      </h3>
                      <div className="rounded-3xl border border-white/20 bg-white/10 p-8 text-white/80 backdrop-blur-xl">
                        <p className="text-white/70">Your score</p>
                        <p className="mt-2 text-5xl font-semibold text-white">
                          {quizScore} / {quizQuestions.length}
                        </p>
                        <p className="mt-2 text-white/60">
                          {Math.round(
                            (quizScore / quizQuestions.length) * 100
                          )}
                          % correct
                        </p>
                      </div>
                      <Button
                        onClick={handleRestartQuiz}
                        className="rounded-xl border border-white/30 bg-white/20 px-6 py-3 text-white hover:bg-white/30"
                      >
                        Restart quiz
                      </Button>
                    </div>
                  )
                ) : (
                  <p className="text-white/70">
                    Quiz questions will appear once they are generated for this
                    document.
                  </p>
                )}
              </Card>
            )}

            {activeTab === "qa" && (
              <Card className="rounded-3xl border border-white/20 bg-white/10 p-8 text-white backdrop-blur-2xl shadow-2xl">
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-xl bg-gradient-to-br from-green-400 to-emerald-400 p-3">
                    <MessageCircle className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-semibold">Ask the AI Tutor</h3>
                </div>

                <ScrollArea ref={qaScrollRef} className="h-96 rounded-2xl border border-white/10 bg-white/5 p-4 pr-6">
                  <div className="space-y-4">
                    {qaMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.type === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl border px-5 py-4 ${
                            message.type === "user"
                              ? "border-white/30 bg-purple-400/30 backdrop-blur-xl"
                              : "border-white/20 bg-white/10 backdrop-blur-xl"
                          }`}
                        >
                          {message.type === "ai" && (
                            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-white/60">
                              <Sparkles className="h-4 w-4" />
                              AI assistant
                            </div>
                          )}
                          <p className="text-white">{message.content}</p>
                          <p className="mt-2 text-right text-xs text-white/50">
                            {new Date(message.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {qaLoading && (
                      <div className="flex justify-start text-sm text-white/60">
                        AI is thinking...
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <form
                  className="mt-6 space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleAskQuestion();
                  }}
                >
                  <Textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleQuestionKeyDown}
                    placeholder="Ask a question about this document..."
                    disabled={qaLoading}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-white/60">
                    <span>Press Enter to send, Shift + Enter for a new line</span>
                    <Button
                      type="submit"
                      disabled={!question.trim() || qaLoading}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/20 px-6 py-3 text-white hover:bg-white/30 disabled:opacity-60"
                    >
                      <Send className="h-5 w-5" />
                      {qaLoading ? "Sending..." : "Send"}
                    </Button>
                  </div>
                </form>
              </Card>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
