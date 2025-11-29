"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [step, setStep] = useState<"email" | "reset">("email");

  /**
   * Sends password reset code
   */
  const handleSendCode = async () => {
    if (!email) {
      setError("Please enter your email address");
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
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send reset code");
        setSendingCode(false);
        return;
      }

      setSuccess(data.message || "Password reset code sent to your email!");
      setCodeSent(true);
      setStep("reset");
      setSendingCode(false);
    } catch (error: any) {
      console.error("Error sending reset code:", error);
      setError("Network error. Please try again.");
      setSendingCode(false);
    }
  };

  /**
   * Resets password
   */
  const handleResetPassword = async () => {
    if (!code || code.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to reset password");
        setLoading(false);
        return;
      }

      setSuccess("Password reset successfully! Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (error: any) {
      console.error("Error resetting password:", error);
      setError("Network error. Please try again.");
      setLoading(false);
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
          <div className="mb-4">
            <Button
              variant="ghost"
              onClick={() => router.push("/login")}
              className="text-white hover:bg-white/20 mb-2"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
            </Button>
          </div>

          <h1 className="text-2xl font-semibold text-center mb-5 text-white flex items-center justify-center gap-2">
            <Mail className="h-6 w-6" />
            Forgot Password
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

          {step === "email" ? (
            <div className="space-y-4">
              <p className="text-white/80 text-sm text-center">
                Enter your email address and we&apos;ll send you a code to reset your password.
              </p>
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
              <Button
                onClick={handleSendCode}
                disabled={sendingCode || !email}
                className="w-full bg-white/20 text-white hover:bg-white/30 border border-white/40"
              >
                {sendingCode ? "Sending..." : "Send Reset Code"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-white/80 text-sm text-center">
                Enter the 6-digit code sent to your email and your new password.
              </p>
              <div>
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-white/90 mb-1"
                >
                  Verification Code
                </label>
                <Input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30"
                />
              </div>
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-white/90 mb-1"
                >
                  New Password
                </label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30"
                />
              </div>
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-white/90 mb-1"
                >
                  Confirm New Password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30"
                />
              </div>
              <Button
                onClick={handleResetPassword}
                disabled={loading || !code || !newPassword || !confirmPassword}
                className="w-full bg-white/20 text-white hover:bg-white/30 border border-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setError("");
                  setSuccess("");
                }}
                className="w-full text-white/80 hover:bg-white/20"
              >
                Back to Email
              </Button>
            </div>
          )}

          <p className="mt-4 text-center text-sm text-white/90">
            Remember your password?{" "}
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

