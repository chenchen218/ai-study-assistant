"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isVerified?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{
    success: boolean;
    error?: string;
    requiresVerification?: boolean;
  }>;
  googleLogin: (
    idToken: string
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    name: string
  ) => Promise<{
    success: boolean;
    error?: string;
    requiresVerification?: boolean;
    message?: string;
  }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const checkAuthWithTimeout = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          const data = await response.json();
          if (isMounted) setUser(data.user);
        } else {
          if (isMounted) setUser(null);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    checkAuthWithTimeout();

    // Fallback timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (isMounted) {
        console.warn("Auth check timeout - setting loading to false");
        setLoading(false);
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      const data = await response.json();
      setUser(data.user);
      router.push("/dashboard");
      return { success: true };
    } else {
      const error = await response.json();
      return {
        success: false,
        error: error.error,
        requiresVerification: error.requiresVerification,
      };
    }
  };

  const googleLogin = async (idToken: string) => {
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        router.push("/dashboard");
        return { success: true };
      }

      const error = await response.json();
      return { success: false, error: error.error };
    } catch (error) {
      console.error("Google login error:", error);
      return { success: false, error: "Google login failed" };
    }
  };

  const register = async (email: string, password: string, name: string) => {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    if (response.ok) {
      const data = await response.json();
      // Don't automatically log in - user needs to verify email first
      if (data.requiresVerification) {
        return {
          success: true,
          requiresVerification: true,
          message: data.message,
        };
      }
      setUser(data.user);
      router.push("/dashboard");
      return { success: true };
    } else {
      const error = await response.json();
      return { success: false, error: error.error };
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, googleLogin, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
