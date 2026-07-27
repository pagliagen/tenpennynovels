import { Ollama } from 'ollama';
import { config } from '../../config';

/**
 * Metriche di una singola generazione, lette dalla response di Ollama.
 * Servono a distinguere il costo del prefill (prompt) da quello del decode
 * (risposta): su CPU sono due colli di bottiglia diversi e vanno misurati
 * separatamente prima di attribuire la lentezza all'hardware.
 */
export interface ChatMetrics {
  promptTokens: number;
  answerTokens: number;
  promptEvalMs: number;
  evalMs: number;
  loadMs: number;
  totalMs: number;
  answerTokensPerSecond: number;
}

export interface ChatResult {
  text: string;
  tokensUsed: number;
  metrics: ChatMetrics;
}

/** Ollama riporta le durate in nanosecondi. */
const nsToMs = (ns?: number): number => Math.round((ns || 0) / 1e6);

/**
 * Rimuove il blocco di reasoning dall'output.
 * Con `think: false` Ollama non dovrebbe emetterlo, ma le versioni del server
 * che ignorano il parametro lo inseriscono inline nel content: senza questo
 * il ragionamento del modello finisce nella risposta mostrata al giocatore.
 */
function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^[\s\S]*?<\/think>/i, '')
    .trim();
}

function buildMetrics(response: {
  prompt_eval_count?: number;
  eval_count?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
  load_duration?: number;
  total_duration?: number;
}): ChatMetrics {
  const answerTokens = response.eval_count || 0;
  const evalMs = nsToMs(response.eval_duration);

  return {
    promptTokens: response.prompt_eval_count || 0,
    answerTokens,
    promptEvalMs: nsToMs(response.prompt_eval_duration),
    evalMs,
    loadMs: nsToMs(response.load_duration),
    totalMs: nsToMs(response.total_duration),
    answerTokensPerSecond: evalMs > 0 ? Number(((answerTokens / evalMs) * 1000).toFixed(2)) : 0,
  };
}

export class OllamaChat {
  private client: Ollama;
  private model: string;

  constructor() {
    this.client = new Ollama({
      host: config.services.ollama.url,
    });
    this.model = config.services.ollama.model;
  }

  async chat(systemPrompt: string, userMessage: string, maxTokens: number = config.qa.maxAnswerTokens): Promise<ChatResult> {
    const response = await this.client.chat({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      think: config.services.ollama.think,
      options: {
        temperature: 0.3,
        num_predict: maxTokens,
        num_ctx: config.services.ollama.numCtx,
      },
      keep_alive: -1,
    });

    return {
      text: stripThinking(response.message.content),
      tokensUsed: (response.eval_count || 0) + (response.prompt_eval_count || 0),
      metrics: buildMetrics(response),
    };
  }

  async chatJSON(systemPrompt: string, userMessage: string, maxTokens: number = 256): Promise<ChatResult> {
    const response = await this.client.chat({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      // Il reasoning va disattivato a maggior ragione qui: i token di <think>
      // precedono l'oggetto JSON e ne rompono il parsing a valle.
      think: config.services.ollama.think,
      options: {
        temperature: 0.3,
        num_predict: maxTokens,
        num_ctx: config.services.ollama.numCtx,
      },
      format: 'json',
      keep_alive: -1,
    });

    return {
      text: stripThinking(response.message.content),
      tokensUsed: (response.eval_count || 0) + (response.prompt_eval_count || 0),
      metrics: buildMetrics(response),
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
      think: config.services.ollama.think,
      options: { num_predict: 1, num_ctx: config.services.ollama.numCtx },
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
