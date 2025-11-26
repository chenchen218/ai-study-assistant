"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../providers/AuthProvider";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { login, googleLogin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const verified = searchParams.get("verified");
    const errorParam = searchParams.get("error");

    if (verified === "true") {
      setSuccess("Email verified successfully! You can now log in.");
    }
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const result = await login(email, password);
    if (!result.success) {
      setError(result.error || "Login failed");
      // If verification is required, show resend option
      if (result.requiresVerification) {
        setError(
          result.error +
            " Click 'Resend Verification Email' below if you need a new link."
        );
      }
    }
    setLoading(false);
  };

  const handleResendVerification = async () => {
    if (!email) {
      setError("Please enter your email address first");
      return;
    }

    setResending(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess(
          data.message || "Verification email sent! Please check your inbox."
        );
      } else {
        setError(data.error || "Failed to resend verification email");
      }
    } catch (error) {
      setError("Failed to resend verification email. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const handleGoogleSuccess = async (
    credentialResponse: CredentialResponse
  ) => {
    if (!credentialResponse.credential) {
      setError("Google login failed: No credential returned");
      return;
    }

    setError("");
    setLoading(true);

    const result = await googleLogin(credentialResponse.credential);
    if (!result.success) {
      setError(result.error || "Google login failed");
    }

    setLoading(false);
  };

  const handleGoogleError = () => {
    setError("Google login failed. Please try again.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
          AI Study Assistant
        </h1>
        <h2 className="text-xl font-semibold text-center mb-6 text-gray-600">
          Login
        </h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>

        {error && error.includes("verify your email") && (
          <div className="mt-4">
            <Button
              type="button"
              onClick={handleResendVerification}
              disabled={resending || !email}
              variant="outline"
              className="w-full"
            >
              {resending ? "Sending..." : "Resend Verification Email"}
            </Button>
          </div>
        )}

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                Or continue with
              </span>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap
              theme="outline"
              size="large"
              text="signin_with"
            />
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
