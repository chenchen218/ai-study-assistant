/**
 * AI Content Generation Module
 *
 * This module provides functions for generating educational content using Google's Gemini AI.
 * It handles all AI-powered features including summaries, notes, flashcards, and quiz questions.
 *
 * Features:
 * - Automatic model selection with fallback support
 * - Model caching for performance
 * - Error handling and graceful degradation
 * - JSON parsing with fallback strategies
 *
 * Model Selection:
 * The system tries multiple Gemini models in order of preference and caches the first working one.
 * This ensures compatibility even when Google updates model names or availability.
 *
 * Content Generation:
 * - Summary: Comprehensive document overview
 * - Notes: Detailed study notes with markdown formatting
 * - Flashcards: Interactive Q&A cards for practice
 * - Quiz Questions: Multiple-choice questions with explanations
 * - Q&A: Contextual answers to user questions
 *
 * @module lib/ai
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  calculateAICost,
  estimateTokens,
  logAICost,
  getTokenUsage,
} from "./ai-cost";

// Get Gemini API key from environment variables
// This key is required for all AI features
const apiKey = process.env.GEMINI_API_KEY || "";

if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in environment variables");
}

// Initialize Google Generative AI client
const genAI = new GoogleGenerativeAI(apiKey);

// Cache for the working model name
// This avoids repeated API calls to test model availability
// Once a working model is found, it's reused for all subsequent requests
let cachedWorkingModel: string | null = null;

/**
 * Gets a working Gemini AI model by trying multiple model names in order
 *
 * This function implements a fallback strategy to ensure compatibility:
 * 1. Check if we have a cached working model (use it if available)
 * 2. Try models in order of preference (latest → stable → experimental)
 * 3. Test each model with a simple API call
 * 4. Cache the first working model for future use
 * 5. Throw error if no models work
 *
 * Why this approach?
 * - Google frequently updates model names and availability
 * - Different regions may have different model availability
 * - Caching reduces API calls and improves performance
 *
 * @returns Promise resolving to a configured Gemini model instance
 * @throws {Error} If no working model is found after trying all options
 */
const getModel = async (): Promise<any> => {
  // If we have a cached working model, use it immediately
  // This avoids unnecessary API calls
  if (cachedWorkingModel) {
    return genAI.getGenerativeModel({ model: cachedWorkingModel });
  }

  // Try models in order: latest stable, then alternatives
  // Order matters: we prefer newer, more capable models first
  const modelsToTry = [
    "models/gemini-2.5-flash-preview-05-20", // Latest preview version
    "models/gemini-2.5-flash", // Stable version
    "models/gemini-2.0-flash-exp", // Experimental but available
    "models/gemini-flash-latest", // Latest alias (may change)
    "models/gemini-2.0-flash", // Alternative stable version
  ];

  // Try each model until one works
  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      // Test if it works with a simple API call
      // This validates the model is available and API key is valid
      const testResult = await model.generateContent("test");
      await testResult.response;
      // If we get here, the model works
      cachedWorkingModel = modelName;
      console.log(`✅ Using working model: ${modelName}`);
      return model;
    } catch (err: any) {
      // Model not available or API error - try next model
      continue;
    }
  }

  // If all models fail, throw an error
  // This indicates either API key is invalid or all models are unavailable
  throw new Error(
    "No working Gemini model found. Please check your API key and model availability."
  );
};

/**
 * Generates a comprehensive summary of educational content using AI
 *
 * Creates a well-structured summary that captures all key concepts and main points
 * from the provided educational content. The summary is designed to help students
 * quickly understand the document's main ideas.
 *
 * Summary Characteristics:
 * - Concise but comprehensive
 * - Well-structured with clear organization
 * - Captures all key concepts and main points
 * - Suitable for quick review and understanding
 *
 * @param content - The text content to summarize (should be under 10,000 characters)
 * @param userId - Optional user ID for cost tracking
 * @param documentId - Optional document ID for cost tracking
 * @returns Promise resolving to the generated summary text
 * @throws {Error} If API key is missing or AI generation fails
 */
