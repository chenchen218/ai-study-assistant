import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";

if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in environment variables");
}

const genAI = new GoogleGenerativeAI(apiKey);

// Try multiple models in order of preference
// Cache the working model to avoid repeated API calls
let cachedWorkingModel: string | null = null;

/**
 * Gets a working Gemini AI model by trying multiple model names in order
 * Caches the working model to avoid repeated API calls
 * @returns Promise resolving to a configured Gemini model instance
 * @throws {Error} If no working model is found after trying all options
 */
const getModel = async (): Promise<any> => {
  // If we have a cached working model, use it
  if (cachedWorkingModel) {
    return genAI.getGenerativeModel({ model: cachedWorkingModel });
  }

  // Try models in order: latest stable, then alternatives
  const modelsToTry = [
    "models/gemini-2.5-flash-preview-05-20", // What test endpoint found
    "models/gemini-2.5-flash", // Stable version
    "models/gemini-2.0-flash-exp", // Experimental but available
    "models/gemini-flash-latest", // Latest alias
    "models/gemini-2.0-flash", // Alternative
  ];

  // Try each model until one works
  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      // Test if it works with a simple call
      const testResult = await model.generateContent("test");
      await testResult.response;
      // If we get here, the model works
      cachedWorkingModel = modelName;
      console.log(`✅ Using working model: ${modelName}`);
      return model;
    } catch (err: any) {
      // Try next model
      continue;
    }
  }

  // If all models fail, throw an error
  throw new Error(
    "No working Gemini model found. Please check your API key and model availability."
  );
};

/**
 * Generates a comprehensive summary of educational content using AI
 * @param content - The text content to summarize (should be under 10,000 characters)
 * @returns Promise resolving to the generated summary text
 * @throws {Error} If API key is missing or AI generation fails
 */
export async function generateSummary(content: string): Promise<string> {
  const prompt = `You are an expert at creating concise, comprehensive summaries of educational content. Create a well-structured summary that captures all key concepts and main points.

Please create a comprehensive summary of the following content:

${content}`;

  try {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    const model = await getModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || "";
  } catch (error: any) {
    console.error("Error generating summary:", error);
    console.error("Error details:", error?.message || error);
    throw error;
  }
}

/**
 * Generates detailed study notes from educational content using AI
 * Notes are organized with headings, bullet points, and key concepts
 * @param content - The text content to create notes from (should be under 10,000 characters)
 * @returns Promise resolving to markdown-formatted study notes
 * @throws {Error} If API key is missing or AI generation fails
 */
export async function generateNotes(content: string): Promise<string> {
  const prompt = `You are an expert at creating detailed study notes. Organize the content into clear sections with headings, bullet points, and key concepts highlighted. Use markdown formatting for structure.

Please create detailed study notes from the following content:

${content}`;

  try {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    const model = await getModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text() || "";
  } catch (error: any) {
    console.error("Error generating notes:", error);
    console.error("Error details:", error?.message || error);
    throw error;
  }
}

/**
 * Generates flashcards from educational content using AI
 * @param content - The text content to create flashcards from (should be under 10,000 characters)
 * @param count - Number of flashcards to generate (default: 10)
 * @returns Promise resolving to an array of flashcard objects with question and answer
 * @throws {Error} If API key is missing or AI generation fails (returns empty array on parse errors)
 */
export async function generateFlashcards(
  content: string,
  count: number = 10
): Promise<Array<{ question: string; answer: string }>> {
  const prompt = `You are an expert at creating educational flashcards. Generate exactly ${count} flashcards with clear questions and detailed answers. 

IMPORTANT: Return the response as a valid JSON array of objects. Each object must have exactly two fields: "question" and "answer". Do not include any markdown formatting, code blocks, or extra text - only return the JSON array.

Example format:
[
  {"question": "What is X?", "answer": "X is..."},
  {"question": "What is Y?", "answer": "Y is..."}
]

Please create ${count} flashcards from the following content:

${content}`;

  try {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    const model = await getModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response (might be wrapped in markdown code blocks)
    let jsonText = text.trim();

    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    jsonText = jsonText.trim();

    // Try to parse the JSON
    try {
      const parsed = JSON.parse(jsonText);
      // Handle different possible structures
      if (Array.isArray(parsed)) {
        return parsed.slice(0, count);
      } else if (parsed.flashcards && Array.isArray(parsed.flashcards)) {
        return parsed.flashcards.slice(0, count);
      } else if (parsed.cards && Array.isArray(parsed.cards)) {
        return parsed.cards.slice(0, count);
      }
      return [];
    } catch (parseError) {
      console.error("Error parsing flashcards JSON:", parseError);
      // Try to extract JSON from text
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]).slice(0, count);
        } catch {
          return [];
        }
      }
      return [];
    }
  } catch (error) {
    console.error("Error generating flashcards:", error);
    return [];
  }
}

/**
 * Generates multiple-choice quiz questions from educational content using AI
 * @param content - The text content to create questions from (should be under 10,000 characters)
 * @param count - Number of questions to generate (default: 5)
 * @returns Promise resolving to an array of quiz question objects
 * @throws {Error} If API key is missing or AI generation fails (returns empty array on parse errors)
 */
export async function generateQuizQuestions(
  content: string,
  count: number = 5
): Promise<
  Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  }>
> {
  const prompt = `You are an expert at creating quiz questions. Generate exactly ${count} multiple-choice questions with 4 options each.

IMPORTANT: Return the response as a valid JSON object with a "questions" array. Each question must have:
- "question": string
- "options": array of exactly 4 strings
- "correctAnswer": number (0-3 index indicating the correct option)
- "explanation": string (optional)

Do not include any markdown formatting, code blocks, or extra text - only return the JSON object.

Example format:
{
  "questions": [
    {
      "question": "What is X?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "X is correct because..."
    }
  ]
}

Please create ${count} quiz questions from the following content:

${content}`;

  try {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    const model = await getModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

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
 * Answers a user's question about document content using AI
 * @param content - The document content to use as context
 * @param question - The user's question to answer
 * @returns Promise resolving to the AI-generated answer
 * @throws {Error} If AI generation fails (returns fallback message)
 */
export async function answerQuestion(
  content: string,
  question: string
): Promise<string> {
  const prompt = `You are a helpful study assistant. Answer questions based on the provided content accurately and concisely.

Based on the following content, please answer this question:

Content:
${content}

Question: ${question}`;

  try {
    const model = await getModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return (
      response.text() || "I apologize, but I could not generate an answer."
    );
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
