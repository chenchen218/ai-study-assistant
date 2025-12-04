/**
 * AI Cost Tracking Module
 *
 * Tracks token usage and calculates costs for Gemini API calls.
 * This is critical for understanding and controlling AI API costs.
 */

interface AICallMetrics {
  model: string;
  inputTokens: number;
  outputTokens: number;
  operation: string;
  userId?: string;
  documentId?: string;
}

// Google Gemini 2.5 Flash pricing (as of 2024)
// Update these prices based on current Google AI pricing
const GEMINI_PRICING: Record<string, { input: number; output: number }> = {
  "models/gemini-2.5-flash": {
    input: 0.075 / 1_000_000, // $0.075 per 1M input tokens
    output: 0.3 / 1_000_000, // $0.30 per 1M output tokens
  },
  "models/gemini-2.0-flash-exp": {
    input: 0.075 / 1_000_000,
    output: 0.3 / 1_000_000,
  },
  "models/gemini-1.5-flash": {
    input: 0.075 / 1_000_000,
    output: 0.3 / 1_000_000,
  },
  // Add other models as needed
};

/**
 * Calculates the cost of an AI API call based on token usage
 */
export function calculateAICost(metrics: AICallMetrics): number {
  const pricing = GEMINI_PRICING[metrics.model];
  if (!pricing) {
    console.warn(`⚠️ Unknown model pricing: ${metrics.model}, using default`);
    // Use default pricing if model not found
    const defaultPricing = GEMINI_PRICING["models/gemini-2.5-flash"];
    const inputCost = metrics.inputTokens * defaultPricing.input;
    const outputCost = metrics.outputTokens * defaultPricing.output;
    return inputCost + outputCost;
  }

  const inputCost = metrics.inputTokens * pricing.input;
  const outputCost = metrics.outputTokens * pricing.output;
  return inputCost + outputCost;
}

/**
 * Estimates token count from text (rough approximation)
 * Gemini uses ~4 characters per token on average
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Logs AI cost for monitoring
 */
export function logAICost(metrics: AICallMetrics): void {
  const cost = calculateAICost(metrics);
  const totalTokens = metrics.inputTokens + metrics.outputTokens;

  console.log(`💰 AI Cost - ${metrics.operation}:`, {
    model: metrics.model,
    inputTokens: metrics.inputTokens.toLocaleString(),
    outputTokens: metrics.outputTokens.toLocaleString(),
    totalTokens: totalTokens.toLocaleString(),
    cost: `$${cost.toFixed(6)}`,
    userId: metrics.userId || "unknown",
    documentId: metrics.documentId || "unknown",
  });

  // Log warning if cost is unusually high
  if (cost > 0.01) {
    console.warn(
      `⚠️ High AI cost detected: $${cost.toFixed(4)} for ${metrics.operation}`
    );
  }
}

/**
 * Gets token usage from Gemini API response
 */
export function getTokenUsage(response: any): {
  inputTokens: number;
  outputTokens: number;
} {
  // Try to get actual token usage from response
  const usageMetadata = response.usageMetadata || response.usage;

  if (usageMetadata) {
    return {
      inputTokens: usageMetadata.promptTokenCount || 0,
      outputTokens:
        usageMetadata.candidatesTokenCount ||
        usageMetadata.totalTokenCount - (usageMetadata.promptTokenCount || 0),
    };
  }

  // Fallback: estimate from prompt and response
  return {
    inputTokens: 0, // Will be estimated by caller
    outputTokens: 0, // Will be estimated by caller
  };
}

/**
 * Creates a cost tracking record
 */
export function createCostRecord(metrics: AICallMetrics): {
  cost: number;
  totalTokens: number;
  timestamp: Date;
} {
  const cost = calculateAICost(metrics);
  const totalTokens = metrics.inputTokens + metrics.outputTokens;

  return {
    cost,
    totalTokens,
    timestamp: new Date(),
  };
}
