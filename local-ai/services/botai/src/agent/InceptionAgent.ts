import * as https from 'https';
import { IAgent, GenerateBotOptions } from './IAgent';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('InceptionAgent');

const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

// Mercury-2 è un modello reasoning: usa ~2000-2500 token interni per il chain-of-thought.
// max_tokens include reasoning + completion, quindi servono almeno 3000 extra per non
// esaurire il budget prima della risposta effettiva.
const REASONING_OVERHEAD = 3000;

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface InceptionResponse {
  choices: Array<{
    message: { role: string; content: string };
    finish_reason?: string;
  }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export class InceptionAgent implements IAgent {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.INCEPTION_API_KEY || '';
    this.model = process.env.INCEPTION_MODEL || 'mercury-2';

    if (!this.apiKey) {
      throw new Error('INCEPTION_API_KEY is not set');
    }
  }

  private request(body: Record<string, unknown>): Promise<InceptionResponse> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);

      const req = https.request(
        {
          hostname: 'api.inceptionlabs.ai',
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: REQUEST_TIMEOUT_MS,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Inception ${res.statusCode}: ${data.substring(0, 300)}`));
              return;
            }
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error(`Invalid JSON from Inception: ${data.substring(0, 200)}`));
            }
          });
        },
      );

      req.on('error', (err) => reject(new Error(`Inception connection error: ${err.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Inception timeout after ${REQUEST_TIMEOUT_MS / 1000}s`));
      });
      req.write(payload);
      req.end();
    });
  }

  private extractText(response: InceptionResponse): string {
    return response.choices?.[0]?.message?.content ?? '';
  }

  private getTokensUsed(response: InceptionResponse): number {
    if (!response.usage) return 0;
    return response.usage.total_tokens
      ?? (response.usage.prompt_tokens || 0) + (response.usage.completion_tokens || 0);
  }

  async generate(
    systemPrompt: string,
    userMessage: string,
    numPredict = 950,
    temperature = 0.72,
    topP = 0.85,
    _repeatPenalty = 1.2,
  ): Promise<{ text: string; tokensUsed: number }> {
    const startMs = Date.now();
    logger.info('Starting response generation...');

    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await this.request({
      model: this.model,
      max_tokens: numPredict + REASONING_OVERHEAD,
      temperature,
      top_p: topP,
      messages,
    });

    let text = this.extractText(response).trim();
    text = text.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ').trim();

    const tokensUsed = this.getTokensUsed(response);
    const completionTokens = response.usage?.completion_tokens ?? 0;
    const reasoningTokens = (response.usage as any)?.reasoning_tokens ?? 0;
    logger.info(`Generated response in ${Date.now() - startMs}ms (${tokensUsed} total, ${reasoningTokens} reasoning, ${completionTokens} completion, ${text.length} chars)`);

    if (!text) {
      logger.error('Empty response from Inception API', {
        choicesLength: response.choices?.length ?? 0,
        finishReason: response.choices?.[0]?.finish_reason ?? 'N/A',
        contentLength: response.choices?.[0]?.message?.content?.length ?? 0,
        usage: response.usage,
      });
    }

    return { text, tokensUsed };
  }

  async analyzeJSON<T = Record<string, unknown>>(
    stepName: string,
    systemPrompt: string,
    userMessage: string,
    options: { temperature?: number; numPredict?: number } = {},
  ): Promise<{ result: T; tokensUsed: number }> {
    const startMs = Date.now();
    const temperature = options.temperature ?? 0.3;
    const maxTokens = options.numPredict ?? 900;
    const MAX_JSON_RETRIES = 1;

    let lastError: Error | null = null;
    let totalTokens = 0;

    for (let attempt = 0; attempt <= MAX_JSON_RETRIES; attempt++) {
      if (attempt === 0) {
        logger.info(`[${stepName}] Starting analysis...`);
      } else {
        logger.warn(`[${stepName}] JSON retry attempt ${attempt}...`);
      }

      const messages: OpenAIMessage[] = [
        { role: 'system', content: systemPrompt + '\n\nRispondi SOLO con JSON valido, senza testo aggiuntivo prima o dopo.' },
        { role: 'user', content: userMessage },
      ];

      const response = await this.request({
        model: this.model,
        max_tokens: maxTokens + REASONING_OVERHEAD,
        temperature,
        messages,
        response_format: { type: 'json_object' },
      });

      const raw = this.extractText(response);
      const tokensUsed = this.getTokensUsed(response);
      totalTokens += tokensUsed;

      logger.info(`[${stepName}] Completed in ${Date.now() - startMs}ms (${tokensUsed} tokens)`);

      try {
        const result: T = JSON.parse(raw);
        return { result, tokensUsed: totalTokens };
      } catch {
        logger.warn(`[${stepName}] Failed to parse JSON, attempting extraction...`);
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const result: T = JSON.parse(jsonMatch[0]);
            return { result, tokensUsed: totalTokens };
          } catch (extractErr: any) {
            lastError = new Error(`[${stepName}] JSON extraction failed: ${extractErr.message}`);
          }
        } else {
          lastError = new Error(`[${stepName}] No valid JSON in Inception response`);
        }
      }
    }

    throw lastError || new Error(`[${stepName}] JSON parsing failed after ${MAX_JSON_RETRIES + 1} attempts`);
  }

  async refineBot(current: Record<string, any>, hints: Record<string, any>, options: GenerateBotOptions = {}): Promise<any> {
    const { style, locale = 'it' } = options;

    const styleContext = style
      ? `\nAmbientazione/stile: ${style}.`
      : '\nAmbientazione: Londra vittoriana, fine 1800, in stile Call of Cthulhu.';

    const systemPrompt = `Sei un creatore di personaggi NPC per un GDR by chat.${styleContext}

Ricevi i dati ATTUALI di un bot NPC e degli AGGIORNAMENTI parziali richiesti dall'amministratore.
Il tuo compito è:
1. Integrare gli aggiornamenti nel personaggio in modo coerente.
2. Adattare gli altri campi (systemPrompt, narrativeStyle, ecc.) se necessario per mantenere tutto compatibile.
3. Restituire il personaggio COMPLETO e COERENTE.

Struttura JSON da restituire:
{
  "name": "Nome completo",
  "gender": "male" o "female",
  "publicDescription": "Aspetto fisico in 2-3 frasi.",
  "personality": {
    "traits": ["tratto1", "tratto2", "tratto3", "tratto4", "tratto5"],
    "speech_style": "Come parla il personaggio.",
    "background": "Storia in 3-4 frasi.",
    "coreValues": ["valore1", "valore2", "valore3"]
  },
  "narrativeStyle": {
    "author": "Scrittore di riferimento (es. Charles Dickens).",
    "guidance": "2-3 frasi su come applicare quello stile alle risposte del bot."
  },
  "systemPrompt": "Prompt completo in seconda persona (Sei...) coerente con tutti i dati aggiornati."
}

Lingua: ${locale}. Rispondi SOLO col JSON.`;

    const userMessage = `DATI ATTUALI DEL BOT:
${JSON.stringify(current, null, 2)}

AGGIORNAMENTI RICHIESTI DALL'AMMINISTRATORE:
${JSON.stringify(hints, null, 2)}

Integra gli aggiornamenti e restituisci il bot completo e coerente.`;

    logger.info(`Refining bot "${current.name}" with admin hints`);

    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await this.request({
      model: this.model,
      max_tokens: 3000 + REASONING_OVERHEAD,
      temperature: 0.7,
      messages,
      response_format: { type: 'json_object' },
    });

    const raw = this.extractText(response);
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`No JSON found in refineBot response. Raw: ${raw.substring(0, 300)}`);
      }
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseErr: any) {
        throw new Error(`JSON parse failed in refineBot: ${parseErr.message}`);
      }
    }

    const tokensUsed = this.getTokensUsed(response);
    logger.info(`Refined bot "${parsed.name}" (${tokensUsed} tokens)`);
    return parsed;
  }

  async generateBot(description: string, options: GenerateBotOptions = {}): Promise<any> {
    const { location, style, locale = 'it' } = options;

    const locationContext = location
      ? `\nIl personaggio vive e opera in: "${location.name}".${location.description ? ` Descrizione: ${location.description}` : ''} Il personaggio DEVE essere coerente con questo ambiente.`
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
    "speech_style": "Come parla il personaggio (tono, registro, tic linguistici).",
    "background": "Storia del personaggio in 3-4 frasi.",
    "coreValues": ["valore1", "valore2", "valore3"]
  },
  "narrativeStyle": {
    "author": "Nome di uno scrittore reale il cui stile si adatta al personaggio (es. Charles Dickens, Arthur Conan Doyle, Wilkie Collins).",
    "guidance": "2-3 frasi su come applicare lo stile di quell'autore alle risposte del bot: ritmo, lessico, descrizioni, emozioni."
  },
  "systemPrompt": "Prompt dettagliato per interpretare il personaggio in seconda persona (Sei...): identità, psicologia, comportamento, reazioni emotive, obiettivi, segreti, stile di parlata."
}
${locationContext}
Lingua: ${locale}. Rispondi SOLO col JSON.`;

    logger.info(`Starting bot generation for: "${description.substring(0, 60)}..."`);

    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: description },
    ];

    const response = await this.request({
      model: this.model,
      max_tokens: 3000 + REASONING_OVERHEAD,
      temperature: 0.9,
      messages,
      response_format: { type: 'json_object' },
    });

    const raw = this.extractText(response);
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`No JSON found in Inception response. Raw (first 300 chars): ${raw.substring(0, 300)}`);
      }
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseErr: any) {
        throw new Error(`JSON parse failed: ${parseErr.message}. Raw snippet: ${jsonMatch[0].substring(0, 200)}`);
      }
    }

    if (!parsed.name || !parsed.systemPrompt) {
      throw new Error('Generated bot missing required fields (name, systemPrompt)');
    }

    const tokensUsed = this.getTokensUsed(response);
    logger.info(`Generated bot "${parsed.name}" (${tokensUsed} tokens)`);
    return parsed;
  }
}
