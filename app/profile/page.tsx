"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { User, Mail, Trash2, ArrowLeft, Lock, Calendar, FileText, Clock, Award, Shield } from "lucide-react";

export default function ProfilePage() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [stats, setStats] = useState<{
    documentCount: number;
    totalStudyTime: number;
    quizCount: number;
    studyStreak: number;
  } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user) {
      router.push("/login");
      return;
    }
    setName(user.name);
    setEmail(user.email);
    fetchStats();
  }, [user, router, authLoading]);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/profile/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  if (authLoading) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="fixed inset-0 bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 animate-gradient" />
        <div className="relative z-10 flex min-h-screen items-center justify-center text-white">
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  /**
   * Sends verification code to new email
   */
  const handleSendCode = async () => {
    if (!newEmail) {
      setError("Please enter your new email first");
      return;
    }

    if (newEmail.toLowerCase() === email.toLowerCase()) {
      setError("New email must be different from current email");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
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
        body: JSON.stringify({ email: newEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send verification code");
        setSendingCode(false);
        return;
      }

      setSuccess("Verification code sent to your new email!");
      setCodeSent(true);
      setEmailVerified(false);
      setSendingCode(false);
    } catch (error: any) {
      console.error("Error sending verification code:", error);
      setError("Network error. Please try again.");
      setSendingCode(false);
    }
  };

  /**
   * Verifies the code for email change
   */
  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setError("");
    setSuccess("");
    setVerifyingCode(true);

    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, code: verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid verification code");
        setVerifyingCode(false);
        return;
      }

      setSuccess("Email verified successfully!");
      setEmailVerified(true);
      setVerifyingCode(false);
    } catch (error: any) {
      console.error("Error verifying code:", error);
      setError("Network error. Please try again.");
      setVerifyingCode(false);
    }
  };

  /**
   * Updates user's name
   */
  const handleUpdateName = async () => {
    if (!name || name.trim().length === 0) {
      setError("Name cannot be empty");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch("/api/profile/update-name", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update name");
        setLoading(false);
        return;
      }

      setSuccess("Name updated successfully!");
      setLoading(false);
      // Refresh user data
      window.location.reload();
    } catch (error: any) {
      console.error("Error updating name:", error);
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  /**
   * Updates user's email
   */
  const handleUpdateEmail = async () => {
    if (!emailVerified) {
      setError("Please verify your new email first");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch("/api/profile/update-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newEmail,
          verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update email");
        setLoading(false);
        return;
      }

      setSuccess("Email updated successfully!");
      setLoading(false);
      setNewEmail("");
      setVerificationCode("");
      setCodeSent(false);
      setEmailVerified(false);
      // Refresh user data
      window.location.reload();
    } catch (error: any) {
      console.error("Error updating email:", error);
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  /**
   * Changes user's password
   */
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All password fields are required");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setError("");
    setSuccess("");
    setChangingPassword(true);

    try {
      const response = await fetch("/api/profile/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to change password");
        setChangingPassword(false);
        return;
      }

      setSuccess("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangingPassword(false);
    } catch (error: any) {
      console.error("Error changing password:", error);
      setError("Network error. Please try again.");
      setChangingPassword(false);
    }
  };

  /**
   * Deletes user account
   */
  const handleDeleteAccount = async () => {
    // First click: show confirmation
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    // Second click: confirm deletion
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch("/api/profile/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to delete account");
        setLoading(false);
        return;
      }

      // Logout and redirect
      await logout();
      router.push("/");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 animate-gradient" />
      <div className="fixed top-20 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
      <div className="fixed top-40 right-20 w-72 h-72 bg-fuchsia-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
      <div className="fixed bottom-20 left-1/2 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />

      <div className="relative z-10 min-h-screen p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard")}
              className="text-white hover:bg-white/20 mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold text-white">User Profile</h1>
          </div>

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

          {/* Account Info & Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Account Info Card */}
            <Card className="bg-white/20 backdrop-blur-xl border-white/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/70">User Name:</span>
                  <span className="text-white font-medium">{user?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Account Type:</span>
                  <span className="text-white font-medium">
                    {user?.provider === "local" ? "Email" : user?.provider?.toUpperCase() || "Email"}
                  </span>
                </div>
                {user?.createdAt && (
                  <div className="flex justify-between">
                    <span className="text-white/70">Member Since:</span>
                    <span className="text-white font-medium">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white/70">Role:</span>
                  <span className="text-white font-medium capitalize">{user?.role}</span>
                </div>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card className="bg-white/20 backdrop-blur-xl border-white/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Your Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{stats.documentCount}</div>
                      <div className="text-xs text-white/70 mt-1">Documents</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">
                        {Math.round(stats.totalStudyTime / 60)}h
                      </div>
                      <div className="text-xs text-white/70 mt-1">Study Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{stats.quizCount}</div>
                      <div className="text-xs text-white/70 mt-1">Quizzes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{stats.studyStreak}</div>
                      <div className="text-xs text-white/70 mt-1">Day Streak</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-white/70 text-sm">Loading statistics...</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Update Name */}
          <Card className="mb-4 bg-white/20 backdrop-blur-xl border-white/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="h-5 w-5" />
                Update Name
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-1">
                  Name
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30"
                />
              </div>
              <Button
                onClick={handleUpdateName}
                disabled={loading || !name || name.trim() === user?.name}
                className="bg-white/20 text-white hover:bg-white/30 border border-white/40"
              >
                {loading ? "Updating..." : "Update Name"}
              </Button>
            </CardContent>
          </Card>

          {/* Update Email */}
          <Card className="mb-4 bg-white/20 backdrop-blur-xl border-white/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Update Email
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-1">
                  Current Email
                </label>
                <Input
                  type="email"
                  value={email}
                  disabled
                  className="bg-white/10 border-white/20 text-white/70"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/90 mb-1">
                  New Email
                </label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value);
                      setCodeSent(false);
                      setEmailVerified(false);
                    }}
                    placeholder="Enter new email"
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30 flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleSendCode}
                    disabled={sendingCode || emailVerified || !newEmail}
                    className="bg-white/20 text-white hover:bg-white/30 border border-white/40 whitespace-nowrap"
                  >
                    {sendingCode ? "Sending..." : codeSent ? "Resend" : "Send Code"}
                  </Button>
                </div>
              </div>
              {codeSent && !emailVerified && (
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1">
                    Verification Code
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30 flex-1"
                    />
                    <Button
                      type="button"
                      onClick={handleVerifyCode}
                      disabled={verifyingCode || verificationCode.length !== 6}
                      className="bg-white/20 text-white hover:bg-white/30 border border-white/40 whitespace-nowrap"
                    >
                      {verifyingCode ? "Verifying..." : "Verify"}
                    </Button>
                  </div>
                </div>
              )}
              {emailVerified && (
                <div className="bg-green-400/20 border border-green-300/50 text-green-50 px-4 py-2 rounded-lg text-sm">
                  ✓ Email verified
                </div>
              )}
              <Button
                onClick={handleUpdateEmail}
                disabled={loading || !emailVerified}
                className="bg-white/20 text-white hover:bg-white/30 border border-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Updating..." : "Update Email"}
              </Button>
            </CardContent>
          </Card>

          {/* Change Password (only for local accounts) */}
          {(!user?.provider || user.provider === "local" || user?.provider === undefined) && (
            <Card className="mb-4 bg-white/20 backdrop-blur-xl border-white/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Change Password
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1">
                    Current Password
                  </label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1">
                    New Password
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/90 mb-1">
                    Confirm New Password
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/30"
                  />
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="bg-white/20 text-white hover:bg-white/30 border border-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {changingPassword ? "Changing..." : "Change Password"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Delete Account */}
          <Card className="bg-red-500/20 backdrop-blur-xl border-red-300/30">
            <CardHeader>
              <CardTitle className="text-red-100 flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Delete Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-red-100/80 text-sm">
                Once you delete your account, there is no going back. All your data, documents, and progress will be permanently deleted.
              </p>
              {showDeleteConfirm && (
                <div className="bg-red-400/20 border border-red-300/50 text-red-100 px-4 py-3 rounded-lg">
                  <p className="font-semibold mb-1">⚠️ Are you sure?</p>
                  <p className="text-sm">This action cannot be undone. All your data will be permanently deleted.</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={handleDeleteAccount}
                  disabled={loading}
                  className="bg-red-500/50 text-white hover:bg-red-500/70 border border-red-300/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading
                    ? "Deleting..."
                    : showDeleteConfirm
                    ? "Confirm Delete Account"
                    : "Delete Account"}
                </Button>
                {showDeleteConfirm && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                    }}
                    className="text-red-100 hover:bg-red-500/30"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

