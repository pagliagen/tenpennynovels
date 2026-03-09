import { Ollama } from 'ollama';

export class OllamaChat {
  private client: Ollama;
  private model: string;

  constructor() {
    this.client = new Ollama({
      host: process.env.OLLAMA_URL || 'http://localhost:11434',
    });
    this.model = process.env.OLLAMA_MODEL || 'mistral:7b-instruct';
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
}
