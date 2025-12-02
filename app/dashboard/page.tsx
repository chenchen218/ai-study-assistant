"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ChangeEvent, DragEvent, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import Link from "next/link";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { BookOpen, Upload, Search, X } from "lucide-react";
import { useToast } from "../components/ui/use-toast";

interface Document {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  uploadedAt: string;
}

export default function DashboardPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(
    null
  );
  const [processingStatus, setProcessingStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "processing" | "failed">("all");

  const clearPolling = useCallback(() => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/documents", {
        credentials: "include", // Include cookies for authentication
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
        setError("");
      } else {
        const errorData = await response.json().catch(() => null);
        const message =
          errorData?.error || "Failed to load documents. Please try again.";
        setError(message);
        toast({
          title: "Unable to load documents",
          description: message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      const message = "Network error while fetching documents.";
      setError(message);
      toast({
        title: "Unable to load documents",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const pollDocumentStatus = useCallback(
    async (documentId: string) => {
      try {
        const response = await fetch(`/api/documents/${documentId}`, {
          credentials: "include", // Include cookies for authentication
        });
        if (response.ok) {
          const payload = await response.json();
          const status: string | undefined = payload.document?.status;

          if (status === "completed") {
            setProcessingStatus("");
            setPendingDocumentId(null);
            clearPolling();
            void fetchDocuments();
            router.push(`/documents/${documentId}`);
            return;
          }

          if (status === "failed") {
            setProcessingStatus("");
            setPendingDocumentId(null);
            clearPolling();
            const message = "Document processing failed. Please try again.";
            setError(message);
            toast({
              title: "Processing failed",
              description: message,
              variant: "destructive",
            });
            void fetchDocuments();
            return;
          }

          setProcessingStatus(
            "Processing your document. We’ll open the study workspace as soon as it’s ready."
          );
        } else {
          console.error("Failed to poll document status.");
        }
      } catch (error) {
        console.error("Error polling document status:", error);
      }

      clearPolling();
      pollingTimeoutRef.current = setTimeout(() => {
        void pollDocumentStatus(documentId);
      }, 5000);
    },
    [clearPolling, fetchDocuments, router, toast]
  );

  useEffect(() => {
    // Wait for auth check to complete before redirecting
    if (authLoading) {
      return; // Still checking auth, don't do anything yet
    }
    if (!user) {
      router.push("/login");
      return;
    }
    void fetchDocuments();

    return () => {
      clearPolling();
    };
  }, [user, router, fetchDocuments, clearPolling]);

  const uploadFile = async (file: File) => {
    if (!file) return;
    setError("");
    if (file.type !== "application/pdf" && !file.name.endsWith(".docx")) {
      const message = "Only PDF and DOCX files are supported";
      setError(message);
      toast({
        title: "Upload blocked",
        description: message,
        variant: "destructive",
      });
      return;
    }

    // Check file size (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      const message = `File is too large. Maximum file size is 10MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`;
      setError(message);
      toast({
        title: "File too large",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
        credentials: "include", // Include cookies for authentication
      });

      if (response.ok) {
        const result = await response.json();
        void fetchDocuments();
        toast({
          title: "Upload started",
          description:
            "We’ll open the study workspace once processing is complete.",
          variant: "success",
        });
        const newlyCreatedId: string | undefined = result.document?.id;
        if (newlyCreatedId) {
          setPendingDocumentId(newlyCreatedId);
          setProcessingStatus(
            "Processing your document. We’ll open the study workspace as soon as it’s ready."
          );
          clearPolling();
          void pollDocumentStatus(newlyCreatedId);
        }
        setSelectedFileName("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        const errorData = await response.json();
        const message = errorData.error || "Upload failed";
        setError(message);
        toast({
          title: "Upload failed",
          description: message,
          variant: "destructive",
        });
      }
    } catch (error) {
      const message = "Upload failed. Please try again.";
      setError(message);
      toast({
        title: "Upload failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    setSelectedFileName(file.name);
    void uploadFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] || null;
    if (!file) return;
    setSelectedFileName(file.name);
    void uploadFile(file);
  };

  const handleDelete = async (documentId: string, fileName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete "${fileName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(documentId);
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
        credentials: "include", // Include cookies for authentication
      });

      if (response.ok) {
        // Remove the document from the list immediately
        setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
        if (pendingDocumentId === documentId) {
          setPendingDocumentId(null);
          setProcessingStatus("");
          clearPolling();
        }
        toast({
          title: "Document deleted",
          description: `"${fileName}" has been removed.`,
          variant: "success",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Failed to delete document",
          description: errorData.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to delete document",
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <div className="fixed inset-0 bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 animate-gradient" />
        <div className="fixed top-20 left-20 h-72 w-72 rounded-full bg-purple-500 mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
        <div className="fixed top-40 right-20 h-72 w-72 rounded-full bg-fuchsia-500 mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
        <div className="fixed bottom-20 left-1/2 h-72 w-72 rounded-full bg-pink-500 mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />
        <div className="relative z-10 flex min-h-screen items-center justify-center text-white">
          <p className="text-lg font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 animate-gradient" />
      <div className="fixed top-20 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
      <div className="fixed top-40 right-20 w-72 h-72 bg-fuchsia-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
      <div className="fixed bottom-20 left-1/2 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />

      <div className="relative z-10">
        <nav className="px-4 sm:px-6 lg:px-8 pt-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between rounded-3xl border border-white/30 bg-white/20 px-6 py-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-white/20 border border-white/30">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white text-xl font-semibold">
                  AI Study Assistant
                </p>
                <p className="text-white/90 text-sm font-medium">
                  Smarter learning starts here
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-white/90 font-medium">
                Welcome, {user?.name}
              </span>
              <Link href="/error-book">
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/20 hover:text-white"
                >
                  Error Book
                </Button>
              </Link>
              <Link href="/analytics">
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/20 hover:text-white"
                >
                  Analytics
                </Button>
              </Link>
              <Link href="/profile">
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/20 hover:text-white"
                >
                  Profile
                </Button>
              </Link>
              {user?.role === "admin" && (
                <Link href="/admin">
                  <Button
                    variant="ghost"
                    className="text-white hover:bg-white/20 hover:text-white"
                  >
                    Admin
                  </Button>
                </Link>
              )}
              <Button
                onClick={logout}
                variant="destructive"
                className="bg-white/20 text-white hover:bg-white/30 border border-white/40"
              >
                Logout
              </Button>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-white">
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-3 mb-4 rounded-3xl border border-white/30 bg-white/10 px-4 py-2 backdrop-blur-xl">
              <div className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
              <span className="text-sm text-white/90 font-medium">
                Document intelligence ready
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white">
              Upload your study material and let AI coach you
            </h1>
            <p className="mt-4 text-lg text-white/90 max-w-2xl mx-auto font-medium">
              Summaries, flashcards, notes, quizzes, and Q&A — all generated
              from your own documents in seconds.
            </p>
          </header>

          <section className="mb-14 grid gap-8 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-start">
            <Card className="border border-white/20 bg-white/10 p-6 text-white backdrop-blur-2xl shadow-2xl">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="flex items-center gap-3 text-white text-xl">
                  <span className="rounded-xl bg-white/20 p-2.5">
                    <Upload className="h-5 w-5" />
                  </span>
                  Upload Study Materials
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <p className="text-sm text-white/80 font-medium">
                  Supports PDF and DOCX. We&apos;ll generate summaries, notes, and
                  quizzes right away.
                </p>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!uploading) {
                      setIsDragging(true);
                    }
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`mt-5 flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all ${
                    isDragging
                      ? "border-white bg-white/10"
                      : "border-white/25 hover:border-white/45"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileInputChange}
                    disabled={uploading}
                    className="hidden"
                  />
                  <div className="rounded-full bg-white/20 p-4">
                    <Upload className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-medium text-white">
                      Drag your file here
                    </p>
                    <p className="text-sm text-white/80 font-medium">
                      or click the button to browse
                    </p>
                    {selectedFileName && (
                      <p className="text-xs text-white/80 font-medium">
                        Selected file: {selectedFileName}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="rounded-lg border border-white/25 bg-white/20 px-5 py-2.5 text-white transition hover:bg-white/30 disabled:opacity-50"
                  >
                    {uploading ? "Uploading..." : "Choose File"}
                  </Button>
                  {error && <p className="text-xs text-red-200">{error}</p>}
                  {processingStatus && (
                    <p className="text-xs text-white/80">{processingStatus}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-semibold text-white">My Documents</h2>
                  <p className="text-white/80 font-medium">
                    Every upload comes with its own study workspace.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-white/90 backdrop-blur-xl">
                  {loading
                    ? "Loading..."
                    : (() => {
                        const filteredCount = documents.filter((doc) => {
                          const matchesSearch =
                            searchQuery === "" ||
                            doc.fileName.toLowerCase().includes(searchQuery.toLowerCase());
                          const matchesStatus =
                            statusFilter === "all" || doc.status === statusFilter;
                          return matchesSearch && matchesStatus;
                        }).length;
                        return `${filteredCount} of ${documents.length} document${
                          documents.length === 1 ? "" : "s"
                        }`;
                      })()}
                </div>
              </div>

              {/* Search and Filter */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search documents..."
                    className="w-full rounded-lg border border-white/30 bg-white/10 px-10 py-2.5 text-white placeholder:text-white/60 focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/20 backdrop-blur-xl"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setStatusFilter("all")}
                    variant={statusFilter === "all" ? "default" : "ghost"}
                    className={`rounded-lg border ${
                      statusFilter === "all"
                        ? "border-white/50 bg-white/20 text-white"
                        : "border-white/30 bg-white/10 text-white/80 hover:bg-white/15"
                    }`}
                  >
                    All
                  </Button>
                  <Button
                    onClick={() => setStatusFilter("completed")}
                    variant={statusFilter === "completed" ? "default" : "ghost"}
                    className={`rounded-lg border ${
                      statusFilter === "completed"
                        ? "border-white/50 bg-white/20 text-white"
                        : "border-white/30 bg-white/10 text-white/80 hover:bg-white/15"
                    }`}
                  >
                    Completed
                  </Button>
                  <Button
                    onClick={() => setStatusFilter("processing")}
                    variant={statusFilter === "processing" ? "default" : "ghost"}
                    className={`rounded-lg border ${
                      statusFilter === "processing"
                        ? "border-white/50 bg-white/20 text-white"
                        : "border-white/30 bg-white/10 text-white/80 hover:bg-white/15"
                    }`}
                  >
                    Processing
                  </Button>
                  <Button
                    onClick={() => setStatusFilter("failed")}
                    variant={statusFilter === "failed" ? "default" : "ghost"}
                    className={`rounded-lg border ${
                      statusFilter === "failed"
                        ? "border-white/50 bg-white/20 text-white"
                        : "border-white/30 bg-white/10 text-white/80 hover:bg-white/15"
                    }`}
                  >
                    Failed
                  </Button>
                </div>
              </div>

              {loading ? (
                <Card className="border border-white/20 bg-white/10 py-12 text-center text-white/80 backdrop-blur-xl">
                  <p>Fetching your study materials...</p>
                </Card>
              ) : documents.length === 0 ? (
                <Card className="border border-white/20 bg-white/10 py-12 text-center text-white/80 backdrop-blur-xl">
                  <p>No documents yet. Upload a file to start learning!</p>
                </Card>
              ) : (() => {
                // Filter documents based on search query and status
                const filteredDocuments = documents.filter((doc) => {
                  const matchesSearch =
                    searchQuery === "" ||
                    doc.fileName.toLowerCase().includes(searchQuery.toLowerCase());
                  const matchesStatus =
                    statusFilter === "all" || doc.status === statusFilter;
                  return matchesSearch && matchesStatus;
                });

                return filteredDocuments.length === 0 ? (
                  <Card className="border border-white/20 bg-white/10 py-12 text-center text-white/80 backdrop-blur-xl">
                    <p>No documents match your search criteria.</p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {filteredDocuments.map((doc) => (
                    <Card
                      key={doc.id}
                      className="border border-white/15 bg-white/10 backdrop-blur-xl transition hover:border-white/30 hover:bg-white/16"
                    >
                      <CardContent className="p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-3">
                            <Link
                              href={`/documents/${doc.id}`}
                              className="group block"
                            >
                              <div className="flex items-center gap-3">
                                <span className="rounded-lg border border-white/25 bg-white/10 px-2 py-1 text-xs font-medium text-white/70">
                                  {doc.fileType.toUpperCase()}
                                </span>
                                <span className="text-sm text-white/70 font-medium">
                                  Updated{" "}
                                  {new Date(
                                    doc.uploadedAt
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                              <h3 className="mt-2 text-xl font-semibold text-white">
                                {doc.fileName}
                              </h3>
                              <p className="mt-2 inline-flex items-center gap-2 text-sm text-white/70 transition group-hover:text-white/80">
                                Open study workspace <span aria-hidden>→</span>
                              </p>
                            </Link>
                          </div>
                          <div className="flex flex-col items-start gap-3 sm:items-end">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide ${
                                doc.status === "completed"
                                  ? "bg-emerald-400/20 text-emerald-100"
                                  : doc.status === "processing"
                                  ? "bg-yellow-300/25 text-yellow-100"
                                  : "bg-red-400/25 text-red-100"
                              }`}
                            >
                              {doc.status}
                            </span>
                            <Button
                              onClick={(e: MouseEvent<HTMLButtonElement>) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDelete(doc.id, doc.fileName);
                              }}
                              disabled={deleting === doc.id}
                              className="w-full rounded-lg border border-white/25 bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25 disabled:opacity-60 sm:w-auto"
                            >
                              {deleting === doc.id ? "Deleting..." : "Delete"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    ))}
                  </div>
                );
              })()}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