export async function generateSummary(
  content: string,
  userId?: string,
  documentId?: string
): Promise<string> {
  // Construct prompt for AI model
  // The prompt instructs the AI to act as an expert summarizer
  // and create a comprehensive, well-structured summary
  const prompt = `You are an expert at creating concise, comprehensive summaries of educational content. Create a well-structured summary that captures all key concepts and main points.

Please create a comprehensive summary of the following content:

${content}`;

  try {
    // Validate API key is configured
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    // Get working AI model (with caching and fallback)
    const model = await getModel();
    // Generate content using AI model
    const result = await model.generateContent(prompt);
    const response = await result.response;
    // Extract and return generated text
    return response.text() || "";
  } catch (error: any) {
    // Log error for debugging
    console.error("Error generating summary:", error);
    console.error("Error details:", error?.message || error);
    // Re-throw error so caller can handle it
    throw error;
  }
}

/**
 * Generates detailed study notes from educational content using AI
 *
 * Creates well-organized study notes with markdown formatting, including:
 * - Clear section headings
 * - Bullet points for key information
 * - Highlighted key concepts
 * - Structured organization for easy review
 *
 * Notes Format:
 * - Uses markdown formatting (headings, lists, emphasis)
 * - Organized into logical sections
 * - Suitable for both reading and editing
 * - Can be exported to various formats
 *
 * @param content - The text content to create notes from (should be under 10,000 characters)
 * @param userId - Optional user ID for cost tracking
 * @param documentId - Optional document ID for cost tracking
 * @returns Promise resolving to markdown-formatted study notes
 * @throws {Error} If API key is missing or AI generation fails
 */
export async function generateNotes(
  content: string,
  userId?: string,
  documentId?: string
): Promise<string> {
  // Construct prompt for AI model
  // The prompt instructs the AI to create detailed, well-organized study notes
  // with markdown formatting for structure
  const prompt = `You are an expert at creating detailed study notes. Organize the content into clear sections with headings, bullet points, and key concepts highlighted. Use markdown formatting for structure.

Please create detailed study notes from the following content:

${content}`;

  try {
    // Validate API key is configured
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    // Get working AI model (with caching and fallback)
    const model = await getModel();
    const modelName = cachedWorkingModel || "models/gemini-2.5-flash";

    // Estimate input tokens
    const estimatedInputTokens = estimateTokens(prompt);

    // Generate content using AI model
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text() || "";

    // Get token usage and track cost
    const usage = getTokenUsage(response);
    const inputTokens = usage.inputTokens || estimatedInputTokens;
    const outputTokens = usage.outputTokens || estimateTokens(text);

    // Log cost for monitoring
    logAICost({
      model: modelName,
      inputTokens,
      outputTokens,
      operation: "generateNotes",
      userId,
      documentId,
    });

    // Extract and return generated text
    return text;
  } catch (error: any) {
    // Log error for debugging
    console.error("Error generating notes:", error);
    console.error("Error details:", error?.message || error);
    // Re-throw error so caller can handle it
    throw error;
  }
}

/**
 * Generates flashcards from educational content using AI
 *
 * Creates interactive Q&A flashcards that help students memorize key concepts
 * through active recall. Each flashcard has a question and answer pair.
 *
 * Flashcard Focus Areas:
 * - Key concepts, theories, definitions, and principles
 * - Important facts, formulas, and relationships
 * - Critical thinking questions about the material
 * - Academic terminology and technical terms
 *
 * What to Avoid:
 * - Personal names (unless central to the concept)
 * - Trivial details like dates without context
 * - Non-academic information
 * - Questions that don't test understanding
 *
 * JSON Parsing:
 * The function includes robust JSON parsing with multiple fallback strategies:
 * 1. Direct JSON parsing
 * 2. Handle different response structures (array, object with flashcards/cards property)
 * 3. Extract JSON from markdown code blocks
 * 4. Extract JSON array using regex
 * 5. Return empty array if all parsing fails (graceful degradation)
 *
 * @param content - The text content to create flashcards from (should be under 10,000 characters)
 * @param count - Number of flashcards to generate (default: 10)
 * @param userId - Optional user ID for cost tracking
 * @param documentId - Optional document ID for cost tracking
 * @returns Promise resolving to an array of flashcard objects with question and answer
 * @throws {Error} If API key is missing (returns empty array on parse errors for graceful degradation)
 */
