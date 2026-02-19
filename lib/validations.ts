/**
 * Zod Validation Schemas
 * 
 * Centralized validation schemas for all API endpoints.
 * Provides type-safe validation with clear error messages.
 */

import { z } from "zod";

// ==================== Common Schemas ====================

/**
 * Email validation schema
 * Validates email format and normalizes to lowercase
 */
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email format")
  .toLowerCase()
  .max(255, "Email is too long");

/**
 * Password validation schema
 * Minimum 8 characters for security
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password is too long");

/**
 * Name validation schema
 * 1-100 characters, trimmed
 */
export const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must be less than 100 characters")
  .trim();

/**
 * MongoDB ObjectId validation schema
 */
export const objectIdSchema = z
  .string()
  .min(1, "ID is required")
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ID format");

/**
 * File name validation schema
 */
export const fileNameSchema = z
  .string()
  .min(1, "File name is required")
  .max(255, "File name is too long")
  .trim();

// ==================== Auth Schemas ====================

/**
 * Registration request schema
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
});

/**
 * Login request schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

/**
 * Send verification code request schema
 */
export const sendVerificationCodeSchema = z.object({
  email: emailSchema,
});

/**
 * Verify code request schema
 */
export const verifyCodeSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .min(1, "Verification code is required")
    .regex(/^\d{6}$/, "Verification code must be 6 digits"),
});

/**
 * Forgot password request schema
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/**
 * Reset password request schema
 */
export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .min(1, "Verification code is required")
    .regex(/^\d{6}$/, "Verification code must be 6 digits"),
  newPassword: passwordSchema,
});

// ==================== Document Schemas ====================

/**
 * Document upload validation (for FormData)
 * Note: File validation happens in the route handler
 */
export const documentUploadSchema = z.object({
  // File is validated separately in route handler
  // This schema is for additional form fields if needed
});

/**
 * Document rename request schema
 */
export const documentRenameSchema = z.object({
  fileName: fileNameSchema,
});

/**
 * Document move request schema
 */
export const documentMoveSchema = z.object({
  folderId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid folder ID format")
    .optional()
    .nullable(),
});

// ==================== Q&A Schemas ====================

/**
 * Q&A request schema
 */
export const qaRequestSchema = z.object({
  documentId: objectIdSchema,
  question: z
    .string()
    .min(1, "Question is required")
    .max(500, "Question must be less than 500 characters")
    .trim(),
});

// ==================== YouTube Schemas ====================

/**
 * YouTube video ID validation
 */
const youtubeVideoIdSchema = z
  .string()
  .min(1, "Video ID is required")
  .regex(/^[a-zA-Z0-9_-]{11}$/, "Invalid YouTube video ID format");

/**
 * YouTube URL validation
 */
const youtubeUrlSchema = z
  .string()
  .min(1, "YouTube URL is required")
  .url("Invalid URL format")
  .refine(
    (url) => {
      const patterns = [
        /youtube\.com\/watch\?v=/,
        /youtu\.be\//,
        /youtube\.com\/embed\//,
        /youtube\.com\/v\//,
      ];
      return patterns.some((pattern) => pattern.test(url));
    },
    { message: "URL must be a valid YouTube video URL" }
  );

/**
 * YouTube validate request schema
 */
export const youtubeValidateSchema = z.object({
  url: youtubeUrlSchema,
});

/**
 * YouTube submit request schema
 */
export const youtubeSubmitSchema = z.object({
  videoId: youtubeVideoIdSchema,
  url: youtubeUrlSchema,
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  thumbnail: z.string().url("Invalid thumbnail URL").optional(),
  duration: z.number().int().positive().max(3600, "Video exceeds maximum duration").optional(),
  categoryId: z.string().optional(),
  isEducational: z.boolean().optional(),
});

// ==================== Flashcard Schemas ====================

/**
 * Flashcard verify answer request schema
 */
export const flashcardVerifySchema = z.object({
  flashcardId: objectIdSchema,
  userAnswer: z
    .string()
    .min(1, "Answer is required")
    .max(1000, "Answer is too long")
    .trim(),
});

// ==================== Profile Schemas ====================

/**
 * Update name request schema
 */
export const updateNameSchema = z.object({
  name: nameSchema,
});

/**
 * Update email request schema
 */
export const updateEmailSchema = z.object({
  email: emailSchema,
});

/**
 * Change password request schema
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

// ==================== Folder Schemas ====================

/**
 * Create folder request schema
 */
export const createFolderSchema = z.object({
  name: z
    .string()
    .min(1, "Folder name is required")
    .max(100, "Folder name must be less than 100 characters")
    .trim(),
  parentId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid parent folder ID format")
    .optional()
    .nullable(),
});

/**
 * Update folder request schema
 */
export const updateFolderSchema = z.object({
  name: z
    .string()
    .min(1, "Folder name is required")
    .max(100, "Folder name must be less than 100 characters")
    .trim(),
});

// ==================== Quiz Schemas ====================

/**
 * Regenerate quiz request schema
 */
export const regenerateQuizSchema = z.object({
  // No body needed, documentId comes from URL params
});

// ==================== Helper Functions ====================

/**
 * Validates request body against a Zod schema
 * Returns parsed data or throws formatted error
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format Zod errors into user-friendly messages
      const firstError = error.errors[0];
      throw new Error(
        firstError?.message || "Validation failed"
      );
    }
    throw error;
  }
}

/**
 * Validates request body and returns formatted error response
 * Use this in API routes for consistent error handling
 */
export function validateRequestWithError(
  schema: z.ZodSchema<any>,
  data: unknown
): { success: true; data: any } | { success: false; error: string; status: number } {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: firstError?.message || "Validation failed",
        status: 400,
      };
    }
    return {
      success: false,
      error: "Invalid request data",
      status: 400,
    };
  }
}
