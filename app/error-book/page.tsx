"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
  BookOpen,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  XCircle,
  CheckCircle2,
  FileText,
  Trash2,
} from "lucide-react";
import Link from "next/link";

interface WrongAnswer {
  id: string;
  question: string;
  options: string[];
  selectedAnswer: number;
  correctAnswer: number;
  explanation?: string;
  attemptedAt: string;
}

interface ErrorBook {
  document: {
    id: string;
    fileName: string;
    fileType: string;
    uploadedAt: string;
    isDeleted?: boolean;
  };
  wrongAnswers: WrongAnswer[];
}

export default function ErrorBookPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [errorBooks, setErrorBooks] = useState<ErrorBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDocuments, setExpandedDocuments] = useState<Set<string>>(
    new Set()
  );
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (authLoading) {
      return; // Still checking auth, don't do anything yet
    }
    if (!user) {
      router.push("/login");
      return;
    }
    fetchErrorBooks();
  }, [user, router, authLoading]);

  const fetchErrorBooks = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/error-book");
      if (response.ok) {
        const data = await response.json();
        console.log("📖 Error book data:", data);
        setErrorBooks(data.errorBooks || []);
        // Expand all documents by default
        const allDocIds = new Set<string>(
          (data.errorBooks || []).map((eb: ErrorBook) => String(eb.document.id))
        );
        setExpandedDocuments(allDocIds);
      } else {
        const errorData = await response.json();
        console.error("❌ Error fetching error books:", errorData);
      }
    } catch (error) {
      console.error("❌ Error fetching error books:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDocument = (documentId: string) => {
    setExpandedDocuments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(documentId)) {
        newSet.delete(documentId);
      } else {
        newSet.add(documentId);
      }
      return newSet;
    });
  };

  const handleDelete = async (documentId: string, wrongAnswerId: string) => {
    if (
      !confirm(
        "Are you sure you want to remove this question from your error book?"
      )
    ) {
      return;
    }

    setDeletingIds((prev) => new Set(prev).add(wrongAnswerId));
    try {
      // Use documentId or "deleted" if document was deleted
      const docId = documentId === "deleted" ? "deleted" : documentId;
      
      const response = await fetch(
        `/api/error-book/${docId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wrongAnswerId }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Wrong answer deleted:", result);
        
        // Remove from local state
        setErrorBooks((prev) =>
          prev.map((eb) => ({
            ...eb,
            wrongAnswers: eb.wrongAnswers.filter(
              (wa) => wa.id !== wrongAnswerId
            ),
          })).filter((eb) => eb.wrongAnswers.length > 0)
        );
      } else {
        const errorData = await response.json();
        console.error("❌ Failed to delete:", errorData);
        alert(errorData.error || "Failed to delete. Please try again.");
      }
    } catch (error) {
      console.error("❌ Error deleting wrong answer:", error);
      alert("Failed to delete. Please try again.");
    } finally {
      setDeletingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(wrongAnswerId);
        return newSet;
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
        <div className="relative z-10 flex min-h-screen items-center justify-center text-white">
          <p>Loading your error book...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div className="fixed inset-0 bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 animate-gradient" />
      <div className="fixed top-20 left-20 h-72 w-72 rounded-full bg-purple-500 mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
      <div className="fixed top-40 right-20 h-72 w-72 rounded-full bg-fuchsia-500 mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
      <div className="fixed bottom-20 left-1/2 h-72 w-72 rounded-full bg-pink-500 mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />

      <div className="relative z-10">
        <header className="px-4 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Card className="border border-white/40 bg-white/25 p-4 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Link href="/dashboard">
                    <Button
                      variant="ghost"
                      className="rounded-lg border border-white/40 bg-white/25 text-white hover:bg-white/35"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                  </Link>
                  <div className="rounded-lg bg-white/30 p-2 border border-white/40">
                    <BookOpen className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white">
                      Error Book
                    </h1>
                    <p className="text-sm text-white font-medium">
                      Review and master your mistakes
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {errorBooks.length === 0 ? (
            <Card className="border border-white/40 bg-white/25 p-12 text-center backdrop-blur-xl">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/30 border border-white/40">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-white">
                No mistakes yet!
              </h2>
              <p className="text-white font-medium">
                Keep practicing quizzes to build your error book.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {errorBooks.map((errorBook) => {
                const isExpanded = expandedDocuments.has(errorBook.document.id);
                return (
                  <Card
                    key={errorBook.document.id}
                    className="border border-white/40 bg-white/25 backdrop-blur-xl"
                  >
                    <button
                      onClick={() => toggleDocument(errorBook.document.id)}
                      className="w-full p-4 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-white font-bold" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-white font-bold" />
                          )}
                          <div className="rounded-lg bg-white/30 p-2 border border-white/40">
                            <FileText className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-white">
                              {errorBook.document.fileName}
                              {errorBook.document.isDeleted && (
                                <span className="ml-2 text-xs text-white/70 font-normal italic">
                                  (deleted)
                                </span>
                              )}
                            </h3>
                            <p className="text-sm text-white font-medium">
                              {errorBook.wrongAnswers.length} wrong answer
                              {errorBook.wrongAnswers.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        {errorBook.document.isDeleted ? (
                          <span className="text-sm text-white/70 font-medium italic">
                            Document deleted
                          </span>
                        ) : (
                          <Link
                            href={`/documents/${errorBook.document.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              className="text-white font-semibold hover:bg-white/30 border border-white/40"
                            >
                              View Document
                            </Button>
                          </Link>
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-white/40 p-4">
                        <div className="space-y-4">
                          {errorBook.wrongAnswers.map((wrongAnswer) => (
                            <Card
                              key={wrongAnswer.id}
                              className="border border-white/30 bg-white/20 p-6 backdrop-blur-sm"
                            >
                              <div className="mb-4 flex items-start justify-between">
                                <h4 className="flex-1 text-lg font-bold text-white">
                                  {wrongAnswer.question}
                                </h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleDelete(
                                      errorBook.document.id,
                                      wrongAnswer.id
                                    )
                                  }
                                  disabled={deletingIds.has(wrongAnswer.id)}
                                  className="text-white hover:bg-white/30 border border-white/30"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="mb-4 space-y-2">
                                {wrongAnswer.options.map((option, index) => {
                                  const isSelected =
                                    index === wrongAnswer.selectedAnswer;
                                  const isCorrect =
                                    index === wrongAnswer.correctAnswer;
                                  return (
                                    <div
                                      key={index}
                                      className={`flex items-center gap-3 rounded-lg border-2 p-3 ${
                                        isCorrect
                                          ? "border-green-500/70 bg-green-500/30"
                                          : isSelected
                                          ? "border-red-500/70 bg-red-500/30"
                                          : "border-white/40 bg-white/15"
                                      }`}
                                    >
                                      <div
                                        className={`flex h-10 w-10 items-center justify-center rounded-full text-base font-bold ${
                                          isCorrect
                                            ? "bg-green-600 text-white"
                                            : isSelected
                                            ? "bg-red-600 text-white"
                                            : "bg-white/30 text-white border border-white/40"
                                        }`}
                                      >
                                        {String.fromCharCode(65 + index)}
                                      </div>
                                      <span className="flex-1 text-white font-semibold">
                                        {option}
                                      </span>
                                      {isCorrect && (
                                        <CheckCircle2 className="h-6 w-6 text-green-300" />
                                      )}
                                      {isSelected && !isCorrect && (
                                        <XCircle className="h-6 w-6 text-red-300" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {wrongAnswer.explanation && (
                                <div className="rounded-lg border border-white/40 bg-white/20 p-4">
                                  <p className="mb-2 text-sm font-bold text-white">
                                    Explanation:
                                  </p>
                                  <p className="text-white font-medium">
                                    {wrongAnswer.explanation}
                                  </p>
                                </div>
                              )}

                              <p className="mt-4 text-xs text-white font-medium">
                                Attempted on{" "}
                                {new Date(
                                  wrongAnswer.attemptedAt
                                ).toLocaleDateString()}
                              </p>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

