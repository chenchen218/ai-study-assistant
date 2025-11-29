"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

const handleOAuthLogin = (provider: "google" | "github") => {
  window.location.href = `/api/auth/oauth/${provider}`;
};

type Step = "info" | "verification";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("info");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const { register } = useAuth();

  /**
   * Step 1: Validates and sends verification code
   */
  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    if (!name || !email || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setError("");
    setSuccess("");
    setSendingCode(true);

    try {
      const response = await fetch("/api/auth/send-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send verification code");
        setSendingCode(false);
        return;
      }

      setSuccess("Verification code sent to your email!");
      setStep("verification");
      setSendingCode(false);
    } catch (error: any) {
      console.error("Error sending verification code:", error);
      setError("Network error. Please try again.");
      setSendingCode(false);
    }
  };

  /**
   * Step 2: Verifies code and completes registration
   */
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setError("");
    setSuccess("");
    setVerifyingCode(true);

    try {
      // First verify the code
      const verifyResponse = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: verificationCode }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        setError(verifyData.error || "Invalid verification code");
        setVerifyingCode(false);
        return;
      }

      // Code verified, now register
      setSuccess("Email verified! Creating your account...");
      setLoading(true);

      const result = await register(email, password, name);
      
      if (!result.success) {
        setError(result.error || "Registration failed");
        setLoading(false);
        setVerifyingCode(false);
        return;
      }

      // Registration successful, redirect to dashboard
      setSuccess("Registration successful! Redirecting...");
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (error: any) {
      console.error("Error during verification/registration:", error);
      setError("Network error. Please try again.");
      setVerifyingCode(false);
      setLoading(false);
    }
  };

  /**
   * Resends verification code
   */
  const handleResendCode = async () => {
    setError("");
    setSuccess("");
    setSendingCode(true);

    try {
      const response = await fetch("/api/auth/send-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send verification code");
        setSendingCode(false);
        return;
      }

      setSuccess("Verification code resent to your email!");
      setSendingCode(false);
    } catch (error: any) {
      console.error("Error sending verification code:", error);
      setError("Network error. Please try again.");
      setSendingCode(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      <div className="fixed inset-0 bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 animate-gradient" />
      <div className="fixed top-20 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
      <div className="fixed top-40 right-20 w-72 h-72 bg-fuchsia-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
      <div className="fixed bottom-20 left-1/2 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="border border-white/30 bg-white/20 p-6 rounded-3xl shadow-2xl backdrop-blur-xl">
          {step === "verification" && (
            <Button
              variant="ghost"
              onClick={() => {
                setStep("info");
                setVerificationCode("");
                setError("");
                setSuccess("");
              }}
              className="text-white hover:bg-white/20 mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}

          <h1 className="text-2xl font-semibold text-center mb-5 text-white flex items-center justify-center gap-2">
            {step === "verification" && <Mail className="h-6 w-6" />}
            {step === "info" ? "Create Account" : "Verify Email"}
          </h1>

          {error && (
            <div className="bg-red-400/30 border border-red-300/50 text-red-50 px-4 py-3 rounded-lg mb-4 backdrop-blur-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-400/30 border border-green-300/50 text-green-50 px-4 py-3 rounded-lg mb-4 backdrop-blur-sm">
              {success}
            </div>
          )}

          {step === "info" ? (
            <form onSubmit={handleContinue} className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-white/90 mb-1"
                >
                  Name
                </label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-white/90 mb-1"
                >
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-white/90 mb-1"
                >
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30"
                />
              </div>

              <Button
                type="submit"
                disabled={sendingCode || !name || !email || !password}
                className="w-full bg-white/20 text-white hover:bg-white/30 border border-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingCode ? "Sending Code..." : "Continue"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyAndRegister} className="space-y-4">
              <p className="text-white/80 text-sm text-center mb-4">
                We&apos;ve sent a 6-digit verification code to <strong>{email}</strong>. Please enter it below to complete your registration.
              </p>

              <div>
                <label
                  htmlFor="verificationCode"
                  className="block text-sm font-medium text-white/90 mb-1"
                >
                  Verification Code
                </label>
                <Input
                  id="verificationCode"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  required
                  autoFocus
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30 text-center text-2xl tracking-widest"
                />
              </div>

              <Button
                type="submit"
                disabled={loading || verifyingCode || verificationCode.length !== 6}
                className="w-full bg-white/20 text-white hover:bg-white/30 border border-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading || verifyingCode
                  ? "Creating Account..."
                  : "Create Account"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={handleResendCode}
                disabled={sendingCode}
                className="w-full text-white/80 hover:bg-white/20"
              >
                {sendingCode ? "Sending..." : "Resend Code"}
              </Button>
            </form>
          )}

          {step === "info" && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/30"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white/20 text-white/80">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  onClick={() => handleOAuthLogin("google")}
                  className="w-full bg-white/20 text-white hover:bg-white/30 border border-white/40 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Google
                </Button>
                <Button
                  type="button"
                  onClick={() => handleOAuthLogin("github")}
                  className="w-full bg-white/20 text-white hover:bg-white/30 border border-white/40 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  GitHub
                </Button>
              </div>
            </>
          )}

          <p className="mt-4 text-center text-sm text-white/90">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-white font-semibold hover:underline"
            >
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