export async function generateFlashcards(
  content: string,
  count: number = 10,
  userId?: string,
  documentId?: string
): Promise<Array<{ question: string; answer: string }>> {
  // Construct prompt for AI model
  // The prompt instructs the AI to create educational flashcards focused on academic content
  // It specifies the exact format (JSON array) and what to include/avoid
  const prompt = `You are an expert at creating educational flashcards for academic study. Generate exactly ${count} flashcards that focus on:
- Key concepts, theories, definitions, and principles
- Important facts, formulas, and relationships
- Critical thinking questions about the material
- Academic terminology and technical terms

AVOID creating flashcards about:
- Personal names (teachers, authors, etc.) unless they are central to the concept
- Trivial details like dates without context
- Non-academic information
- Questions that don't test understanding

Focus on questions that help students understand and remember the core academic content.

IMPORTANT: Return the response as a valid JSON array of objects. Each object must have exactly two fields: "question" and "answer". Do not include any markdown formatting, code blocks, or extra text - only return the JSON array.

Example format:
[
  {"question": "What is the definition of X?", "answer": "X is a concept that..."},
  {"question": "What are the key principles of Y?", "answer": "The key principles of Y are..."}
]

Please create ${count} academic flashcards from the following content:

${content}`;

  try {
    // Validate API key is configured
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    // Get working AI model (with caching and fallback)
    const model = await getModel();
    const modelName = cachedWorkingModel || "models/gemini-2.5-flash";

    // Estimate input tokens
    const estimatedInputTokens = estimateTokens(prompt);

    // Generate content using AI model
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Get token usage and track cost
    const usage = getTokenUsage(response);
    const inputTokens = usage.inputTokens || estimatedInputTokens;
    const outputTokens = usage.outputTokens || estimateTokens(text);

    // Log cost for monitoring
    logAICost({
      model: modelName,
      inputTokens,
      outputTokens,
      operation: "generateFlashcards",
      userId,
      documentId,
    });

    // Extract JSON from response (might be wrapped in markdown code blocks)
    // AI models sometimes wrap JSON in markdown code blocks, so we need to clean it
    let jsonText = text.trim();

    // Remove markdown code blocks if present
    // Handles both ```json and ``` code block formats
    jsonText = jsonText.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    jsonText = jsonText.trim();

    // Try to parse the JSON with multiple fallback strategies
    try {
      const parsed = JSON.parse(jsonText);
      // Handle different possible response structures
      // AI might return: array directly, object with flashcards property, or object with cards property
      if (Array.isArray(parsed)) {
        return parsed.slice(0, count); // Limit to requested count
      } else if (parsed.flashcards && Array.isArray(parsed.flashcards)) {
        return parsed.flashcards.slice(0, count);
      } else if (parsed.cards && Array.isArray(parsed.cards)) {
        return parsed.cards.slice(0, count);
      }
      return []; // Unknown structure, return empty array
    } catch (parseError) {
      console.error("Error parsing flashcards JSON:", parseError);
      // Fallback: Try to extract JSON array from text using regex
      // This handles cases where AI returns text with JSON embedded
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]).slice(0, count);
        } catch {
          return []; // Parsing failed, return empty array
        }
      }
      return []; // No JSON found, return empty array (graceful degradation)
    }
  } catch (error) {
    // Log error but return empty array instead of throwing
    // This allows the document upload to succeed even if flashcard generation fails
    console.error("Error generating flashcards:", error);
    return []; // Graceful degradation - return empty array
  }
}

/**
 * Generates multiple-choice quiz questions from educational content using AI
 * @param content - The text content to create questions from (should be under 10,000 characters)
 * @param count - Number of questions to generate (default: 5)
 * @param previousQuestions - Optional text containing previously generated questions to avoid duplicates
 * @param userId - Optional user ID for cost tracking
 * @param documentId - Optional document ID for cost tracking
 * @returns Promise resolving to an array of quiz question objects
 * @throws {Error} If API key is missing or AI generation fails (returns empty array on parse errors)
 */
