/**
 * Authentication Provider Component
 * 
 * This module provides React context for authentication state management throughout the application.
 * It handles user authentication, state management, and provides auth methods to all child components.
 * 
 * Features:
 * - Automatic authentication check on component mount
 * - Login/register/logout functionality
 * - User state management with React Context
 * - Protected route handling
 * - OAuth redirect support with cookie delay
 * - Loading state management
 * 
 * Architecture:
 * - Uses React Context API for global state management
 * - Provides useAuth() hook for easy access to auth state
 * - Wraps entire application in layout.tsx
 * - State persists across page navigations
 * 
 * Authentication Flow:
 * 1. On mount: Check if user is authenticated via /api/auth/me
 * 2. Login: POST /api/auth/login → Set JWT cookie → Redirect to /dashboard
 * 3. Register: POST /api/auth/register → Set JWT cookie → Redirect to /dashboard
 * 4. Logout: POST /api/auth/logout → Clear cookie → Redirect to /
 * 
 * Security:
 * - JWT tokens stored in httpOnly cookies (XSS protection)
 * - Automatic token validation on each auth check
 * - Credentials included in all API requests
 * 
 * @module app/providers/AuthProvider
 */

"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * User Interface
 * 
 * Represents a user in the application with all relevant information.
 */
interface User {
  id: string;                    // MongoDB ObjectId as string
  email: string;                 // User's email address
  name: string;                  // User's full name
  role: string;                  // User's role: "user" or "admin"
  provider?: "local" | "google" | "github"; // Authentication provider
  picture?: string;              // OAuth provider profile picture URL
  createdAt?: string;            // Account creation timestamp
}

/**
 * Authentication Context Type
 * 
 * Defines the shape of the authentication context that will be provided
 * to all components within the AuthProvider.
 */
