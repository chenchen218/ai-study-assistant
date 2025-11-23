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
import {
  BookOpen,
  Upload,
  FileText,
  Trash2,
  BarChart3,
  Settings,
  LogOut,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useToast } from "../components/ui/use-toast";
import { Skeleton } from "../components/ui/skeleton";

/**
 * Document interface representing a user's uploaded study material
 */
interface Document {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  uploadedAt: string;
}

/**
 * Dashboard page component - Main page for viewing and managing documents
 * Features:
 * - Document upload (PDF/DOCX)
 * - Document list with status indicators
 * - Document deletion
 * - Automatic processing status polling
 */
export default function DashboardPage() {
  const { user, logout } = useAuth();
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

  const clearPolling = useCallback(() => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);

  /**
   * Fetches all documents for the current user
   * @throws {Error} If the API request fails or returns an error
   */
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/documents");
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new Error(errorData.error || `Failed to fetch documents: ${response.statusText}`);
      }

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load documents. Please try again.";
      toast({
        title: "Error loading documents",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /**
   * Polls the document status to check if processing is complete
   * @param documentId - The ID of the document to poll
   * @throws {Error} If the API request fails
   */
  const pollDocumentStatus = useCallback(
    async (documentId: string) => {
      try {
        const response = await fetch(`/api/documents/${documentId}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            error: `HTTP ${response.status}: ${response.statusText}`,
          }));
          throw new Error(errorData.error || `Failed to check document status: ${response.statusText}`);
        }

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
          const errorMsg = "Document processing failed. Please try uploading again.";
          setError(errorMsg);
          toast({
            title: "Processing failed",
            description: errorMsg,
            variant: "destructive",
          });
          void fetchDocuments();
          return;
        }

        setProcessingStatus(
          "Processing your document. We'll open the study workspace as soon as it's ready."
        );
      } catch (error) {
        console.error("Error polling document status:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to check document status.";
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        clearPolling();
        setPendingDocumentId(null);
        setProcessingStatus("");
        return;
      }

      clearPolling();
      pollingTimeoutRef.current = setTimeout(() => {
        void pollDocumentStatus(documentId);
      }, 5000);
    },
    [clearPolling, fetchDocuments, router, toast]
  );

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    void fetchDocuments();

    return () => {
      clearPolling();
    };
  }, [user, router, fetchDocuments, clearPolling]);

  /**
   * Uploads a file to the server and initiates AI processing
   * @param file - The file to upload (PDF or DOCX)
   * @throws {Error} If the file is invalid or upload fails
   */
  const uploadFile = async (file: File) => {
    if (!file) return;
    setError("");
    
    // Validate file type
    if (file.type !== "application/pdf" && !file.name.endsWith(".docx")) {
      const errorMsg = "Only PDF and DOCX files are supported";
      setError(errorMsg);
      toast({
        title: "Invalid file type",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      const errorMsg = "File size must be less than 10MB";
      setError(errorMsg);
      toast({
        title: "File too large",
        description: errorMsg,
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
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        const errorMsg = errorData.error || `Upload failed: ${response.statusText}`;
        setError(errorMsg);
        toast({
          title: "Upload failed",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }

      const result = await response.json();
      toast({
        title: "Upload successful",
        description: "Your document is being processed. This may take a few moments.",
        variant: "success",
      });
      
      void fetchDocuments();
      const newlyCreatedId: string | undefined = result.document?.id;
      if (newlyCreatedId) {
        setPendingDocumentId(newlyCreatedId);
        setProcessingStatus(
          "Processing your document. We'll open the study workspace as soon as it's ready."
        );
        clearPolling();
        void pollDocumentStatus(newlyCreatedId);
      }
      setSelectedFileName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Upload error:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Upload failed. Please check your connection and try again.";
      setError(errorMessage);
      toast({
        title: "Upload error",
        description: errorMessage,
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

  /**
   * Deletes a document from the server
   * @param documentId - The ID of the document to delete
   * @param fileName - The name of the document (for confirmation)
   * @throws {Error} If the deletion fails
   */
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new Error(errorData.error || `Failed to delete document: ${response.statusText}`);
      }

      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
      if (pendingDocumentId === documentId) {
        setPendingDocumentId(null);
        setProcessingStatus("");
        clearPolling();
      }
      toast({
        title: "Document deleted",
        description: "The document has been successfully deleted.",
        variant: "success",
      });
    } catch (error) {
      console.error("Delete error:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to delete document. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case "processing":
        return <Clock className="w-4 h-4 text-warning" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  AI Study Assistant
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/analytics">
                <Button variant="ghost" size="sm" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Analytics</span>
                </Button>
              </Link>
              {user?.role === "admin" && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </Button>
                </Link>
              )}
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  {user?.name}
                </span>
                <Button
                  onClick={logout}
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-foreground">
            My Documents
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload and manage your study materials
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Upload Section */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Upload className="h-5 w-5" />
                  Upload Document
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!uploading) {
                      setIsDragging(true);
                    }
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
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
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {selectedFileName || "Drag file here"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF, DOCX up to 10MB
                    </p>
                  </div>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    size="sm"
                    className="w-full"
                  >
                    {uploading ? "Uploading..." : "Choose File"}
                  </Button>
                  {error && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                  {processingStatus && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-primary/10 p-3 text-xs text-primary">
                      <Clock className="h-4 w-4 shrink-0 mt-0.5 animate-spin" />
                      <span>{processingStatus}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Documents List */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-foreground">
                Documents ({documents.length})
              </h3>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : documents.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <FileText className="h-8 w-8 text-primary/60" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-foreground">
                    No documents yet
                  </h3>
                  <p className="mb-6 text-sm text-muted-foreground">
                    Upload your first document to start learning with AI-powered summaries, notes, flashcards, and quizzes.
                  </p>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    size="sm"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Document
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <Card
                    key={doc.id}
                    className="transition-shadow hover:shadow-md"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="flex-1 min-w-0 group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                              <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                                  {doc.fileName}
                                </h4>
                                <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                                  {doc.fileType.toUpperCase()}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>
                                  {new Date(doc.uploadedAt).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    }
                                  )}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  {getStatusIcon(doc.status)}
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusColor(
                                      doc.status
                                    )}`}
                                  >
                                    {doc.status}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </Link>
                        <Button
                          onClick={(e: MouseEvent<HTMLButtonElement>) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(doc.id, doc.fileName);
                          }}
                          disabled={deleting === doc.id}
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
