import * as http from 'http';
import { IAgent, GenerateBotOptions } from './IAgent';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('OllamaAgent');

const REQUEST_TIMEOUT_MS = 15 * 60 * 1000;

interface OllamaChatResponse {
  message: { role: string; content: string };
  eval_count?: number;
  prompt_eval_count?: number;
}

export class OllamaAgent implements IAgent {
  private host: string;
  private model: string;

  constructor() {
    this.host = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'mistral:7b-instruct';
  }

  private chat(params: Record<string, unknown>): Promise<OllamaChatResponse> {
    return new Promise((resolve, reject) => {
      const url = new URL('/api/chat', this.host);
      const payload = JSON.stringify({ ...params, stream: false, keep_alive: -1 });

      const req = http.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout: REQUEST_TIMEOUT_MS,
      }, (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => body += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Ollama ${res.statusCode}: ${body.substring(0, 200)}`));
            return;
          }
          try { resolve(JSON.parse(body)); }
          catch { reject(new Error(`Invalid JSON from Ollama: ${body.substring(0, 200)}`)); }
        });
      });

      req.on('error', (err) => reject(new Error(`Ollama connection error: ${err.message}`)));
      req.on('timeout', () => { req.destroy(); reject(new Error(`Ollama timeout after ${REQUEST_TIMEOUT_MS / 1000}s`)); });
      req.write(payload);
      req.end();
    });
  }

  async generate(
    systemPrompt: string,
    userMessage: string,
    numPredict = 1024,
    temperature = 0.72,
    topP = 0.85,
    repeatPenalty = 1.2,
  ): Promise<{ text: string; tokensUsed: number }> {
    const startMs = Date.now();
    logger.info('Starting response generation...');

    const response = await this.chat({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      options: {
        temperature,
        top_p: topP,
        repeat_penalty: repeatPenalty,
        num_predict: numPredict,
      },
    });

    let text = response.message.content.trim();
    text = text.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ').trim();

    const elapsed = Date.now() - startMs;
    const tokensUsed = (response.eval_count || 0) + (response.prompt_eval_count || 0);

    logger.info(`Generated response in ${elapsed}ms (${tokensUsed} tokens)`);

    return { text, tokensUsed };
  }

  async analyzeJSON<T = Record<string, unknown>>(
    stepName: string,
    systemPrompt: string,
    userMessage: string,
    options: { temperature?: number; numPredict?: number } = {},
  ): Promise<{ result: T; tokensUsed: number }> {
    const startMs = Date.now();
    const temp = options.temperature ?? 0.3;
    const numPredict = options.numPredict ?? 512;

    logger.info(`[${stepName}] Starting analysis...`);

    const response = await this.chat({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      options: { temperature: temp, num_predict: numPredict },
      format: 'json',
    });

    const elapsed = Date.now() - startMs;
    const tokensUsed = (response.eval_count || 0) + (response.prompt_eval_count || 0);

    let result: T;
    try {
      result = JSON.parse(response.message.content);
    } catch {
      logger.warn(`[${stepName}] Failed to parse JSON, attempting extraction...`);
      const jsonMatch = response.message.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error(`[${stepName}] No valid JSON in response`);
      }
    }

    logger.info(`[${stepName}] Completed in ${elapsed}ms (${tokensUsed} tokens)`);
    return { result, tokensUsed };
  }

  async generateBot(description: string, options: GenerateBotOptions = {}): Promise<any> {
    const { location, style, locale = 'it' } = options;

    const locationContext = location
      ? `\nIl personaggio vive e opera in: "${location.name}".${location.description ? ` Descrizione del luogo: ${location.description}` : ''} Il personaggio DEVE essere coerente con questo ambiente.`
      : '';

    const styleContext = style
      ? `\nAmbientazione/stile: ${style}.`
      : '\nAmbientazione: Londra vittoriana, fine 1800, in stile Call of Cthulhu.';

    const systemPrompt = `Sei un creatore di personaggi NPC per un GDR by chat.${styleContext}

Genera un JSON con questa struttura:

{
  "name": "Nome completo",
  "gender": "male" o "female",
  "publicDescription": "Aspetto fisico in 2-3 frasi.",
  "personality": {
    "traits": ["tratto1", "tratto2", "tratto3", "tratto4", "tratto5"],
    "speech_style": "Come parla, intercalari, accento.",
    "background": "Storia in 3-4 frasi.",
    "coreValues": ["valore1", "valore2", "valore3"]
  },
  "systemPrompt": "Prompt dettagliato per interpretare il personaggio (vedi sotto)"
}

Il "systemPrompt" descrive il personaggio in seconda persona ("Sei...") e copre: identita, psicologia, comportamento con sconosciuti e persone fidate, reazioni emotive, obiettivi, segreti, stile di parlata, abitudini.
Scrivi come istruzioni per un attore in una chat GDR.${locationContext}

Lingua: ${locale}. Rispondi SOLO col JSON.`;

    logger.info(`Starting bot generation for: "${description.substring(0, 60)}..."`);

    const response = await this.chat({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: description },
      ],
      options: { temperature: 0.9, num_predict: 2048 },
      format: 'json',
    });

    const parsed = JSON.parse(response.message.content);

    if (!parsed.name || !parsed.systemPrompt) {
      throw new Error('Generated bot missing required fields (name, systemPrompt)');
    }

    logger.info(`Generated bot "${parsed.name}" (${(response.eval_count || 0) + (response.prompt_eval_count || 0)} tokens)`);

    return parsed;
  }
}
