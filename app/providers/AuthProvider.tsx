"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    name: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * React hook to access authentication context
 * Must be used within AuthProvider component
 * @returns Authentication context with user, loading state, and auth methods
 * @throws {Error} If used outside of AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

/**
 * Authentication provider component that manages user authentication state
 * Provides authentication context to all child components
 * Features:
 * - Automatic auth check on mount
 * - Login/register/logout functionality
 * - User state management
 * - Protected route handling
 */
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
        // Add a small delay to ensure cookies are set after OAuth redirect
        await new Promise((resolve) => setTimeout(resolve, 100));
        
        const response = await fetch("/api/auth/me", {
          credentials: "include", // Ensure cookies are sent
        });
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

  /**
   * Logs in a user with email and password
   * @param email - User's email address
   * @param password - User's password
   * @returns Promise with success status and optional error message
   * @throws {Error} If the API request fails
   */
  const login = async (email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        return { 
          success: false, 
          error: errorData.error || `Login failed: ${response.statusText}` 
        };
      }

      const data = await response.json();
      setUser(data.user);
      router.push("/dashboard");
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Network error. Please check your connection and try again.";
      return { success: false, error: errorMessage };
    }
  };

  /**
   * Registers a new user
   * @param email - User's email address
   * @param password - User's password (minimum 6 characters)
   * @param name - User's full name
   * @returns Promise with success status and optional error message
   * @throws {Error} If the API request fails
   */
  const register = async (email: string, password: string, name: string) => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        return { 
          success: false, 
          error: errorData.error || `Registration failed: ${response.statusText}` 
        };
      }

      const data = await response.json();
      setUser(data.user);
      router.push("/dashboard");
      return { success: true };
    } catch (error) {
      console.error("Registration error:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Network error. Please check your connection and try again.";
      return { success: false, error: errorMessage };
    }
  };

  /**
   * Logs out the current user
   * @throws {Error} If the logout request fails (non-blocking)
   */
  const logout = async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        console.warn("Logout API call failed, but continuing with local logout");
      }
    } catch (error) {
      console.error("Logout error:", error);
      // Continue with logout even if API call fails
    } finally {
      setUser(null);
      router.push("/");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
