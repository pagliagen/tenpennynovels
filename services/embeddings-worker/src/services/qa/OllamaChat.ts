import { Ollama } from 'ollama';
import { config } from '../../config';

export class OllamaChat {
  private client: Ollama;
  private model: string;

  constructor() {
    this.client = new Ollama({
      host: config.services.ollama.url,
    });
    this.model = config.services.ollama.model;
  }

  async chat(systemPrompt: string, userMessage: string, maxTokens: number = 500): Promise<{ text: string; tokensUsed: number }> {
    const response = await this.client.chat({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      options: {
        temperature: 0.3,
        num_predict: maxTokens,
      },
      keep_alive: -1,
    });

    return {
      text: response.message.content.trim(),
      tokensUsed: (response.eval_count || 0) + (response.prompt_eval_count || 0),
    };
  }

  async chatJSON(systemPrompt: string, userMessage: string, maxTokens: number = 256): Promise<{ text: string; tokensUsed: number }> {
    const response = await this.client.chat({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      options: {
        temperature: 0.3,
        num_predict: maxTokens,
      },
      format: 'json',
      keep_alive: -1,
    });

    return {
      text: response.message.content.trim(),
      tokensUsed: (response.eval_count || 0) + (response.prompt_eval_count || 0),
    };
  }

  /**
   * Warms up the model so it stays resident in Ollama's memory (keep_alive: -1),
   * avoiding a cold-start delay on the first real request after boot.
   */
  async warmup(): Promise<void> {
    await this.client.chat({
      model: this.model,
      messages: [{ role: 'user', content: 'hi' }],
      options: { num_predict: 1 },
      keep_alive: -1,
    });
  }
}

/**
 * Lightweight Ollama reachability check for the /health endpoint.
 * Does not load/warm any model — just confirms the server responds.
 */
export async function checkOllamaHealth(timeoutMs: number = 3000): Promise<boolean> {
  try {
    const client = new Ollama({ host: config.services.ollama.url });
    await Promise.race([
      client.list(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    return true;
  } catch {
    return false;
  }
}
