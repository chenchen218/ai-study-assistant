"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ChangeEvent, DragEvent, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import Link from "next/link";
import Image from "next/image";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { BookOpen, Upload, Search, X, Folder, FolderPlus, Edit2, Trash2, GripVertical, Youtube, AlertTriangle, CheckCircle, Clock, ExternalLink } from "lucide-react";
import { Input } from "../components/ui/input";

interface Document {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  folderId: string | null;
  uploadedAt: string;
  youtubeUrl?: string;
  youtubeThumbnail?: string;
  videoDuration?: number;
}

interface YouTubeVideoInfo {
  valid: boolean;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration: number;
  durationFormatted: string;
  categoryId: string;
  isEducational: boolean;
  educationalConfidence: number;
  educationalReason: string;
  remaining: number;
  dailyLimit: number;
}

interface FolderType {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
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
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [renamingDocumentId, setRenamingDocumentId] = useState<string | null>(null);
  const [renamingDocumentName, setRenamingDocumentName] = useState("");
  const [draggedDocumentId, setDraggedDocumentId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  
  // YouTube states
  const [showYouTubeModal, setShowYouTubeModal] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeValidating, setYoutubeValidating] = useState(false);
  const [youtubeVideoInfo, setYoutubeVideoInfo] = useState<YouTubeVideoInfo | null>(null);
  const [youtubeError, setYoutubeError] = useState("");
  const [youtubeSubmitting, setYoutubeSubmitting] = useState(false);

  const clearPolling = useCallback(() => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);

  const fetchFolders = useCallback(async () => {
    try {
      const response = await fetch("/api/folders", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setFolders(data.folders || []);
      }
    } catch (error) {
      console.error("Error fetching folders:", error);
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
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  }, []);

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
            setError("Document processing failed. Please try again.");
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
    [clearPolling, fetchDocuments, router]
  );

  // YouTube validation function
  const validateYouTubeUrl = useCallback(async (url: string) => {
    if (!url.trim()) {
      setYoutubeVideoInfo(null);
      setYoutubeError("");
      return;
    }

    setYoutubeValidating(true);
    setYoutubeError("");
    setYoutubeVideoInfo(null);

    try {
      const response = await fetch("/api/youtube/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        setYoutubeError(data.message || data.error || "Invalid YouTube URL");
        return;
      }

      setYoutubeVideoInfo(data);
    } catch (error) {
      console.error("YouTube validation error:", error);
      setYoutubeError("Failed to validate YouTube URL");
    } finally {
      setYoutubeValidating(false);
    }
  }, []);

  // YouTube submit function
  const handleYouTubeSubmit = useCallback(async () => {
    if (!youtubeVideoInfo) return;

    setYoutubeSubmitting(true);
    setYoutubeError("");

    try {
      const response = await fetch("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          videoId: youtubeVideoInfo.videoId,
          url: youtubeUrl,
          title: youtubeVideoInfo.title,
          thumbnail: youtubeVideoInfo.thumbnail,
          duration: youtubeVideoInfo.duration,
          categoryId: youtubeVideoInfo.categoryId,
          isEducational: youtubeVideoInfo.isEducational,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setYoutubeError(data.message || data.error || "Failed to add video");
        return;
      }

      // Success - close modal and refresh documents
      setShowYouTubeModal(false);
      setYoutubeUrl("");
      setYoutubeVideoInfo(null);
      fetchDocuments();
      
      // Start polling for the new document
      if (data.document?.id) {
        setPendingDocumentId(data.document.id);
        setProcessingStatus("Processing YouTube video. This may take a few minutes...");
        pollDocumentStatus(data.document.id);
      }
    } catch (error) {
      console.error("YouTube submit error:", error);
      setYoutubeError("Failed to add YouTube video");
    } finally {
      setYoutubeSubmitting(false);
    }
  }, [youtubeVideoInfo, youtubeUrl, fetchDocuments, pollDocumentStatus]);

