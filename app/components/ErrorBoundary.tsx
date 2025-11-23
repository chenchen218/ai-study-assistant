"use client";

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

/**
 * Error boundary state interface
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary props interface
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback component to render on error */
  fallback?: React.ComponentType<{ error: Error | null; resetError: () => void }>;
}

/**
 * React Error Boundary component to catch and handle errors in child components
 * Prevents the entire app from crashing when errors occur
 * Features:
 * - Catches JavaScript errors in child components
 * - Displays user-friendly error UI
 * - Provides error recovery options
 * - Logs errors for debugging
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="mb-4 flex items-center justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-center">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                {this.state.error?.message || "An unexpected error occurred. Please try again."}
              </p>
              <div className="flex gap-3">
                <Button onClick={this.resetError} className="flex-1" variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  onClick={() => (window.location.href = "/dashboard")}
                  className="flex-1"
                >
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

