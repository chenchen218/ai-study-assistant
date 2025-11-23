import { NextRequest, NextResponse } from "next/server";

/**
 * Configuration options for rate limiting
 */
interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum number of requests allowed per window */
  maxRequests: number;
}

// In-memory store for rate limiting (use Redis in production)
const requestStore = new Map<string, { count: number; resetTime: number }>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestStore.entries()) {
    if (now > value.resetTime) {
      requestStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Creates a rate limiting middleware function
 * Uses in-memory storage (consider Redis for production)
 * @param options - Rate limit configuration (window time and max requests)
 * @returns Middleware function that returns null if allowed, or 429 response if rate limited
 */
export function rateLimit(options: RateLimitOptions) {
  return (request: NextRequest): NextResponse | null => {
    // Get client identifier (IP address or user ID)
    const clientId =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      request.ip ||
      "unknown";

    const now = Date.now();
    const windowStart = now - options.windowMs;

    // Get or create rate limit entry
    let entry = requestStore.get(clientId);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired one
      entry = {
        count: 1,
        resetTime: now + options.windowMs,
      };
      requestStore.set(clientId, entry);
      return null; // Allow request
    }

    // Increment count
    entry.count++;

    if (entry.count > options.maxRequests) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      return NextResponse.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": options.maxRequests.toString(),
            "X-RateLimit-Remaining": Math.max(0, options.maxRequests - entry.count).toString(),
            "X-RateLimit-Reset": new Date(entry.resetTime).toISOString(),
          },
        }
      );
    }

    // Update entry
    requestStore.set(clientId, entry);
    return null; // Allow request
  };
}

/**
 * Predefined rate limiters for different API endpoints
 * - auth: Strict limit for authentication (5 requests per 15 minutes)
 * - documents: Moderate limit for document operations (10 requests per minute)
 * - qa: Lenient limit for Q&A endpoints (20 requests per minute)
 * - api: General API rate limit (30 requests per minute)
 */
export const rateLimiters = {
  /** Strict rate limit for authentication endpoints - 5 requests per 15 minutes */
  auth: rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 5 }),

  /** Moderate rate limit for document operations - 10 requests per minute */
  documents: rateLimit({ windowMs: 60 * 1000, maxRequests: 10 }),

  /** Lenient rate limit for Q&A endpoints - 20 requests per minute */
  qa: rateLimit({ windowMs: 60 * 1000, maxRequests: 20 }),

  /** General API rate limit - 30 requests per minute */
  api: rateLimit({ windowMs: 60 * 1000, maxRequests: 30 }),
};