export async function generateQuizQuestions(
  content: string,
  count: number = 5,
  previousQuestions?: string | null,
  userId?: string,
  documentId?: string
): Promise<
  Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  }>
> {
  const avoidDuplicatesSection = previousQuestions
    ? `\n\nIMPORTANT: The following questions have already been generated for this document. DO NOT create questions that are similar or identical to these:\n\n${previousQuestions}\n\nCreate completely new and different questions that test different aspects of the content.`
    : "";

  const prompt = `You are an expert at creating academic quiz questions. Generate exactly ${count} multiple-choice questions that focus on:
- Key concepts, theories, definitions, and principles
- Important facts, formulas, and relationships
- Critical thinking and application questions
- Academic terminology and technical understanding

AVOID creating questions about:
- Personal names (teachers, authors, etc.) unless they are central to the concept
- Trivial details like dates without context
- Non-academic information
- Questions that don't test understanding

Focus on questions that test students' understanding of the core academic content. Each question should have one clearly correct answer and three plausible but incorrect distractors.

IMPORTANT: Return the response as a valid JSON object with a "questions" array. Each question must have:
- "question": string
- "options": array of exactly 4 strings
- "correctAnswer": number (0-3 index indicating the correct option)
- "explanation": string (optional but recommended)

Do not include any markdown formatting, code blocks, or extra text - only return the JSON object.

Example format:
{
  "questions": [
    {
      "question": "What is the primary definition of X?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "X is correct because..."
    }
  ]
}

Please create ${count} academic quiz questions from the following content:${avoidDuplicatesSection}

${content}`;

  try {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    const model = await getModel();
    const modelName = cachedWorkingModel || "models/gemini-2.5-flash";

    // Estimate input tokens
    const estimatedInputTokens = estimateTokens(prompt);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Get token usage and track cost
    const usage = getTokenUsage(response);
    const inputTokens = usage.inputTokens || estimatedInputTokens;
    const outputTokens = usage.outputTokens || estimateTokens(text);

    // Log cost for monitoring
    logAICost({
      model: modelName,
      inputTokens,
      outputTokens,
      operation: "generateQuizQuestions",
      userId,
      documentId,
    });

    // Extract JSON from response
    let jsonText = text.trim();
    jsonText = jsonText.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    jsonText = jsonText.trim();

    try {
      const parsed = JSON.parse(jsonText);
      const questions = parsed.questions || parsed.quiz || [];
      return questions.slice(0, count);
    } catch (parseError) {
      console.error("Error parsing quiz JSON:", parseError);
      // Try to extract JSON from text
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return (parsed.questions || parsed.quiz || []).slice(0, count);
        } catch {
          return [];
        }
      }
      return [];
    }
  } catch (error) {
    console.error("Error generating quiz questions:", error);
    return [];
  }
}

/**
 * Verifies if a user's answer to a flashcard question is correct
 *
 * Uses AI to evaluate semantic similarity and correctness of user's answer.
 * This provides intelligent feedback beyond simple string matching.
 *
 * Evaluation Criteria:
 * - Semantic similarity: Does the answer convey the same meaning?
 * - Key concepts: Does the answer demonstrate understanding?
 * - Completeness: Is the answer sufficiently complete?
 * - Accuracy: Are there any factual errors?
 *
 * Leniency:
 * - Different wording that conveys the same meaning
 * - Minor grammatical differences
 * - Partial answers that show understanding
 *
 * Strictness:
 * - Factual errors
 * - Completely incorrect answers
 * - Answers that show no understanding
 *
 * Fallback Strategy:
 * If AI parsing fails, falls back to keyword matching (50% threshold).
 * This ensures the feature works even if AI response format is unexpected.
 *
 * @param question - The flashcard question
 * @param correctAnswer - The correct answer from the flashcard
 * @param userAnswer - The user's input answer to verify
 * @param userId - Optional user ID for cost tracking
 * @param documentId - Optional document ID for cost tracking
 * @returns Promise resolving to an object with isCorrect boolean and feedback string
 * @throws {Error} If API key is missing or AI generation fails
 */
