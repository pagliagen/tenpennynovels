import { logger } from './logger';
import type { ChatMessage } from './prompt';

const REQUEST_TIMEOUT_MS = 3 * 60 * 1000;

interface OllamaChatResponse {
  message?: { content?: string };
  eval_count?: number;
  prompt_eval_count?: number;
}

export interface GenerateOptions {
  temperature: number;
  numPredict: number;
}

/** Ciò di cui gli step della pipeline hanno bisogno da un LLM (sostituibile nei test). */
export interface Llm {
  generate(messages: ChatMessage[], opts: GenerateOptions): Promise<string>;
  /** Risposta vincolata a uno schema JSON. Lancia se l'output non è JSON valido. */
  generateJson(messages: ChatMessage[], schema: object, opts: GenerateOptions): Promise<unknown>;
}

export class OllamaClient implements Llm {
  constructor(private readonly baseUrl: string, private readonly model: string) {}

  async generateJson(messages: ChatMessage[], schema: object, opts: GenerateOptions): Promise<unknown> {
    return JSON.parse(await this.generate(messages, opts, schema));
  }

  /** false dopo il primo 400 "does not support thinking": vale per tutto il processo. */
  private thinkParamSupported = true;

  private request(messages: ChatMessage[], opts: GenerateOptions, format: object | undefined, withThink: boolean): Promise<Response> {
    return fetch(new URL('/api/chat', this.baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        ...(format ? { format } : {}),
        // I modelli a ragionamento (qwen3.5, gemma4) lo fanno di default: per una battuta
        // di chat è solo latenza. Gli altri (gemma3) rifiutano il parametro.
        ...(withThink ? { think: false } : {}),
        keep_alive: '15m',
        options: {
          temperature: opts.temperature,
          top_p: 0.9,
          repeat_penalty: 1.15,
          num_predict: opts.numPredict,
        },
      }),
    });
  }

  async generate(messages: ChatMessage[], opts: GenerateOptions, format?: object): Promise<string> {
    const startedAt = Date.now();
    let response = await this.request(messages, opts, format, this.thinkParamSupported);

    if (response.status === 400 && this.thinkParamSupported) {
      const body = await response.text();
      if (!/think/i.test(body)) throw new Error(`Ollama 400: ${body.slice(0, 200)}`);
      this.thinkParamSupported = false;
      logger.info('Il modello non supporta think: riprovo senza', { model: this.model });
      response = await this.request(messages, opts, format, false);
    }

    if (!response.ok) {
      throw new Error(`Ollama ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    logger.info('Ollama risposta generata', {
      model: this.model,
      ms: Date.now() - startedAt,
      promptTokens: data.prompt_eval_count,
      outputTokens: data.eval_count,
    });
    return data.message?.content ?? '';
  }
}
