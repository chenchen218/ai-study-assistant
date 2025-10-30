import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateSummary(content: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content:
          "You are an expert at creating concise, comprehensive summaries of educational content. Create a well-structured summary that captures all key concepts and main points.",
      },
      {
        role: "user",
        content: `Please create a comprehensive summary of the following content:\n\n${content}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  return response.choices[0].message.content || "";
}

export async function generateNotes(content: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content:
          "You are an expert at creating detailed study notes. Organize the content into clear sections with headings, bullet points, and key concepts highlighted.",
      },
      {
        role: "user",
        content: `Please create detailed study notes from the following content:\n\n${content}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  return response.choices[0].message.content || "";
}

export async function generateFlashcards(
  content: string,
  count: number = 10
): Promise<Array<{ question: string; answer: string }>> {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are an expert at creating educational flashcards. Generate exactly ${count} flashcards with clear questions and detailed answers. Return the response as a JSON array of objects with "question" and "answer" fields.`,
      },
      {
        role: "user",
        content: `Please create ${count} flashcards from the following content:\n\n${content}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 2000,
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(response.choices[0].message.content || "{}");
    const flashcards = parsed.flashcards || parsed.cards || [];
    return flashcards.slice(0, count);
  } catch (error) {
    // Fallback: try to parse as array directly
    try {
      return JSON.parse(response.choices[0].message.content || "[]");
    } catch {
      return [];
    }
  }
}

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
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are an expert at creating quiz questions. Generate exactly ${count} multiple-choice questions with 4 options each. Return the response as a JSON object with a "questions" array. Each question should have "question", "options" (array of 4 strings), "correctAnswer" (0-3 index), and "explanation" fields.`,
      },
      {
        role: "user",
        content: `Please create ${count} quiz questions from the following content:\n\n${content}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 2000,
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(response.choices[0].message.content || "{}");
    const questions = parsed.questions || parsed.quiz || [];
    return questions.slice(0, count);
  } catch (error) {
    return [];
  }
}

export async function answerQuestion(
  content: string,
  question: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful study assistant. Answer questions based on the provided content accurately and concisely.",
      },
      {
        role: "user",
        content: `Based on the following content, please answer this question:\n\nContent:\n${content}\n\nQuestion: ${question}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  return (
    response.choices[0].message.content ||
    "I apologize, but I could not generate an answer."
  );
}

export async function extractTextFromContent(content: string): Promise<string> {
  // This is a placeholder - in production, you'd use pdf-parse or mammoth
  // to extract text from uploaded files
  return content;
}