export async function verifyFlashcardAnswer(
  question: string,
  correctAnswer: string,
  userAnswer: string,
  userId?: string,
  documentId?: string
): Promise<{ isCorrect: boolean; feedback: string }> {
  const prompt = `You are an expert at evaluating student answers to academic questions. Your task is to determine if a student's answer is correct based on the expected answer.

Question: ${question}
Expected Answer: ${correctAnswer}
Student's Answer: ${userAnswer}

Evaluate the student's answer considering:
1. Semantic similarity - does the student's answer convey the same meaning as the expected answer?
2. Key concepts - does the student demonstrate understanding of the core concepts?
3. Completeness - is the answer sufficiently complete (minor omissions are acceptable)?
4. Accuracy - are there any factual errors?

Be lenient with:
- Different wording that conveys the same meaning
- Minor grammatical differences
- Partial answers that show understanding

Be strict with:
- Factual errors
- Completely incorrect answers
- Answers that show no understanding

Respond with a JSON object in this exact format:
{
  "isCorrect": true or false,
  "feedback": "Brief explanation (maximum 2 sentences) of why the answer is correct or incorrect"
}

IMPORTANT: 
- Keep feedback concise and under 100 words
- Return ONLY the JSON object, no markdown, no code blocks, no additional text.`;

  try {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    const model = await getModel();
    const modelName = cachedWorkingModel || "models/gemini-2.5-flash";

    // Estimate input tokens
    const estimatedInputTokens = estimateTokens(prompt);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    // Get token usage and track cost
    const usage = getTokenUsage(response);
    const inputTokens = usage.inputTokens || estimatedInputTokens;
    const outputTokens = usage.outputTokens || estimateTokens(text);

    // Log cost for monitoring
    logAICost({
      model: modelName,
      inputTokens,
      outputTokens,
      operation: "verifyFlashcardAnswer",
      userId,
      documentId,
    });

    // Extract JSON from response
    let jsonText = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    try {
      const parsed = JSON.parse(jsonText);
      return {
        isCorrect: parsed.isCorrect === true,
        feedback:
          parsed.feedback ||
          (parsed.isCorrect
            ? "Correct!"
            : "Incorrect. Please review the answer."),
      };
    } catch (parseError) {
      console.error("Error parsing verification JSON:", parseError);
      // Fallback: simple keyword matching
      const userLower = userAnswer.toLowerCase();
      const correctLower = correctAnswer.toLowerCase();
      const keyWords = correctLower
        .split(/\s+/)
        .filter((w: string) => w.length > 3);
      const matches = keyWords.filter((word: string) =>
        userLower.includes(word)
      ).length;
      const isCorrect = matches >= keyWords.length * 0.5; // At least 50% keyword match

      return {
        isCorrect,
        feedback: isCorrect
          ? "Your answer appears to be correct based on keyword matching."
          : "Your answer doesn't seem to match. Please review the correct answer.",
      };
    }
  } catch (error: any) {
    console.error("Error verifying flashcard answer:", error);
    throw new Error(`Failed to verify answer: ${error.message}`);
  }
}

/**
 * Answers a user's question about document content using AI
 * @param content - The document content to use as context
 * @param question - The user's question to answer
 * @param userId - Optional user ID for cost tracking
 * @param documentId - Optional document ID for cost tracking
 * @returns Promise resolving to the AI-generated answer
 * @throws {Error} If AI generation fails (returns fallback message)
 */
export async function answerQuestion(
  content: string,
  question: string,
  userId?: string,
  documentId?: string
): Promise<string> {
  const prompt = `You are a helpful study assistant. Answer questions based on the provided content accurately and concisely.

Based on the following content, please answer this question:

Content:
${content}

Question: ${question}`;

  try {
    const model = await getModel();
    const modelName = cachedWorkingModel || "models/gemini-2.5-flash";

    // Estimate input tokens
    const estimatedInputTokens = estimateTokens(prompt);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text =
      response.text() || "I apologize, but I could not generate an answer.";

    // Get token usage and track cost
    const usage = getTokenUsage(response);
    const inputTokens = usage.inputTokens || estimatedInputTokens;
    const outputTokens = usage.outputTokens || estimateTokens(text);

    // Log cost for monitoring
    logAICost({
      model: modelName,
      inputTokens,
      outputTokens,
      operation: "answerQuestion",
      userId,
      documentId,
    });

    return text;
  } catch (error) {
    console.error("Error answering question:", error);
    return "I apologize, but I could not generate an answer.";
  }
}