interface AuthContextType {
  user: User | null;             // Current authenticated user (null if not logged in)
  loading: boolean;              // Whether auth check is in progress
  login: (                       // Login function
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  register: (                    // Registration function
    email: string,
    password: string,
    name: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;   // Logout function
}

// Create React Context for authentication
// This will be used to share auth state across all components
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * React hook to access authentication context
 * 
 * This hook provides easy access to authentication state and methods
 * from any component within the AuthProvider tree.
 * 
 * Usage:
 * ```tsx
 * const { user, loading, login, logout } = useAuth();
 * ```
 * 
 * @returns Authentication context with user, loading state, and auth methods
 * @throws {Error} If used outside of AuthProvider component
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

/**
 * Authentication Provider Component
 * 
 * Manages user authentication state and provides it to all child components
 * via React Context. This component should wrap the entire application.
 * 
 * State Management:
 * - user: Current authenticated user (null if not logged in)
 * - loading: Whether the initial auth check is in progress
 * 
 * Lifecycle:
 * 1. On mount: Automatically checks authentication status via /api/auth/me
 * 2. Sets loading to false after auth check completes (or timeout)
 * 3. Updates user state based on auth check result
 * 
 * OAuth Support:
 * - Includes 100ms delay after mount to ensure cookies are set after OAuth redirects
 * - This handles the case where OAuth providers redirect back with cookies
 * 
 * Timeout Protection:
 * - 5-second timeout to prevent infinite loading state
 * - If auth check takes too long, sets loading to false anyway
 * 
 * @param children - React children components that will have access to auth context
 */
export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // User state: null if not authenticated, User object if authenticated
  const [user, setUser] = useState<User | null>(null);
  
  // Loading state: true while checking authentication, false after check completes
  const [loading, setLoading] = useState(true);
  
  // Next.js router for navigation after login/logout
  const router = useRouter();

  // Effect hook runs once on component mount
  // Checks authentication status and populates user state
  useEffect(() => {
    // Flag to track if component is still mounted
    // Prevents state updates after component unmounts
    let isMounted = true;

    const checkAuthWithTimeout = async () => {
      try {
        // Add a small delay to ensure cookies are set after OAuth redirect
        // OAuth providers (Google, GitHub) redirect back with cookies
        // This delay ensures cookies are available before checking auth
        await new Promise((resolve) => setTimeout(resolve, 100));
        
        // Check authentication status by calling /api/auth/me
        // This endpoint reads the JWT token from httpOnly cookie
        // credentials: "include" ensures cookies are sent with the request
        const response = await fetch("/api/auth/me", {
          credentials: "include", // Include cookies for authentication
        });
        
        if (response.ok) {
          // User is authenticated - extract user data from response
          const data = await response.json();
          if (isMounted) setUser(data.user);
        } else {
          // User is not authenticated (401 Unauthorized)
          if (isMounted) setUser(null);
        }
      } catch (error) {
        // Network error or other error during auth check
        console.error("Auth check error:", error);
        if (isMounted) setUser(null);
      } finally {
        // Always set loading to false after auth check completes
        if (isMounted) setLoading(false);
      }
    };

    // Start authentication check
    checkAuthWithTimeout();

    // Fallback timeout to prevent infinite loading state
    // If auth check takes more than 5 seconds, set loading to false anyway
    // This prevents the app from being stuck in loading state
    const timeout = setTimeout(() => {
      if (isMounted) {
        console.warn("Auth check timeout - setting loading to false");
        setLoading(false);
      }
    }, 5000);

    // Cleanup function: runs when component unmounts
    // Prevents memory leaks and state updates on unmounted components
    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, []); // Empty dependency array means this effect runs only once on mount

  /**
   * Logs in a user with email and password
   * 
   * Sends login credentials to the server, receives JWT token in httpOnly cookie,
   * updates user state, and redirects to dashboard.
   * 
   * Flow:
   * 1. POST request to /api/auth/login with email and password
   * 2. Server validates credentials and sets JWT cookie
   * 3. Update user state with returned user data
   * 4. Redirect to /dashboard
   * 
   * Error Handling:
   * - Returns success: false with error message if login fails
   * - Handles network errors gracefully
   * - Provides user-friendly error messages
   * 
   * @param email - User's email address
   * @param password - User's plaintext password
   * @returns Promise with success status and optional error message
   */
  const login = async (email: string, password: string) => {
    try {
      // Send login request to server
      // Server will validate credentials and set JWT cookie
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      // Handle error responses
      if (!response.ok) {
        // Try to extract error message from response
        // Fall back to HTTP status if JSON parsing fails
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        return { 
          success: false, 
          error: errorData.error || `Login failed: ${response.statusText}` 
        };
      }

      // Login successful - extract user data from response
      // JWT cookie is automatically set by server (httpOnly cookie)
      const data = await response.json();
      
      // Update user state with authenticated user data
      setUser(data.user);
      
      // Redirect to dashboard after successful login
      router.push("/dashboard");
      
      return { success: true };
    } catch (error) {
      // Handle network errors or other exceptions
      console.error("Login error:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Network error. Please check your connection and try again.";
      return { success: false, error: errorMessage };
    }
  };

  /**
   * Registers a new user account
   * 
   * Creates a new user account, receives JWT token in httpOnly cookie,
   * updates user state, and redirects to dashboard.
   * 
   * Flow:
   * 1. POST request to /api/auth/register with email, password, and name
   * 2. Server validates input, hashes password, creates user, sets JWT cookie
   * 3. Update user state with new user data
   * 4. Redirect to /dashboard (auto-login after registration)
   * 
   * Requirements:
   * - Email must be verified before registration
   * - Password must be at least 8 characters
   * - Email must not already exist
   * 
   * Error Handling:
   * - Returns success: false with error message if registration fails
   * - Handles network errors gracefully
   * - Provides user-friendly error messages
   * 
   * @param email - User's email address (must be verified)
   * @param password - User's plaintext password (minimum 8 characters)
   * @param name - User's full name
   * @returns Promise with success status and optional error message
   */
  const register = async (email: string, password: string, name: string) => {
    try {
      // Send registration request to server
      // Server will validate input, create user, and set JWT cookie
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      // Handle error responses
      if (!response.ok) {
        // Try to extract error message from response
        // Fall back to HTTP status if JSON parsing fails
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        return { 
          success: false, 
          error: errorData.error || `Registration failed: ${response.statusText}` 
        };
      }

      // Registration successful - extract user data from response
      // JWT cookie is automatically set by server (httpOnly cookie)
      const data = await response.json();
      
      // Update user state with new user data
      setUser(data.user);
      
      // Redirect to dashboard after successful registration (auto-login)
      router.push("/dashboard");
      
      return { success: true };
    } catch (error) {
      // Handle network errors or other exceptions
      console.error("Registration error:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Network error. Please check your connection and try again.";
      return { success: false, error: errorMessage };
    }
  };

  /**
   * Logs out the current user
   * 
   * Clears the JWT cookie on the server, clears user state locally,
   * and redirects to home page.
   * 
   * Flow:
   * 1. POST request to /api/auth/logout to clear server-side cookie
   * 2. Clear user state locally (even if API call fails)
   * 3. Redirect to home page (/)
   * 
   * Error Handling:
   * - Logout proceeds even if API call fails (non-blocking)
   * - This ensures user can always log out, even with network issues
   * - Local state is always cleared
   */
  const logout = async () => {
    try {
      // Send logout request to server
      // Server will clear the JWT cookie
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        // Log warning but continue with logout
        // This ensures logout works even if server is unavailable
        console.warn("Logout API call failed, but continuing with local logout");
      }
    } catch (error) {
      // Log error but continue with logout
      // This ensures logout always works, even with network errors
      console.error("Logout error:", error);
    } finally {
      // Always clear user state and redirect, regardless of API call result
      // This ensures the user is logged out locally even if server call fails
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
