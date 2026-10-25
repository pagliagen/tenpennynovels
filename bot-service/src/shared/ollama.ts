import { logger } from './logger';


const REQUEST_TIMEOUT_MS = 3 * 60 * 1000;

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

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

export interface OllamaCheck {
  ok: boolean;
  /** Perché non è ok, in poche parole (finisce nel /health, mai prompt o risposte). */
  reason?: string;
}

/**
 * Ollama risponde e, se indicato, ha il modello. Serve a `/health`: «200» deve voler dire
 * «posso davvero generare», non solo «il processo è su».
 */
export async function checkOllama(baseUrl: string, model?: string, timeoutMs = 2000): Promise<OllamaCheck> {
  try {
    const response = await fetch(new URL('/api/tags', baseUrl), { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return { ok: false, reason: `Ollama ${response.status}` };
    if (!model) return { ok: true };
    const body = (await response.json()) as { models?: { name?: string; model?: string }[] };
    const names = (body.models ?? []).flatMap((m) => [m.name, m.model]).filter((n): n is string => !!n);
    // «gemma4:12b» e «gemma4:12b-q4» sono modelli diversi, ma «gemma4» senza tag vale «gemma4:latest».
    const wanted = model.includes(':') ? model : `${model}:latest`;
    return names.includes(wanted) ? { ok: true } : { ok: false, reason: `modello ${model} non installato` };
  } catch {
    return { ok: false, reason: 'Ollama non raggiungibile' };
  }
}
