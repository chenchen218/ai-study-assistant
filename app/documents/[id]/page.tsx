"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "../../providers/AuthProvider";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

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

export default function DocumentPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const documentId = (params?.id as string) || "";

  const [data, setData] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "summary" | "notes" | "flashcards" | "quiz" | "qa"
  >("summary");
  const [currentFlashcard, setCurrentFlashcard] = useState(0);
  const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [qaLoading, setQaLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!documentId) {
      setLoading(false);
      return;
    }
    fetchDocument();
  }, [user, documentId, router]);

  const fetchDocument = async () => {
    if (!documentId) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`/api/documents/${documentId}`);
      if (response.ok) {
        const documentData = await response.json();
        setData(documentData);
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

  const handleAskQuestion = async () => {
    if (!question.trim()) return;

    setQaLoading(true);
    try {
      const response = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, question }),
      });

      if (response.ok) {
        const data = await response.json();
        setAnswer(data.answer);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "notes", label: "Notes" },
    { id: "flashcards", label: "Flashcards" },
    { id: "quiz", label: "Quiz" },
    { id: "qa", label: "Q&A" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
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
                {data.document.fileName}
              </h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {data.document.status === "processing" && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
            Document is still being processed. Some content may not be available
            yet.
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 ${
                    activeTab === tab.id
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === "summary" && (
              <div>
                {data.summary ? (
                  <div className="prose max-w-none">
                    <ReactMarkdown>{data.summary.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-gray-500">Summary not available yet.</p>
                )}
              </div>
            )}

            {activeTab === "notes" && (
              <div>
                {data.notes ? (
                  <div className="prose max-w-none">
                    <h2 className="text-2xl font-bold mb-4">
                      {data.notes.title}
                    </h2>
                    <ReactMarkdown>{data.notes.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-gray-500">Notes not available yet.</p>
                )}
              </div>
            )}

            {activeTab === "flashcards" && (
              <div>
                {data.flashcards.length > 0 ? (
                  <div className="max-w-2xl mx-auto">
                    <div className="bg-indigo-50 rounded-lg p-8 mb-6 min-h-[300px] flex flex-col justify-center">
                      <div className="text-center mb-4">
                        <span className="text-sm text-gray-600">
                          Card {currentFlashcard + 1} of{" "}
                          {data.flashcards.length}
                        </span>
                      </div>
                      <div className="text-xl font-semibold mb-4 text-center">
                        {data.flashcards[currentFlashcard].question}
                      </div>
                      {showFlashcardAnswer && (
                        <div className="mt-4 p-4 bg-white rounded border-l-4 border-indigo-500">
                          <p className="text-gray-700">
                            {data.flashcards[currentFlashcard].answer}
                          </p>
                        </div>
                      )}
                      {!showFlashcardAnswer && (
                        <button
                          onClick={() => setShowFlashcardAnswer(true)}
                          className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
                        >
                          Show Answer
                        </button>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <button
                        onClick={() => {
                          setCurrentFlashcard(
                            Math.max(0, currentFlashcard - 1)
                          );
                          setShowFlashcardAnswer(false);
                        }}
                        disabled={currentFlashcard === 0}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => {
                          setCurrentFlashcard(
                            Math.min(
                              data.flashcards.length - 1,
                              currentFlashcard + 1
                            )
                          );
                          setShowFlashcardAnswer(false);
                        }}
                        disabled={
                          currentFlashcard === data.flashcards.length - 1
                        }
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">Flashcards not available yet.</p>
                )}
              </div>
            )}

            {activeTab === "quiz" && (
              <div>
                {data.quizQuestions.length > 0 ? (
                  <div className="space-y-6">
                    {data.quizQuestions.map((q, index) => (
                      <div key={q.id} className="border rounded-lg p-6">
                        <h3 className="text-lg font-semibold mb-4">
                          Question {index + 1}: {q.question}
                        </h3>
                        <div className="space-y-2">
                          {q.options.map((option, optIndex) => {
                            const isSelected = quizAnswers[q.id] === optIndex;
                            const isCorrect = optIndex === q.correctAnswer;
                            const showResult = quizSubmitted;

                            return (
                              <label
                                key={optIndex}
                                className={`block p-3 border rounded-md cursor-pointer ${
                                  showResult
                                    ? isCorrect
                                      ? "bg-green-100 border-green-500"
                                      : isSelected && !isCorrect
                                      ? "bg-red-100 border-red-500"
                                      : ""
                                    : isSelected
                                    ? "bg-indigo-50 border-indigo-500"
                                    : "border-gray-300 hover:bg-gray-50"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={q.id}
                                  value={optIndex}
                                  checked={isSelected}
                                  onChange={() => {
                                    setQuizAnswers({
                                      ...quizAnswers,
                                      [q.id]: optIndex,
                                    });
                                  }}
                                  disabled={showResult}
                                  className="mr-2"
                                />
                                {option}
                              </label>
                            );
                          })}
                        </div>
                        {showResult && q.explanation && (
                          <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
                            <p className="text-sm text-gray-700">
                              {q.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                    {!quizSubmitted ? (
                      <button
                        onClick={() => setQuizSubmitted(true)}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700"
                      >
                        Submit Answers
                      </button>
                    ) : (
                      <div className="bg-gray-100 p-4 rounded-lg">
                        <p className="font-semibold">
                          Score:{" "}
                          {
                            Object.keys(quizAnswers).filter(
                              (qId) =>
                                quizAnswers[qId] ===
                                data.quizQuestions.find((q) => q.id === qId)
                                  ?.correctAnswer
                            ).length
                          }{" "}
                          / {data.quizQuestions.length}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">
                    Quiz questions not available yet.
                  </p>
                )}
              </div>
            )}

            {activeTab === "qa" && (
              <div>
                <div className="mb-6">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Ask a question about this document..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      onKeyPress={(e) =>
                        e.key === "Enter" && handleAskQuestion()
                      }
                    />
                    <button
                      onClick={handleAskQuestion}
                      disabled={qaLoading || !question.trim()}
                      className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {qaLoading ? "Asking..." : "Ask"}
                    </button>
                  </div>
                </div>
                {answer && (
                  <div className="bg-gray-50 border-l-4 border-indigo-500 p-4 rounded-md">
                    <h3 className="font-semibold mb-2">Answer:</h3>
                    <p className="text-gray-700">{answer}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
