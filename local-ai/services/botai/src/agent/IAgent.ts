/**
 * Common interface for all LLM agent implementations (Ollama, Inception, etc.)
 * Any new provider must implement this interface to be usable in the pipeline.
 */

export interface GenerateBotOptions {
  location?: { name: string; description?: string };
  style?: string;
  locale?: string;
}

export interface IAgent {
  /**
   * Generate a character response given a system prompt and user message.
   */
  generate(
    systemPrompt: string,
    userMessage: string,
    numPredict?: number,
    temperature?: number,
    topP?: number,
    repeatPenalty?: number,
  ): Promise<{ text: string; tokensUsed: number }>;

  /**
   * Run a JSON-producing analysis step (context analysis, refiner, post-analysis).
   */
  analyzeJSON<T = Record<string, unknown>>(
    stepName: string,
    systemPrompt: string,
    userMessage: string,
    options?: { temperature?: number; numPredict?: number },
  ): Promise<{ result: T; tokensUsed: number }>;

  /**
   * Generate a bot definition from a natural-language description.
   */
  generateBot(description: string, options?: GenerateBotOptions): Promise<any>;

  /**
   * Refine an existing bot by integrating admin-provided hints and making everything coherent.
   */
  refineBot(current: Record<string, any>, hints: Record<string, any>, options?: GenerateBotOptions): Promise<any>;
}
