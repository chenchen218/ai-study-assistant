"use client";

import { useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import Link from "next/link";
import { BookOpen, AlertCircle } from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await register(email, password, name);
    if (!result.success) {
      setError(result.error || "Registration failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            Create your account
          </h1>
          <p className="text-muted-foreground">
            Get started with AI-powered study assistance
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm p-8">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Registration failed</p>
                <p className="mt-1 text-destructive/80">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="name"
                className="text-sm font-medium text-foreground"
              >
                Full name
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                className="h-11"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-foreground"
              >
                Email address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="h-11"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                minLength={6}
                className="h-11"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 6 characters long
              </p>
            </div>

            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full h-11 text-base font-medium"
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:text-primary/90 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
