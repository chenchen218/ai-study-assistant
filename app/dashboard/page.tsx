"use client";

import { useState, useEffect, useRef } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import Link from "next/link";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { BookOpen, Upload } from "lucide-react";

interface Document {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  uploadedAt: string;
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    fetchDocuments();
  }, [user, router]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch("/api/documents");
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File) => {
    if (!file) return;
    setError("");
    if (file.type !== "application/pdf" && !file.name.endsWith(".docx")) {
      setError("Only PDF and DOCX files are supported");
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
      });

      if (response.ok) {
        await fetchDocuments();
        alert("File uploaded successfully! Processing will complete shortly.");
        setSelectedFileName("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Upload failed");
      }
    } catch (error) {
      setError("Upload failed. Please try again.");
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
      });

      if (response.ok) {
        // Remove the document from the list immediately
        setDocuments(documents.filter((doc) => doc.id !== documentId));
        alert("Document deleted successfully");
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to delete document");
      }
    } catch (error) {
      alert("Failed to delete document. Please try again.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-purple-400 via-pink-300 to-blue-400 animate-gradient" />
      <div className="fixed top-20 left-20 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
      <div className="fixed top-40 right-20 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
      <div className="fixed bottom-20 left-1/2 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />

      <div className="relative z-10">
        <nav className="px-4 sm:px-6 lg:px-8 pt-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between rounded-3xl border border-white/20 bg-white/10 px-6 py-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-white/20 border border-white/30">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white text-xl font-semibold">
                  AI Study Assistant
                </p>
                <p className="text-white/70 text-sm">
                  Smarter learning starts here
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-white/80">
                Welcome, {user?.name}
              </span>
              <Link href="/analytics">
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/20 hover:text-white"
                >
                  Analytics
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
              <span className="text-sm text-white/80">
                Document intelligence ready
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
              Upload your study material and let AI coach you
            </h1>
            <p className="mt-4 text-lg text-white/80 max-w-2xl mx-auto">
              Summaries, flashcards, notes, quizzes, and Q&A — all generated
              from your own documents in seconds.
            </p>
          </header>

          <section className="mb-14">
            <Card className="bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl p-8 text-white">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="flex items-center gap-3 text-white text-2xl">
                  <span className="p-3 rounded-xl bg-white/20">
                    <Upload className="w-6 h-6" />
                  </span>
                  Upload Document (PDF or DOCX)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!uploading) {
                      setIsDragging(true);
                    }
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed p-12 text-center transition-all ${
                    isDragging
                      ? "border-white bg-white/10"
                      : "border-white/30 hover:border-white/50"
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
                  <div className="rounded-full bg-white/20 p-6">
                    <Upload className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-medium text-white">
                      Drag & drop your file here
                    </p>
                    <p className="text-sm text-white/70">
                      Supports PDF and DOCX. We’ll generate study-ready
                      materials instantly.
                    </p>
                    {selectedFileName && (
                      <p className="text-sm text-white/80">
                        Selected: {selectedFileName}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="rounded-xl border border-white/30 bg-white/20 px-6 py-3 text-white transition hover:bg-white/30 disabled:opacity-50"
                    >
                      {uploading ? "Uploading..." : "Browse Files"}
                    </Button>
                  </div>
                  {error && (
                    <p className="absolute -bottom-10 text-sm text-red-200">
                      {error}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
              <div>
                <h2 className="text-3xl font-semibold">My Documents</h2>
                <p className="text-white/60">
                  Access summaries, flashcards, quizzes, and more for each
                  upload.
                </p>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 backdrop-blur-xl text-white/80">
                {loading
                  ? "Loading..."
                  : `${documents.length} ${
                      documents.length === 1 ? "document" : "documents"
                    } ready`}
              </div>
            </div>

            {loading ? (
              <Card className="bg-white/10 backdrop-blur-xl border border-white/20 py-16 text-center text-white/80">
                <p>Fetching your study materials...</p>
              </Card>
            ) : documents.length === 0 ? (
              <Card className="bg-white/10 backdrop-blur-xl border border-white/20 py-16 text-center text-white/80">
                <p>No documents yet. Upload your first file to get started!</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {documents.map((doc) => (
                  <Card
                    key={doc.id}
                    className="group relative overflow-hidden border border-white/20 bg-white/10 backdrop-blur-xl transition hover:border-white/40 hover:bg-white/20"
                  >
                    <CardContent className="p-6">
                      <Link href={`/documents/${doc.id}`} className="block">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm text-white/60">
                              {doc.fileType.toUpperCase()}
                            </p>
                            <h3 className="mt-2 text-xl font-semibold text-white line-clamp-2">
                              {doc.fileName}
                            </h3>
                          </div>
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
                        </div>
                        <div className="mt-6 flex items-center justify-between text-sm text-white/70">
                          <span>
                            Updated{" "}
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                          </span>
                          <span className="hidden sm:inline-flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                            <span>Open workspace</span>
                            <span aria-hidden>→</span>
                          </span>
                        </div>
                      </Link>
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(doc.id, doc.fileName);
                        }}
                        disabled={deleting === doc.id}
                        className="mt-6 w-full rounded-xl border border-white/30 bg-white/15 text-white hover:bg-white/25 disabled:opacity-60"
                      >
                        {deleting === doc.id ? "Deleting..." : "Delete"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