  // Debounced YouTube URL validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (youtubeUrl.trim()) {
        validateYouTubeUrl(youtubeUrl);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [youtubeUrl, validateYouTubeUrl]);

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
    void fetchFolders();

    return () => {
      clearPolling();
    };
  }, [user, router, fetchDocuments, fetchFolders, clearPolling]);

  const uploadFile = async (file: File) => {
    if (!file) return;
    setError("");
    if (file.type !== "application/pdf" && !file.name.endsWith(".docx")) {
      setError("Only PDF and DOCX files are supported");
      return;
    }

    // Check file size (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      setError(`File is too large. Maximum file size is 10MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`);
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
        alert(
          "File uploaded successfully! We’ll open the study workspace once processing is complete."
        );
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

  const handleFileDrop = (e: DragEvent<HTMLDivElement>) => {
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

  // Folder functions
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setError("Folder name cannot be empty");
      return;
    }

    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newFolderName.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setFolders((prev) => [data.folder, ...prev]);
        setNewFolderName("");
        setShowCreateFolder(false);
        setError("");
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to create folder");
      }
    } catch (error) {
      setError("Failed to create folder. Please try again.");
    }
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!editingFolderName.trim()) {
      setError("Folder name cannot be empty");
      return;
    }

    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: editingFolderName.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setFolders((prev) =>
          prev.map((f) => (f.id === folderId ? data.folder : f))
        );
        setEditingFolderId(null);
        setEditingFolderName("");
        setError("");
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to rename folder");
      }
    } catch (error) {
      setError("Failed to rename folder. Please try again.");
    }
  };

  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete folder "${folderName}"? Documents in this folder will be moved to root.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        if (selectedFolderId === folderId) {
          setSelectedFolderId(null);
        }
        void fetchDocuments(); // Refresh documents to update folderId
        alert("Folder deleted successfully");
      } else {
        const errorData = await response.json();
        alert(errorData.error || "Failed to delete folder");
      }
    } catch (error) {
      alert("Failed to delete folder. Please try again.");
    }
  };

  const handleRenameDocument = async (documentId: string) => {
    if (!renamingDocumentName.trim()) {
      setError("Document name cannot be empty");
      return;
    }

    try {
      const response = await fetch(`/api/documents/${documentId}/rename`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fileName: renamingDocumentName.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments((prev) =>
          prev.map((d) => (d.id === documentId ? { ...d, fileName: data.document.fileName } : d))
        );
        setRenamingDocumentId(null);
        setRenamingDocumentName("");
        setError("");
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to rename document");
      }
    } catch (error) {
      setError("Failed to rename document. Please try again.");
    }
  };

  const handleMoveDocument = async (documentId: string, targetFolderId: string | null) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/move`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ folderId: targetFolderId }),
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments((prev) =>
          prev.map((d) => (d.id === documentId ? { ...d, folderId: data.document.folderId } : d))
        );
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to move document");
      }
    } catch (error) {
      setError("Failed to move document. Please try again.");
    }
  };

  const handleDragStart = (e: React.DragEvent, documentId: string) => {
    setDraggedDocumentId(documentId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedDocumentId) {
      setDragOverFolderId(folderId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only clear if we're leaving the folder element itself, not a child
    const currentTarget = e.currentTarget as HTMLElement;
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!currentTarget.contains(relatedTarget)) {
      setDragOverFolderId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    if (draggedDocumentId) {
      handleMoveDocument(draggedDocumentId, targetFolderId);
      setDraggedDocumentId(null);
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
              {user?.avatarUrl || user?.picture ? (
                <Image
                  src={user?.avatarUrl || user?.picture || ""}
                  alt="Avatar"
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full object-cover border-2 border-white/30"
                  unoptimized
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </span>
                </div>
              )}
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
                  onDrop={handleFileDrop}
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
                  <div className="flex gap-3">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="rounded-lg border border-white/25 bg-white/20 px-5 py-2.5 text-white transition hover:bg-white/30 disabled:opacity-50"
                    >
                      {uploading ? "Uploading..." : "Choose File"}
                    </Button>
                    <Button
                      onClick={() => setShowYouTubeModal(true)}
                      disabled={uploading}
                      className="rounded-lg border border-red-400/50 bg-red-500/20 px-5 py-2.5 text-white transition hover:bg-red-500/30 disabled:opacity-50 flex items-center gap-2"
                    >
                      <Youtube className="h-4 w-4" />
                      YouTube
                    </Button>
                  </div>
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

              {/* Folders Sidebar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Folders</h3>
                  <Button
                    onClick={() => {
                      setShowCreateFolder(true);
                      setNewFolderName("");
                    }}
                    className="bg-white/20 text-white hover:bg-white/30 border border-white/40 h-8 px-3 text-sm"
                  >
                    <FolderPlus className="h-4 w-4 mr-1" />
                    New
                  </Button>
                </div>

                {showCreateFolder && (
                  <div className="mb-4 p-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-xl">
                      <Input
                        value={newFolderName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFolderName(e.target.value)}
                        placeholder="Folder name"
                        className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30 mb-2"
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === "Enter") {
                          handleCreateFolder();
                        } else if (e.key === "Escape") {
                          setShowCreateFolder(false);
                          setNewFolderName("");
                        }
                      }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCreateFolder}
                        className="bg-white/20 text-white hover:bg-white/30 border border-white/40 h-8 px-3 text-sm"
                      >
                        Create
                      </Button>
                      <Button
                        onClick={() => {
                          setShowCreateFolder(false);
                          setNewFolderName("");
                        }}
                        variant="ghost"
                        className="text-white/80 hover:text-white hover:bg-white/20 h-8 px-3 text-sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedFolderId(null)}
                    className={`w-full text-left p-2 rounded-lg transition-all duration-200 ${
                      selectedFolderId === null
                        ? "bg-white/20 border border-white/30"
                        : dragOverFolderId === null && draggedDocumentId
                        ? "bg-white/15 border-2 border-dashed border-purple-400/60 shadow-lg shadow-purple-500/20"
                        : "bg-white/10 border border-white/10 hover:bg-white/15"
                    }`}
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => handleDragEnter(e, null)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, null)}
                  >
                    <div className="flex items-center gap-2 text-white">
                      <Folder className="h-4 w-4" />
                      <span className="text-sm font-medium">All Documents</span>
                      {dragOverFolderId === null && draggedDocumentId && (
                        <span className="ml-auto text-xs text-purple-300 font-medium animate-pulse">
                          Drop here
                        </span>
                      )}
                    </div>
                  </button>

                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        selectedFolderId === folder.id
                          ? "bg-white/20 border border-white/30"
                          : dragOverFolderId === folder.id && draggedDocumentId
                          ? "bg-white/20 border-2 border-dashed border-purple-400/60 shadow-lg shadow-purple-500/20 scale-[1.02]"
                          : "bg-white/10 border border-white/10 hover:bg-white/15"
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        handleDragOver(e);
                      }}
                      onDragEnter={(e) => handleDragEnter(e, folder.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDrop(e, folder.id);
                      }}
                    >
                      {editingFolderId === folder.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingFolderName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingFolderName(e.target.value)}
                            className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30 h-8 text-sm"
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                              if (e.key === "Enter") {
                                handleRenameFolder(folder.id);
                              } else if (e.key === "Escape") {
                                setEditingFolderId(null);
                                setEditingFolderName("");
                              }
                            }}
                            autoFocus
                          />
                          <Button
                            onClick={() => handleRenameFolder(folder.id)}
                            className="bg-white/20 text-white hover:bg-white/30 border border-white/40 h-8 px-2"
                          >
                            ✓
                          </Button>
                          <Button
                            onClick={() => {
                              setEditingFolderId(null);
                              setEditingFolderName("");
                            }}
                            variant="ghost"
                            className="text-white/80 hover:text-white hover:bg-white/20 h-8 px-2"
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFolderId(folder.id);
                            }}
                            onMouseDown={(e) => {
                              // Prevent drag from starting when clicking the button
                              e.stopPropagation();
                            }}
                            className="flex items-center gap-2 text-white flex-1 text-left"
                          >
                            <Folder
                              className={`h-4 w-4 transition-transform ${
                                dragOverFolderId === folder.id && draggedDocumentId
                                  ? "scale-110"
                                  : ""
                              }`}
                              style={{ color: dragOverFolderId === folder.id && draggedDocumentId ? "#a78bfa" : folder.color }}
                            />
                            <span className="text-sm font-medium">{folder.name}</span>
                            {dragOverFolderId === folder.id && draggedDocumentId && (
                              <span className="ml-auto text-xs text-purple-300 font-medium animate-pulse">
                                Drop here
                              </span>
                            )}
                          </button>
                          <div className="flex items-center gap-1">
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingFolderId(folder.id);
                                setEditingFolderName(folder.name);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              variant="ghost"
                              className="text-white/60 hover:text-white hover:bg-white/20 h-6 w-6 p-0"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteFolder(folder.id, folder.name);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              variant="ghost"
                              className="text-white/60 hover:text-white hover:bg-white/20 h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
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
                // Filter documents based on search query, status, and folder
                const filteredDocuments = documents.filter((doc) => {
                  const matchesSearch =
                    searchQuery === "" ||
                    doc.fileName.toLowerCase().includes(searchQuery.toLowerCase());
                  const matchesStatus =
                    statusFilter === "all" || doc.status === statusFilter;
                  const matchesFolder =
                    selectedFolderId === null
                      ? true
                      : doc.folderId === selectedFolderId;
                  return matchesSearch && matchesStatus && matchesFolder;
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
                      draggable
                      onDragStart={(e: React.DragEvent) => {
                        handleDragStart(e, doc.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDraggedDocumentId(null);
                        setDragOverFolderId(null);
                      }}
                      className={`border border-white/15 bg-white/10 backdrop-blur-xl transition-all ${
                        draggedDocumentId === doc.id
                          ? "opacity-50 scale-95"
                          : "hover:border-white/30 hover:bg-white/16"
                      }`}
                    >
                      <CardContent className="p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-3 flex-1">
                            <div className="flex items-center gap-2">
                              <GripVertical className="h-4 w-4 text-white/40 cursor-move" />
                              <div className="flex-1">
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
                                {renamingDocumentId === doc.id ? (
                                  <div className="mt-2 flex items-center gap-2">
                                    <Input
                                      value={renamingDocumentName}
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRenamingDocumentName(e.target.value)}
                                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30 h-8 text-sm"
                                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                        if (e.key === "Enter") {
                                          handleRenameDocument(doc.id);
                                        } else if (e.key === "Escape") {
                                          setRenamingDocumentId(null);
                                          setRenamingDocumentName("");
                                        }
                                      }}
                                      autoFocus
                                    />
                                    <Button
                                      onClick={() => handleRenameDocument(doc.id)}
                                      className="bg-white/20 text-white hover:bg-white/30 border border-white/40 h-8 px-2"
                                    >
                                      ✓
                                    </Button>
                                    <Button
                                      onClick={() => {
                                        setRenamingDocumentId(null);
                                        setRenamingDocumentName("");
                                      }}
                                      variant="ghost"
                                      className="text-white/80 hover:text-white hover:bg-white/20 h-8 px-2"
                                    >
                                      ✕
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <h3 className="mt-2 text-xl font-semibold text-white">
                                      {doc.fileName}
                                    </h3>
                                    <Link
                                      href={`/documents/${doc.id}`}
                                      className="mt-2 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white/90 transition"
                                    >
                                      Open study workspace <span aria-hidden>→</span>
                                    </Link>
                                  </>
                                )}
                              </div>
                            </div>
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
                            <div className="flex gap-2">
                              {renamingDocumentId !== doc.id && (
                                <Button
                                  onClick={(e: MouseEvent<HTMLButtonElement>) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setRenamingDocumentId(doc.id);
                                    setRenamingDocumentName(doc.fileName);
                                  }}
                                  className="rounded-lg border border-white/25 bg-white/15 px-3 py-2 text-sm text-white hover:bg-white/25"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                onClick={(e: MouseEvent<HTMLButtonElement>) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDelete(doc.id, doc.fileName);
                                }}
                                disabled={deleting === doc.id}
                                className="rounded-lg border border-white/25 bg-white/15 px-4 py-2 text-sm text-white hover:bg-white/25 disabled:opacity-60"
                              >
                                {deleting === doc.id ? "Deleting..." : "Delete"}
                              </Button>
                            </div>
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

      {/* YouTube Modal */}
      {showYouTubeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg mx-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-red-500/20 p-2.5">
                  <Youtube className="h-5 w-5 text-red-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">Add YouTube Video</h2>
              </div>
              <button
                onClick={() => {
                  setShowYouTubeModal(false);
                  setYoutubeUrl("");
                  setYoutubeVideoInfo(null);
                  setYoutubeError("");
                }}
                className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* URL Input */}
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  YouTube URL *
                </label>
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/10"
                />
              </div>

              {/* Loading State */}
              {youtubeValidating && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-white rounded-full" />
                  <span className="text-white/80">Validating video...</span>
                </div>
              )}

              {/* Error Message */}
              {youtubeError && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-red-300">{youtubeError}</span>
                </div>
              )}

              {/* Video Preview */}
              {youtubeVideoInfo && !youtubeValidating && (
                <div className="rounded-lg bg-white/5 border border-white/10 overflow-hidden">
                  <div className="flex gap-4 p-4">
                    {youtubeVideoInfo.thumbnail && (
                      <div className="shrink-0">
                        <Image
                          src={youtubeVideoInfo.thumbnail}
                          alt={youtubeVideoInfo.title}
                          width={160}
                          height={90}
                          className="rounded-lg object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white line-clamp-2">{youtubeVideoInfo.title}</h3>
                      <p className="text-sm text-white/60 mt-1">{youtubeVideoInfo.channelTitle}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-sm text-white/60">
                          <Clock className="h-4 w-4" />
                          {youtubeVideoInfo.durationFormatted}
                        </span>
                        {youtubeVideoInfo.isEducational ? (
                          <span className="flex items-center gap-1 text-sm text-green-400">
                            <CheckCircle className="h-4 w-4" />
                            Educational
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm text-yellow-400">
                            <AlertTriangle className="h-4 w-4" />
                            May not be educational
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Educational Warning */}
                  {!youtubeVideoInfo.isEducational && (
                    <div className="px-4 pb-4">
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                        <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-yellow-300">
                          This video may not be educational content. Study materials quality may be limited.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Usage Limits Info */}
              <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                <h4 className="text-sm font-medium text-white/80 mb-2">📋 Usage Limits</h4>
                <ul className="space-y-1 text-sm text-white/60">
                  <li>• 3 videos per day per user</li>
                  <li>• Maximum video length: 60 minutes</li>
                  <li>• Recommended: Educational lectures & tutorials</li>
                </ul>
                {youtubeVideoInfo && (
                  <p className="mt-3 text-sm font-medium text-indigo-400">
                    ⏱️ You have {youtubeVideoInfo.remaining} remaining today
                  </p>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 p-6 border-t border-white/10">
              <Button
                onClick={() => {
                  setShowYouTubeModal(false);
                  setYoutubeUrl("");
                  setYoutubeVideoInfo(null);
                  setYoutubeError("");
                }}
                className="rounded-lg border border-white/20 bg-transparent px-5 py-2.5 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleYouTubeSubmit}
                disabled={!youtubeVideoInfo || youtubeSubmitting || youtubeValidating}
                className="rounded-lg bg-red-500 px-5 py-2.5 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {youtubeSubmitting ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Youtube className="h-4 w-4" />
                    Add Video
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
