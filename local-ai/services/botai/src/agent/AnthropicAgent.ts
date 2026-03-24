import * as https from 'https';
import { IAgent, GenerateBotOptions } from './IAgent';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('AnthropicAgent');

const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
const ANTHROPIC_API_VERSION = '2023-06-01';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
  stop_reason: string;
}

export class AnthropicAgent implements IAgent {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    this.model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
  }

  private request(body: Record<string, unknown>): Promise<AnthropicResponse> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);

      const req = https.request(
        {
          hostname: 'api.anthropic.com',
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'x-api-key': this.apiKey,
            'anthropic-version': ANTHROPIC_API_VERSION,
          },
          timeout: REQUEST_TIMEOUT_MS,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Anthropic ${res.statusCode}: ${data.substring(0, 300)}`));
              return;
            }
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error(`Invalid JSON from Anthropic: ${data.substring(0, 200)}`));
            }
          });
        },
      );

      req.on('error', (err) => reject(new Error(`Anthropic connection error: ${err.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Anthropic timeout after ${REQUEST_TIMEOUT_MS / 1000}s`));
      });
      req.write(payload);
      req.end();
    });
  }

  private extractText(response: AnthropicResponse): string {
    return response.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('');
  }

  async generate(
    systemPrompt: string,
    userMessage: string,
    numPredict = 950,
    temperature = 0.72,
    _topP = 0.85,
    _repeatPenalty = 1.2,
  ): Promise<{ text: string; tokensUsed: number }> {
    const startMs = Date.now();
    logger.info('Starting response generation...');

    const response = await this.request({
      model: this.model,
      max_tokens: numPredict,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage } as AnthropicMessage],
    });

    let text = this.extractText(response).trim();
    text = text.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ').trim();

    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
    logger.info(`Generated response in ${Date.now() - startMs}ms (${tokensUsed} tokens)`);

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

    logger.info(`[${stepName}] Starting analysis...`);

    const response = await this.request({
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt + '\n\nRispondi SOLO con JSON valido, senza testo aggiuntivo prima o dopo.',
      messages: [{ role: 'user', content: userMessage } as AnthropicMessage],
    });

    const raw = this.extractText(response);
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    logger.info(`[${stepName}] Completed in ${Date.now() - startMs}ms (${tokensUsed} tokens)`);

    let result: T;
    try {
      result = JSON.parse(raw);
    } catch {
      logger.warn(`[${stepName}] Failed to parse JSON, attempting extraction...`);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error(`[${stepName}] No valid JSON in Anthropic response`);
      }
    }

    return { result, tokensUsed };
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
    "speech_style": "Come parla.",
    "background": "Storia in 3-4 frasi.",
    "coreValues": ["valore1", "valore2", "valore3"]
  },
  "systemPrompt": "Prompt dettagliato per interpretare il personaggio"
}

Il "systemPrompt" descrive il personaggio in seconda persona ("Sei...") e copre: identità, psicologia, comportamento, reazioni emotive, obiettivi, segreti, stile di parlata.${locationContext}

Lingua: ${locale}. Rispondi SOLO col JSON.`;

    logger.info(`Starting bot generation for: "${description.substring(0, 60)}..."`);

    const response = await this.request({
      model: this.model,
      max_tokens: 2048,
      temperature: 0.9,
      system: systemPrompt,
      messages: [{ role: 'user', content: description } as AnthropicMessage],
    });

    const raw = this.extractText(response);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

    if (!parsed.name || !parsed.systemPrompt) {
      throw new Error('Generated bot missing required fields (name, systemPrompt)');
    }

    logger.info(`Generated bot "${parsed.name}" (${(response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)} tokens)`);
    return parsed;
  }
}