/**
 * Placeholder function for text extraction from file content
 * In production, this would use pdf-parse or mammoth to extract text from uploaded files
 * @param content - The content to extract text from
 * @returns Promise resolving to the extracted text (currently returns content as-is)
 */
export async function extractTextFromContent(content: string): Promise<string> {
  // This is a placeholder - in production, you'd use pdf-parse or mammoth
  // to extract text from uploaded files
  return content;
}

/**
 * Generates educational content from a YouTube video using Gemini's multimodal capabilities
 *
 * This function analyzes a YouTube video directly using Gemini's fileData API and generates:
 * - Summary: Comprehensive overview of the video content
 * - Notes: Detailed study notes with markdown formatting
 * - Flashcards: Q&A cards for memorization
 * - Quiz: Multiple-choice questions to test understanding
 *
 * Gemini can directly analyze YouTube videos by URL, extracting visual and audio information
 * to create comprehensive educational materials.
 *
 * @param youtubeUrl - The full YouTube video URL
 * @param title - The video title (for context)
 * @param userId - Optional user ID for cost tracking
 * @param documentId - Optional document ID for cost tracking
 * @returns Promise resolving to an object containing summary, notes, flashcards, and quiz
 * @throws {Error} If API key is missing or AI generation fails
 */
export async function generateYouTubeContent(
  youtubeUrl: string,
  title: string,
  userId?: string,
  documentId?: string
): Promise<{
  summary: string;
  notes: string;
  flashcards: Array<{ question: string; answer: string }>;
  quiz: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  }>;
}> {
  console.log(`🎬 Generating content from YouTube video: ${title}`);

  const prompt = `You are an expert educational content creator. Analyze this YouTube video thoroughly and create comprehensive study materials.

Video Title: ${title}
Video URL: ${youtubeUrl}

Please watch and analyze the entire video content (visuals, audio, and any text/slides shown), then generate the following educational materials:

1. **SUMMARY** (200-400 words):
   - Comprehensive overview of the main topics covered
   - Key concepts and takeaways
   - How the content is structured

2. **STUDY NOTES** (detailed, markdown formatted):
   - Clear section headings for each major topic
   - Bullet points for key information
   - Any formulas, definitions, or important terms
   - Examples mentioned in the video
   - Use markdown formatting (headers, lists, bold, etc.)

3. **FLASHCARDS** (10-15 cards):
   - Focus on key concepts, definitions, and facts
   - Questions should test understanding, not trivial details
   - Each card has a "question" and "answer"

4. **QUIZ QUESTIONS** (5-8 questions):
   - Multiple choice with 4 options each
   - Test understanding of core concepts
   - Include explanation for each answer
   - "correctAnswer" is the index (0-3) of the correct option

IMPORTANT: Return your response as a valid JSON object in this exact format:
{
  "summary": "Your comprehensive summary here...",
  "notes": "# Topic 1\\n\\n- Point 1\\n- Point 2\\n\\n# Topic 2\\n\\n...",
  "flashcards": [
    {"question": "What is X?", "answer": "X is..."},
    {"question": "How does Y work?", "answer": "Y works by..."}
  ],
  "quiz": [
    {
      "question": "What is the main purpose of X?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Option A is correct because..."
    }
  ]
}

Return ONLY the JSON object, no markdown code blocks, no additional text.`;

  try {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const model = await getModel();
    const modelName = cachedWorkingModel || "models/gemini-2.5-flash";

    // Estimate input tokens (video analysis uses more tokens)
    const estimatedInputTokens = estimateTokens(prompt) + 10000; // Add estimate for video content

    // Generate content with the YouTube URL using fileData format
    // Gemini can analyze YouTube videos when passed as fileData
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: "video/mp4",
          fileUri: youtubeUrl,
        },
      },
      { text: prompt },
    ]);
    const response = await result.response;
    const text = response.text().trim();

    // Get token usage and track cost
    const usage = getTokenUsage(response);
    const inputTokens = usage.inputTokens || estimatedInputTokens;
    const outputTokens = usage.outputTokens || estimateTokens(text);

    // Log cost for monitoring
    logAICost({
      model: modelName,
      inputTokens,
      outputTokens,
      operation: "generateYouTubeContent",
      userId,
      documentId,
    });

    // Parse the JSON response with robust error handling
    let jsonText = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    // Extract the JSON object by finding the first { and matching closing }
    // This handles cases where there's extra text after the JSON
    function extractJSONObject(text: string): string | null {
      const startIndex = text.indexOf("{");
      if (startIndex === -1) return null;

      let depth = 0;
      let inString = false;
      let escapeNext = false;

      for (let i = startIndex; i < text.length; i++) {
        const char = text[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === "\\") {
          escapeNext = true;
          continue;
        }

        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === "{") {
            depth++;
          } else if (char === "}") {
            depth--;
            if (depth === 0) {
              return text.substring(startIndex, i + 1);
            }
          }
        }
      }

      return null; // No complete JSON object found
    }

    const extractedJson = extractJSONObject(jsonText);
    if (extractedJson) {
      jsonText = extractedJson;
    }

    try {
      const parsed = JSON.parse(jsonText);

      // Validate and return the parsed content
      return {
        summary: parsed.summary || "Unable to generate summary from video.",
        notes: parsed.notes || "Unable to generate notes from video.",
        flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
        quiz: Array.isArray(parsed.quiz) ? parsed.quiz : [],
      };
    } catch (parseError: any) {
      console.error("Error parsing YouTube content JSON:", parseError);
      console.log("Raw response (first 1000 chars):", text.substring(0, 1000));
      console.log("JSON text (first 1000 chars):", jsonText.substring(0, 1000));

      // Try to fix common JSON issues and parse again
      try {
        // Try to fix truncated JSON by closing unclosed objects/arrays
        let fixedJson = jsonText;

        // Count open/close braces
        const openBraces = (fixedJson.match(/\{/g) || []).length;
        const closeBraces = (fixedJson.match(/\}/g) || []).length;
        const openBrackets = (fixedJson.match(/\[/g) || []).length;
        const closeBrackets = (fixedJson.match(/\]/g) || []).length;

        // Close unclosed arrays first, then objects
        if (closeBrackets < openBrackets) {
          fixedJson += "]".repeat(openBrackets - closeBrackets);
        }
        if (closeBraces < openBraces) {
          fixedJson += "}".repeat(openBraces - closeBraces);
        }

        const parsed = JSON.parse(fixedJson);
        console.log("✅ Successfully parsed after fixing JSON");
        return {
          summary: parsed.summary || "Unable to generate summary from video.",
          notes: parsed.notes || "Unable to generate notes from video.",
          flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
          quiz: Array.isArray(parsed.quiz) ? parsed.quiz : [],
        };
      } catch (fixError) {
        console.error("Failed to fix JSON:", fixError);
      }

      // Try to extract partial content using regex (multiline mode)
      // Use a more robust regex that handles escaped quotes and newlines
      const summaryMatch = jsonText.match(
        /"summary"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/
      );
      const notesMatch = jsonText.match(
        /"notes"\s*:\s*"((?:[^"\\]|\\.|\\n)*)"/
      );

      if (summaryMatch || notesMatch) {
        console.log("⚠️ Extracted partial content from malformed JSON");
        return {
          summary: summaryMatch
            ? summaryMatch[1]
                .replace(/\\n/g, "\n")
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, "\\")
            : "Unable to generate summary from video.",
          notes: notesMatch
            ? notesMatch[1]
                .replace(/\\n/g, "\n")
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, "\\")
            : "Unable to generate notes from video.",
          flashcards: [],
          quiz: [],
        };
      }

      // Return error message
      return {
        summary:
          "Unable to parse video content. The video may be too long or contain unsupported content.",
        notes: "Unable to generate notes from this video.",
        flashcards: [],
        quiz: [],
      };
    }
  } catch (error: any) {
    console.error("Error generating YouTube content:", error);
    throw new Error(`Failed to analyze YouTube video: ${error.message}`);
  }
}
