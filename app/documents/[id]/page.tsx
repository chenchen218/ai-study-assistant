"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Upload,
  FileText,
  Download,
  Edit,
  Save,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useAuth } from "../../providers/AuthProvider";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Textarea } from "../../components/ui/textarea";
import { useToast } from "../../components/ui/use-toast";

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
      className="mt-6 text-3xl font-bold tracking-tight text-[#0A0A0A]"
      {...props}
    />
  ),
  h2: ({ ...props }) => (
    <h3
      className="mt-6 text-2xl font-bold tracking-tight text-[#0A0A0A]"
      {...props}
    />
  ),
  h3: ({ ...props }) => (
    <h4
      className="mt-4 text-xl font-bold tracking-tight text-[#0A0A0A]"
      {...props}
    />
  ),
  p: ({ ...props }) => (
    <p className="leading-relaxed text-[#1C1C1C] font-medium" {...props} />
  ),
  ul: ({ ...props }) => (
    <ul className="list-disc space-y-2 pl-6 text-[#1C1C1C] font-medium" {...props} />
  ),
  ol: ({ ...props }) => (
    <ol className="list-decimal space-y-2 pl-6 text-[#1C1C1C] font-medium" {...props} />
  ),
  li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
  strong: ({ ...props }) => <strong className="text-[#0F0F0F]" {...props} />,
  code: ({ ...props }) => (
    <code
      className="rounded-md bg-[#1C1C1C]/10 px-1.5 py-0.5 text-sm text-[#1C1C1C]"
      {...props}
    />
  ),
  blockquote: ({ ...props }) => (
    <blockquote
      className="border-l-4 border-[#1C1C1C]/30 pl-4 text-[#1C1C1C]"
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
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const documentId = (params?.id as string) || "";
  const { toast } = useToast();

  const [data, setData] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [currentFlashcard, setCurrentFlashcard] = useState(0);
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false);
  const [flashcardFeedbackLoading, setFlashcardFeedbackLoading] =
    useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [isVerifyingAnswer, setIsVerifyingAnswer] = useState(false);
  const [answerResult, setAnswerResult] = useState<{
    isCorrect: boolean;
    feedback: string;
  } | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizSelectedAnswer, setQuizSelectedAnswer] = useState<number | null>(
    null
  );
  const [quizShowResult, setQuizShowResult] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [isRegeneratingQuiz, setIsRegeneratingQuiz] = useState(false);
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
  const notesExportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotesContent, setEditedNotesContent] = useState("");
  const [editedNotesTitle, setEditedNotesTitle] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isExportingFlashcards, setIsExportingFlashcards] = useState(false);

  const fetchDoc = useCallback(async () => {
    if (!documentId) {
      setLoadError("Missing document id.");
      setLoading(false);
      return;
    }

    setLoadError(null);
    setLoading(true);

    try {
      const response = await fetch(`/api/documents/${documentId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const message =
          errorData?.error ||
          (response.status === 404
            ? "Document not found or has been removed."
            : `Failed to load document (${response.status}).`);
        setLoadError(message);
        if (response.status === 404) {
          router.push("/dashboard");
        }
        throw new Error(message);
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
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load document. Please try again.";
      setLoadError(message);
      toast({
        title: "Unable to load document",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [documentId, router, toast]);

  useEffect(() => {
    if (authLoading) {
      return; // Still checking auth, don't do anything yet
    }
    if (!user) {
      router.push("/login");
      return;
    }
    if (!documentId) {
      setLoadError("Missing document id.");
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
      const duration = Math.max(
        1,
        Math.floor((Date.now() - startTime) / 60000)
      );
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

    void fetchDoc();
    void startSession();

    return () => {
      void endSession();
    };
  }, [authLoading, user, documentId, router, fetchDoc]);

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
    setUserAnswer("");
    setAnswerResult(null);
    setCurrentFlashcard((prev) => {
      if (direction === "next") {
        return (prev + 1) % data.flashcards.length;
      }
      return (prev - 1 + data.flashcards.length) % data.flashcards.length;
    });
  };

  // Reset answer when switching flashcards
  useEffect(() => {
    setUserAnswer("");
    setAnswerResult(null);
    setIsFlashcardFlipped(false);
  }, [currentFlashcard]);

  const handleVerifyAnswer = async () => {
    if (!data?.flashcards.length || !userAnswer.trim()) return;
    const flashcard = data.flashcards[currentFlashcard];
    if (!flashcard) return;

    setIsVerifyingAnswer(true);
    setAnswerResult(null);

    try {
      const response = await fetch("/api/flashcards/verify-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flashcardId: flashcard.id,
          userAnswer: userAnswer.trim(),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setAnswerResult({
          isCorrect: result.isCorrect,
          feedback: result.feedback,
        });
        // If correct, automatically mark as known
        if (result.isCorrect) {
          await handleFlashcardFeedback(true);
        }
      } else {
        setAnswerResult({
          isCorrect: false,
          feedback: result.error || "Failed to verify answer. Please try again.",
        });
      }
    } catch (error) {
      console.error("Error verifying answer:", error);
      setAnswerResult({
        isCorrect: false,
        feedback: "Network error. Please try again.",
      });
    } finally {
      setIsVerifyingAnswer(false);
    }
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
    if (quizSelectedAnswer === null || !currentQuestion || quizShowResult) {
      return;
    }
    setQuizShowResult(true);
    const isCorrect = quizSelectedAnswer === currentQuestion.correctAnswer;
    if (isCorrect) {
      setQuizScore((previous) => previous + 1);
    }

    const timeSpent = Math.max(
      1,
      Math.round((Date.now() - questionStartTime) / 1000)
    );
    
    const payload = {
      documentId,
      quizQuestionId: currentQuestion.id,
      selectedAnswer: quizSelectedAnswer,
      correctAnswer: currentQuestion.correctAnswer,
      timeSpent,
    };
    
    console.log("📝 Submitting quiz answer:", {
      ...payload,
      isCorrect,
      selectedAnswerIndex: quizSelectedAnswer,
      correctAnswerIndex: currentQuestion.correctAnswer,
    });

    try {
      const response = await fetch("/api/analytics/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log("✅ Quiz answer submitted:", result);
        if (!isCorrect) {
          console.log("❌ Wrong answer - should be saved to error book");
        }
      } else {
        const error = await response.json();
        console.error("❌ Failed to submit quiz answer:", error);
      }
    } catch (error) {
      console.error("❌ Error recording quiz analytics:", error);
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

  const handleRegenerateQuiz = async () => {
    if (!documentId || !data) return;
    
    setIsRegeneratingQuiz(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/regenerate-quiz`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const result = await response.json();
        // Update the data with new quiz questions
        setData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            quizQuestions: result.quizQuestions,
          };
        });
        // Reset quiz state
        setCurrentQuestionIndex(0);
        setQuizSelectedAnswer(null);
        setQuizShowResult(false);
        setQuizCompleted(false);
        setQuizScore(0);
        setQuestionStartTime(Date.now());
        toast({
          title: "Quiz regenerated",
          description: "Fresh quiz questions are ready.",
          variant: "success",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Could not regenerate quiz",
          description:
            errorData.error || "Failed to regenerate quiz. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error regenerating quiz:", error);
      toast({
        title: "Could not regenerate quiz",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRegeneratingQuiz(false);
    }
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
          content:
            qaResponse.answer || "I wasn't able to find an answer just yet.",
          timestamp: new Date().toISOString(),
        };
        setQaMessages((prev) => [...prev, aiMessage]);
      } else {
        const error = await response.json();
        toast({
          title: "Unable to get an answer",
          description: error.error || "Please try again in a moment.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Unable to get an answer",
        description: "Network issue. Please try again.",
        variant: "destructive",
      });
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

  const handleEditNotes = () => {
    if (!data?.notes) return;
    setEditedNotesTitle(data.notes.title || "");
    setEditedNotesContent(data.notes.content);
    setIsEditingNotes(true);
  };

  const handleCancelEditNotes = () => {
    setIsEditingNotes(false);
    setEditedNotesTitle("");
    setEditedNotesContent("");
  };

  const handleSaveNotes = async () => {
    if (!data?.notes) return;

    setIsSavingNotes(true);
    try {
      const response = await fetch(`/api/notes/${data.notes.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editedNotesTitle,
          content: editedNotesContent,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            notes: result.note,
          };
        });
        setIsEditingNotes(false);
        toast({
          title: "Notes saved",
          description: "Your edits are up to date.",
          variant: "success",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Could not save notes",
          description: errorData.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving notes:", error);
      toast({
        title: "Could not save notes",
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleExportNotes = async () => {
    if (!data?.notes || !notesExportRef.current) return;

    setIsExporting(true);
    try {
      // Create a temporary container for PDF generation
      const container = notesExportRef.current;
      
      // Use html2canvas to capture the content
      const canvas = await html2canvas(container as HTMLElement, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
        useCORS: true,
      } as any);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Generate filename
      const fileName = data.notes.title
        ? `${data.notes.title.replace(/[^a-z0-9]/gi, "_")}_notes.pdf`
        : `${data.document.fileName.replace(/\.[^/.]+$/, "")}_notes.pdf`;

      pdf.save(fileName);
    } catch (error) {
      console.error("Error exporting notes:", error);
      toast({
        title: "Export failed",
        description: "We couldn't export your notes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportFlashcardsPDF = async () => {
    if (!data?.flashcards.length) return;

    setIsExportingFlashcards(true);
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 20;
      const cardHeight = 60;
      let yPosition = margin;
      let pageNumber = 1;

      pdf.setFontSize(16);
      pdf.text("Flashcards", margin, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      pdf.text(`Document: ${data.document.fileName}`, margin, yPosition);
      yPosition += 10;

      for (let i = 0; i < data.flashcards.length; i++) {
        const card = data.flashcards[i];
        
        // Check if we need a new page
        if (yPosition + cardHeight > pageHeight - margin) {
          pdf.addPage();
          pageNumber++;
          yPosition = margin;
        }

        // Card number
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Card ${i + 1}`, margin, yPosition);
        yPosition += 7;

        // Question
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        const questionLines = pdf.splitTextToSize(`Q: ${card.question}`, pageWidth - 2 * margin);
        pdf.text(questionLines, margin, yPosition);
        yPosition += questionLines.length * 5 + 3;

        // Answer
        pdf.setFont("helvetica", "normal");
        const answerLines = pdf.splitTextToSize(`A: ${card.answer}`, pageWidth - 2 * margin);
        pdf.text(answerLines, margin, yPosition);
        yPosition += answerLines.length * 5 + 8;

        // Divider line
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 5;
      }

      const fileName = `${data.document.fileName.replace(/\.[^/.]+$/, "")}_flashcards.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error("Error exporting flashcards PDF:", error);
      toast({
        title: "Export failed",
        description: "Unable to create flashcards PDF right now.",
        variant: "destructive",
      });
    } finally {
      setIsExportingFlashcards(false);
    }
  };

  const handleExportFlashcardsCSV = () => {
    if (!data?.flashcards.length) return;

    try {
      // Create CSV content
      const csvRows = [
        ["Question", "Answer"], // Header
        ...data.flashcards.map((card) => [
          `"${card.question.replace(/"/g, '""')}"`,
          `"${card.answer.replace(/"/g, '""')}"`,
        ]),
      ];

      const csvContent = csvRows.map((row) => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `${data.document.fileName.replace(/\.[^/.]+$/, "")}_flashcards.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting flashcards CSV:", error);
      toast({
        title: "Export failed",
        description: "Unable to export flashcards CSV right now.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="fixed inset-0 bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 animate-gradient" />
        <div className="fixed top-20 left-20 h-72 w-72 rounded-full bg-purple-500 mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
        <div className="fixed top-40 right-20 h-72 w-72 rounded-full bg-fuchsia-500 mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
        <div className="fixed bottom-20 left-1/2 h-72 w-72 rounded-full bg-pink-500 mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />
        <div className="relative z-10 flex min-h-screen items-center justify-center text-[#1C1C1C]">
          <p>Loading your study workspace...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="relative min-h-screen overflow-hidden text-[#1C1C1C]">
        <div className="fixed inset-0 bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 animate-gradient" />
        <div className="fixed top-20 left-20 h-72 w-72 rounded-full bg-purple-500 mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
        <div className="fixed top-40 right-20 h-72 w-72 rounded-full bg-fuchsia-500 mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
        <div className="fixed bottom-20 left-1/2 h-72 w-72 rounded-full bg-pink-500 mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
          <Card className="max-w-md w-full border border-white/30 bg-white/90 p-6 backdrop-blur-xl">
            <div className="space-y-4">
              <div>
                <p className="text-lg font-semibold text-[#1C1C1C]">
                  Unable to load this document
                </p>
                <p className="text-sm text-[#1C1C1C]/70">{loadError}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  className="flex-1"
                  onClick={() => {
                    void fetchDoc();
                  }}
                >
                  Try again
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                >
                  Back to dashboard
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-[#1C1C1C]">
      <div className="fixed inset-0 bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 animate-gradient" />
      <div className="fixed top-20 left-20 h-72 w-72 rounded-full bg-purple-500 mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
      <div className="fixed top-40 right-20 h-72 w-72 rounded-full bg-fuchsia-500 mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
      <div className="fixed bottom-20 left-1/2 h-72 w-72 rounded-full bg-pink-500 mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />

      <div className="relative z-10">
        <header className="px-4 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-6">
            <Card className="border border-white/20 bg-white/10 p-4 text-white shadow-xl backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => router.push("/dashboard")}
                    variant="ghost"
                    className="rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-[#1C1C1C] transition-all hover:bg-white/30 backdrop-blur-sm"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div className="rounded-lg bg-white/20 p-2">
                    <Upload className="w-5 h-5 text-[#1C1C1C]" />
                  </div>
                  <div>
                    <p className="text-[#1C1C1C]">Currently studying:</p>
                    <p className="text-sm text-[#1C1C1C]">
                      {data.document.fileName}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wide ${
                      data.document.status === "completed"
                        ? "bg-emerald-400/20 text-emerald-100"
                        : data.document.status === "processing"
                        ? "bg-yellow-300/25 text-yellow-100"
                        : "bg-red-400/25 text-red-100"
                    }`}
                  >
                    {data.document.status}
                  </span>
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="rounded-lg border border-white/30 bg-white/20 px-4 py-2 text-sm text-white transition-all hover:bg-white/30 backdrop-blur-sm"
                  >
                    Upload New File
                  </button>
                </div>
              </div>
            </Card>
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
              <p className="mb-2 text-sm uppercase tracking-wider text-white/70">
                Learning hub
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-white">
                Everything you need to master this material
              </h2>
            </div>
            <div className="inline-flex rounded-3xl border border-white/30 bg-white/10 px-5 py-3 text-sm text-[#1C1C1C] backdrop-blur-xl">
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
                    : "border border-transparent text-white hover:border-white/30 hover:bg-white/15 hover:text-[#1C1C1C]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <section className="space-y-10">
            {activeTab === "summary" && (
              <Card className="rounded-3xl border border-white/40 bg-white/85 p-8 text-[#1C1C1C] backdrop-blur-xl shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-xl bg-gradient-to-br from-purple-50 to-fuchsia-100 p-3">
                    <Sparkles className="h-6 w-6 text-[#1C1C1C]" />
                  </div>
                  <h3 className="text-2xl font-semibold">
                    AI Generated Summary
                  </h3>
                </div>
                {data.summary ? (
                  <div className="space-y-6">
                    <ReactMarkdown components={markdownComponents}>
                      {data.summary.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-[#1C1C1C]/70">
                    Summary not available yet. Please check back once processing
                    completes.
                  </p>
                )}
              </Card>
            )}

            {activeTab === "notes" && (
              <Card className="rounded-3xl border border-white/40 bg-white/85 p-8 text-[#1C1C1C] backdrop-blur-xl shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-blue-50 to-cyan-100 p-3">
                      <BookOpen className="h-6 w-6 text-[#1C1C1C]" />
                    </div>
                    <h3 className="text-2xl font-semibold">Study Notes</h3>
                  </div>
                  {data.notes && (
                    <div className="flex gap-2">
                      {!isEditingNotes ? (
                        <>
                          <Button
                            onClick={handleEditNotes}
                            className="rounded-lg border border-white/40 bg-white/80 px-4 py-2 text-black hover:bg-white/90 shadow-md"
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            onClick={handleExportNotes}
                            disabled={isExporting}
                            className="rounded-lg border border-white/40 bg-white/80 px-4 py-2 text-black hover:bg-white/90 shadow-md disabled:opacity-60"
                          >
                            <Download className="mr-2 h-4 w-4" />
                            {isExporting ? "Exporting..." : "Export PDF"}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            onClick={handleSaveNotes}
                            disabled={isSavingNotes}
                            className="rounded-lg border border-white/40 bg-white/80 px-4 py-2 text-black hover:bg-white/90 shadow-md disabled:opacity-60"
                          >
                            <Save className="mr-2 h-4 w-4" />
                            {isSavingNotes ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            onClick={handleCancelEditNotes}
                            disabled={isSavingNotes}
                            className="rounded-lg border border-white/40 bg-white/80 px-4 py-2 text-black hover:bg-white/90 shadow-md disabled:opacity-60"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {data.notes ? (
                  <div className="space-y-6">
                    {/* Hidden div for PDF export */}
                    <div
                      ref={notesExportRef}
                      className="fixed -left-[9999px] top-0 w-[210mm] bg-white p-8"
                      style={{ maxWidth: "210mm" }}
                    >
                      {data.notes.title && (
                        <h1 className="mb-4 text-3xl font-bold text-black">
                          {data.notes.title}
                        </h1>
                      )}
                      <div className="prose prose-lg max-w-none">
                        <ReactMarkdown
                          components={{
                            h1: ({ ...props }) => (
                              <h1
                                className="mt-6 text-2xl font-bold text-black"
                                {...props}
                              />
                            ),
                            h2: ({ ...props }) => (
                              <h2
                                className="mt-5 text-xl font-bold text-black"
                                {...props}
                              />
                            ),
                            h3: ({ ...props }) => (
                              <h3
                                className="mt-4 text-lg font-semibold text-black"
                                {...props}
                              />
                            ),
                            p: ({ ...props }) => (
                              <p
                                className="mb-3 leading-relaxed text-black"
                                {...props}
                              />
                            ),
                            ul: ({ ...props }) => (
                              <ul
                                className="mb-3 list-disc space-y-1 pl-6 text-black"
                                {...props}
                              />
                            ),
                            ol: ({ ...props }) => (
                              <ol
                                className="mb-3 list-decimal space-y-1 pl-6 text-black"
                                {...props}
                              />
                            ),
                            li: ({ ...props }) => (
                              <li className="leading-relaxed" {...props} />
                            ),
                            strong: ({ ...props }) => (
                              <strong className="font-bold text-black" {...props} />
                            ),
                            code: ({ ...props }) => (
                              <code
                                className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-black"
                                {...props}
                              />
                            ),
                            blockquote: ({ ...props }) => (
                              <blockquote
                                className="border-l-4 border-gray-300 pl-4 italic text-black"
                                {...props}
                              />
                            ),
                          }}
                        >
                          {data.notes.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                    {/* Visible content */}
                    {isEditingNotes ? (
                      <div className="space-y-4">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-[#1C1C1C]">
                            Title
                          </label>
                          <input
                            type="text"
                            value={editedNotesTitle}
                            onChange={(e) => setEditedNotesTitle(e.target.value)}
                            className="w-full rounded-lg border border-white/40 bg-white/90 px-4 py-2 text-[#1C1C1C] focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                            placeholder="Note title"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-[#1C1C1C]">
                            Content (Markdown supported)
                          </label>
                          <Textarea
                            value={editedNotesContent}
                            onChange={(e) => setEditedNotesContent(e.target.value)}
                            className="min-h-[400px] w-full rounded-lg border border-white/40 bg-white/90 px-4 py-2 text-[#1C1C1C] focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                            placeholder="Write your notes in Markdown format..."
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        {data.notes.title && (
                          <h4 className="text-xl font-semibold text-[#1C1C1C]">
                            {data.notes.title}
                          </h4>
                        )}
                        <ReactMarkdown components={markdownComponents}>
                          {data.notes.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[#1C1C1C]/70">
                    Notes not available yet. They will appear once processing is
                    complete.
                  </p>
                )}
              </Card>
            )}

            {activeTab === "flashcards" && (
              <Card className="rounded-3xl border border-white/40 bg-white/85 p-8 text-[#1C1C1C] backdrop-blur-xl shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
                {data.flashcards.length ? (
                  <>
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm uppercase tracking-wider text-[#1C1C1C] font-semibold">
                          Flashcards
                        </p>
                        <h3 className="text-2xl font-bold text-[#0F0F0F]">
                          Test your recall one concept at a time
                        </h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-white/30 bg-white/20 px-4 py-2 text-sm text-[#0F0F0F] font-semibold backdrop-blur-xl">
                          Card {currentFlashcard + 1} of {data.flashcards.length}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleExportFlashcardsPDF}
                            disabled={isExportingFlashcards}
                            className="rounded-lg border border-white/40 bg-white/80 px-3 py-2 text-sm text-black hover:bg-white/90 shadow-md disabled:opacity-60"
                            title="Export as PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={handleExportFlashcardsCSV}
                            disabled={isExportingFlashcards}
                            className="rounded-lg border border-white/40 bg-white/80 px-3 py-2 text-sm text-black hover:bg-white/90 shadow-md disabled:opacity-60"
                            title="Export as CSV"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="mb-8" style={{ perspective: "1200px" }}>
                      <div className="relative h-80">
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
                            className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-purple-600/90 to-fuchsia-600/90 text-center text-white backdrop-blur-xl p-6 overflow-y-auto"
                            style={{ backfaceVisibility: "hidden" }}
                          >
                            <p className="mb-3 text-sm text-white font-semibold">
                              Question
                            </p>
                            <p className="text-xl font-bold text-white mb-4 px-2">
                              {data.flashcards[currentFlashcard].question}
                            </p>
                            
                            {/* User Answer Input */}
                            <div 
                              className="w-full max-w-md space-y-3 flex-shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Textarea
                                value={userAnswer}
                                onChange={(e) => {
                                  setUserAnswer(e.target.value);
                                  setAnswerResult(null);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Type your answer here..."
                                className="min-h-[100px] w-full rounded-xl border border-white/30 bg-white/10 text-white placeholder:text-white/60 focus:border-white/50 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
                                disabled={isVerifyingAnswer || answerResult?.isCorrect}
                              />
                              {answerResult && (
                                <div
                                  className={`rounded-lg border p-3 text-sm max-h-32 overflow-y-auto ${
                                    answerResult.isCorrect
                                      ? "border-green-400/50 bg-green-400/20 text-green-100"
                                      : "border-red-400/50 bg-red-400/20 text-red-100"
                                  }`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <p className="font-semibold mb-1">
                                    {answerResult.isCorrect ? "✓ Correct!" : "✗ Incorrect"}
                                  </p>
                                  <p className="text-xs leading-relaxed break-words">{answerResult.feedback}</p>
                                </div>
                              )}
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVerifyAnswer();
                                }}
                                disabled={!userAnswer.trim() || isVerifyingAnswer || answerResult?.isCorrect}
                                className="w-full rounded-xl border border-white/40 bg-white/20 text-white hover:bg-white/30 disabled:opacity-50"
                              >
                                {isVerifyingAnswer ? "Verifying..." : "Check Answer"}
                              </Button>
                            </div>
                            
                          </div>
                          <div
                            className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500/90 to-cyan-500/90 text-center text-white backdrop-blur-xl"
                            style={{
                              backfaceVisibility: "hidden",
                              transform: "rotateY(180deg)",
                            }}
                          >
                            <p className="mb-4 text-sm text-white font-semibold">Answer</p>
                            <p className="text-xl leading-relaxed text-white font-semibold">
                              {data.flashcards[currentFlashcard].answer}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-3">
                      <Button
                        onClick={() => handleFlashcardNavigation("previous")}
                        className="rounded-xl border border-[#DDD6FE] bg-[#EDE9FE] text-[#4C1D95] hover:bg-[#E0E7FF]"
                      >
                        <ChevronLeft className="h-5 w-5" />
                        Previous
                      </Button>
                      <Button
                        onClick={() =>
                          setIsFlashcardFlipped((previous) => !previous)
                        }
                        className="rounded-xl border border-[#C4B5FD] bg-[#DDD6FE] text-[#4C1D95] hover:bg-[#E0E7FF]"
                      >
                        <RotateCw className="mr-2 h-5 w-5" />
                        Flip Card
                      </Button>
                      <Button
                        onClick={() => handleFlashcardNavigation("next")}
                        className="rounded-xl border border-[#DDD6FE] bg-[#EDE9FE] text-[#4C1D95] hover:bg-[#E0E7FF]"
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
                          className="rounded-xl border border-[#BBF7D0] bg-[#DCFCE7] text-[#166534] hover:bg-[#BBF7D0] disabled:opacity-60"
                        >
                          ✓ I know this
                        </Button>
                        <Button
                          onClick={() => void handleFlashcardFeedback(false)}
                          disabled={flashcardFeedbackLoading}
                          className="rounded-xl border border-[#FECACA] bg-[#FEE2E2] text-[#7F1D1D] hover:bg-[#FECACA] disabled:opacity-60"
                        >
                          ✗ Need review
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[#1C1C1C]">
                    Flashcards will appear here once they are ready.
                  </p>
                )}
              </Card>
            )}

            {activeTab === "quiz" && (
              <Card className="rounded-3xl border border-white/40 bg-white/85 p-8 text-[#1C1C1C] backdrop-blur-xl shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
                {quizQuestions.length ? (
                  !quizCompleted ? (
                    <>
                      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-sm uppercase tracking-wider text-[#1C1C1C]">
                            Smart quiz
                          </p>
                          <h3 className="text-2xl font-semibold">
                            Question {currentQuestionIndex + 1} of{" "}
                            {quizQuestions.length}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-[#1C1C1C] backdrop-blur-xl">
                            Score: {quizScore}
                          </div>
                          <Button
                            onClick={handleRegenerateQuiz}
                            disabled={isRegeneratingQuiz}
                            className="rounded-xl border border-white/40 bg-white/80 px-4 py-2 text-sm text-black hover:bg-white/90 shadow-lg disabled:opacity-60 flex items-center gap-2"
                            title="Generate new quiz questions"
                          >
                            <RotateCw className={`h-4 w-4 ${isRegeneratingQuiz ? 'animate-spin' : ''}`} />
                            {isRegeneratingQuiz ? "Regenerating..." : "Refresh Quiz"}
                          </Button>
                        </div>
                      </div>

                      {currentQuestion && (
                        <div className="space-y-6">
                          <div className="rounded-2xl border border-white/20 bg-white/10 p-6 text-lg font-medium text-[#1C1C1C]">
                            {currentQuestion.question}
                          </div>

                          <div className="space-y-3">
                            {currentQuestion.options.map((option, index) => {
                              const isSelected = quizSelectedAnswer === index;
                              const isCorrect =
                                index === currentQuestion.correctAnswer;
                              let optionClasses =
                                "border border-[#E2E8F0] bg-white text-[#1C1C1C] hover:bg-[#F8FAFC]";
                              let letterClasses =
                                "flex h-9 w-9 items-center justify-center rounded-full border border-[#C7D2FE] bg-[#E0E7FF] text-sm font-medium text-[#4338CA]";
                              let optionTextClass = "flex-1 text-[#1C1C1C]";
                              if (quizShowResult) {
                                if (isCorrect) {
                                  optionClasses =
                                    "border border-[#22C55E] bg-[#DCFCE7] text-[#166534]";
                                  letterClasses =
                                    "flex h-9 w-9 items-center justify-center rounded-full border border-[#86EFAC] bg-white text-sm font-medium text-[#166534]";
                                  optionTextClass = "flex-1 text-[#166534]";
                                } else if (isSelected) {
                                  optionClasses =
                                    "border border-[#F87171] bg-[#FEE2E2] text-[#7F1D1D]";
                                  letterClasses =
                                    "flex h-9 w-9 items-center justify-center rounded-full border border-[#FCA5A5] bg-white text-sm font-medium text-[#7F1D1D]";
                                  optionTextClass = "flex-1 text-[#7F1D1D]";
                                } else {
                                  optionClasses =
                                    "border border-[#E2E8F0] bg-white text-[#1C1C1C]";
                                  letterClasses =
                                    "flex h-9 w-9 items-center justify-center rounded-full border border-[#C7D2FE] bg-[#E0E7FF] text-sm font-medium text-[#4338CA]";
                                  optionTextClass = "flex-1 text-[#1C1C1C]";
                                }
                              } else if (isSelected) {
                                optionClasses =
                                  "border border-[#4C1D95] bg-[#4C1D95] text-white shadow-lg";
                                letterClasses =
                                  "flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/20 text-sm font-medium text-white";
                                optionTextClass = "flex-1 text-white";
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
                                  className={`flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left transition ${optionClasses}`}
                                >
                                  <span className={letterClasses}>
                                    {String.fromCharCode(65 + index)}
                                  </span>
                                  <span className={optionTextClass}>
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

                          {quizShowResult && currentQuestion.explanation && (
                            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-sm text-[#1C1C1C]">
                              {currentQuestion.explanation}
                            </div>
                          )}

                          <div className="flex flex-wrap justify-end gap-3">
                            {!quizShowResult ? (
                              <Button
                                onClick={async () => {
                                  await handleSubmitAnswer();
                                }}
                                disabled={quizSelectedAnswer === null}
                                className="rounded-xl border border-white/40 bg-white/80 px-6 py-3 text-black hover:bg-white/90 shadow-lg disabled:opacity-60"
                              >
                                Submit answer
                              </Button>
                            ) : (
                              <Button
                                onClick={handleNextQuestion}
                                className="rounded-xl border border-white/40 bg-white/80 px-6 py-3 text-black hover:bg-white/90 shadow-lg"
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
                        <div className="rounded-full bg-gradient-to-br from-yellow-100 to-orange-200 p-6">
                          <Trophy className="h-16 w-16 text-[#1C1C1C]" />
                        </div>
                      </div>
                      <h3 className="text-3xl font-semibold">
                        Quiz completed!
                      </h3>
                      <div className="rounded-3xl border border-white/20 bg-white/10 p-8 text-[#1C1C1C] backdrop-blur-xl">
                        <p className="text-[#1C1C1C]">Your score</p>
                        <p className="mt-2 text-5xl font-semibold text-[#1C1C1C]">
                          {quizScore} / {quizQuestions.length}
                        </p>
                        <p className="mt-2 text-[#1C1C1C]">
                          {Math.round((quizScore / quizQuestions.length) * 100)}
                          % correct
                        </p>
                      </div>
                      <div className="flex gap-3 justify-center">
                        <Button
                          onClick={handleRestartQuiz}
                          className="rounded-xl border border-white/30 bg-white/20 px-6 py-3 text-white hover:bg-white/30"
                        >
                          Restart quiz
                        </Button>
                        <Button
                          onClick={handleRegenerateQuiz}
                          disabled={isRegeneratingQuiz}
                          className="rounded-xl border border-white/40 bg-white/80 px-6 py-3 text-black hover:bg-white/90 shadow-lg disabled:opacity-60 flex items-center gap-2"
                        >
                          <RotateCw className={`h-4 w-4 ${isRegeneratingQuiz ? 'animate-spin' : ''}`} />
                          {isRegeneratingQuiz ? "Regenerating..." : "Refresh Quiz"}
                        </Button>
                      </div>
                    </div>
                  )
                ) : (
                  <p className="text-[#1C1C1C]">
                    Quiz questions will appear once they are generated for this
                    document.
                  </p>
                )}
              </Card>
            )}

            {activeTab === "qa" && (
              <Card className="rounded-3xl border border-white/40 bg-white/85 p-8 text-[#1C1C1C] backdrop-blur-xl shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-100 p-3">
                    <MessageCircle className="h-6 w-6 text-[#1C1C1C]" />
                  </div>
                  <h3 className="text-2xl font-semibold">Ask the AI Tutor</h3>
                </div>

                <ScrollArea
                  ref={qaScrollRef}
                  className="h-96 rounded-2xl border border-white/10 bg-white/5 p-4 pr-6"
                >
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
                              ? "border-white/30 bg-fuchsia-500/30 backdrop-blur-xl"
                              : "border-white/20 bg-white/10 backdrop-blur-xl"
                          }`}
                        >
                          {message.type === "ai" && (
                            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-[#1C1C1C]">
                              <Sparkles className="h-4 w-4" />
                              AI assistant
                            </div>
                          )}
                          <p className="text-[#1C1C1C]">{message.content}</p>
                          <p className="mt-2 text-right text-xs text-[#1C1C1C]">
                            {new Date(message.timestamp).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                    {qaLoading && (
                      <div className="flex justify-start text-sm text-[#1C1C1C]">
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
                    className="text-[#1C1C1C] placeholder:text-[#1C1C1C]/60"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#1C1C1C]">
                    <span>
                      Press Enter to send, Shift + Enter for a new line
                    </span>
                    <Button
                      type="submit"
                      disabled={!question.trim() || qaLoading}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/80 px-6 py-3 text-black hover:bg-white/90 disabled:opacity-60 shadow-lg"
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
