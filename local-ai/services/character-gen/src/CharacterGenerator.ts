import * as https from 'https';
import * as http from 'http';
import { createLogger } from '../../../shared/logger';
import { CharacterGenInput, CharacterGenResult, GeneratedStats, GeneratedBackground } from './types';
import { allocateStats } from './StatAllocator';
import { allocateSkills } from './SkillAllocator';

const logger = createLogger('CharacterGenerator');

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

type AIProvider = 'inception' | 'ollama';

interface LLMResponse {
  text: string;
  tokensUsed: number;
}

function resolveProvider(): AIProvider {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === 'inception' || explicit === 'ollama') {
    return explicit;
  }
  return 'ollama';
}

function ollamaRequest(
  host: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  temperature: number
): Promise<LLMResponse> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model,
      stream: false,
      keep_alive: -1,
      options: { temperature, num_predict: maxTokens },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });
    const url = new URL('/api/chat', host);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Ollama ${res.statusCode}: ${data.substring(0, 300)}`));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const text = parsed.message?.content ?? '';
            const tokensUsed = (parsed.prompt_eval_count || 0) + (parsed.eval_count || 0);
            resolve({ text, tokensUsed });
          } catch { reject(new Error(`Invalid JSON from Ollama: ${data.substring(0, 200)}`)); }
        });
      }
    );
    req.on('error', (err) => reject(new Error(`Ollama connection error: ${err.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Ollama timeout')); });
    req.write(payload);
    req.end();
  });
}

function inceptionRequest(apiKey: string, model: string, body: Record<string, unknown>): Promise<LLMResponse> {
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
          'Authorization': `Bearer ${apiKey}`,
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
            const parsed = JSON.parse(data);
            const text = parsed.choices?.[0]?.message?.content ?? '';
            const usage = parsed.usage || {};
            const tokensUsed = usage.total_tokens ?? ((usage.prompt_tokens || 0) + (usage.completion_tokens || 0));
            resolve({ text, tokensUsed });
          } catch { reject(new Error(`Invalid JSON from Inception: ${data.substring(0, 200)}`)); }
        });
      }
    );
    req.on('error', (err) => reject(new Error(`Inception connection error: ${err.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Inception timeout')); });
    req.write(payload);
    req.end();
  });
}

function parseJSON<T>(raw: string, step: string): T {
  try { return JSON.parse(raw); }
  catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`[${step}] No valid JSON in response`);
  }
}

export class CharacterGenerator {
  private provider: AIProvider;
  private apiKey: string;
  private model: string;
  private ollamaHost: string;

  constructor() {
    this.provider = resolveProvider();
    this.ollamaHost = process.env.OLLAMA_URL || 'http://localhost:11434';

    if (this.provider === 'inception') {
      this.apiKey = process.env.INCEPTION_API_KEY || '';
      this.model = process.env.INCEPTION_MODEL || 'mercury-2';
      if (!this.apiKey) throw new Error('INCEPTION_API_KEY is not set');
    } else {
      this.apiKey = '';
      // Generazione di JSON strutturato: preferisce il modello analitico se configurato.
      this.model = process.env.OLLAMA_ANALYTICAL_MODEL || process.env.OLLAMA_MODEL || 'qwen3:8b';
    }
  }

  private async llmRequest(systemPrompt: string, userMessage: string, maxTokens: number, temperature: number): Promise<LLMResponse> {
    if (this.provider === 'inception') {
      return inceptionRequest(this.apiKey, this.model, {
        model: this.model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      });
    }

    return ollamaRequest(this.ollamaHost, this.model, systemPrompt, userMessage, maxTokens, temperature);
  }

  async generate(input: CharacterGenInput): Promise<CharacterGenResult> {
    const { character, gameConfig } = input;
    const statsBudget = gameConfig.statsBudget ?? 450;
    const skillsBudget = gameConfig.skillsBudget ?? 250;

    logger.info(`Generating character: ${character.firstName} ${character.lastName} (provider: ${this.provider})`);

    const narrativePrompt = buildNarrativePrompt(character, gameConfig.occupations);

    const res1 = await this.llmRequest(narrativePrompt.system, narrativePrompt.user, 3000, 0.8);
    logger.info(`Narrative generation complete (${res1.tokensUsed} tokens)`);

    interface NarrativeOutput {
      basicInfo: {
        birthDate?: string; age?: number; apparentAge?: number;
        height?: number; weight?: number; eyeColor?: string; hairColor?: string;
        visibleMarks?: string; hiddenMarks?: string; maritalStatus?: string;
        educationTitle?: string; criminalRecord?: string; pathologies?: string;
        publicDescription?: string; privateDescription?: string; physicalDescription?: string;
        currentOccupation?: string;
      };
      occupationId?: string;
      background: GeneratedBackground;
      statWeights: Partial<Record<keyof GeneratedStats, number>>;
      prioritySkillIds: string[];
    }

    const narrative: NarrativeOutput = parseJSON<NarrativeOutput>(res1.text, 'narrative');

    const stats = allocateStats(narrative.statWeights ?? {}, statsBudget);

    const skills = allocateSkills(
      gameConfig.skills,
      narrative.prioritySkillIds ?? [],
      skillsBudget
    );

    const occupationId = resolveOccupation(narrative.occupationId, gameConfig.occupations);

    const info = narrative.basicInfo ?? {};

    return {
      requestId: input.requestId,
      character: {
        firstName: character.firstName,
        lastName: character.lastName,
        gender: character.gender,
        birthDate: info.birthDate,
        age: info.age,
        apparentAge: info.apparentAge,
        height: info.height,
        weight: info.weight,
        eyeColor: info.eyeColor,
        hairColor: info.hairColor,
        visibleMarks: info.visibleMarks,
        hiddenMarks: info.hiddenMarks,
        maritalStatus: info.maritalStatus,
        educationTitle: info.educationTitle,
        criminalRecord: info.criminalRecord,
        pathologies: info.pathologies,
        publicDescription: info.publicDescription,
        privateDescription: info.privateDescription,
        physicalDescription: info.physicalDescription,
        currentOccupation: info.currentOccupation,
        occupation: occupationId,
        stats,
        skills,
        background: narrative.background,
      },
    };
  }
}

function buildNarrativePrompt(
  character: CharacterGenInput['character'],
  occupations: Array<{ id: string; name: string; description?: string }>
) {
  const occList = occupations.map(o => `- "${o.id}": ${o.name}${o.description ? ` (${o.description})` : ''}`).join('\n');

  const system = `Sei un esperto creatore di personaggi per un GDR by chat ambientato nella Londra vittoriana del 1895 (sistema Call of Cthulhu).
Dato un nome, genere e descrizione, genera un JSON completo con i dati biografici, il background e le preferenze per stat e skill.

Struttura JSON richiesta:
{
  "basicInfo": {
    "birthDate": "YYYY-MM-DD (tra 1850-1875 circa)",
    "age": <numero intero>,
    "apparentAge": <numero intero, simile all'età reale>,
    "height": <cm, numero intero, es. 172>,
    "weight": <kg, numero intero, es. 68>,
    "eyeColor": "colore occhi in italiano",
    "hairColor": "colore capelli in italiano",
    "visibleMarks": "segni visibili o vuoto",
    "hiddenMarks": "segni nascosti o vuoto",
    "maritalStatus": "nubile|celibe|sposato|sposata|vedovo|vedova",
    "educationTitle": "titolo di studio vittoriano coerente",
    "criminalRecord": "fedina penale o vuoto",
    "pathologies": "patologie fisiche/mentali note o vuoto",
    "publicDescription": "descrizione pubblica 2-3 frasi, aspetto e impressione generale",
    "privateDescription": "descrizione privata 2-3 frasi, lato nascosto",
    "physicalDescription": "descrizione fisica dettagliata 3-4 frasi",
    "currentOccupation": "occupazione attuale in parole"
  },
  "occupationId": "ID dall'elenco fornito, scegli il più coerente",
  "background": {
    "briefHistory": "storia in breve, 200-400 caratteri",
    "significantEvents": "eventi salienti, 150-300 caratteri",
    "importantRelationships": "relazioni importanti, 150-300 caratteri",
    "personality": "personalità, 150-300 caratteri",
    "ideology": "credo e valori, 100-250 caratteri",
    "significantPlaces": "luoghi significativi, 100-250 caratteri",
    "fearsAndPhobias": "paure e fobie, 100-250 caratteri",
    "secrets": "segreti, 100-250 caratteri",
    "goalsAndMotivations": "obiettivi, 100-250 caratteri"
  },
  "statWeights": {
    "strength": <0.5-2.0>,
    "dexterity": <0.5-2.0>,
    "intelligence": <0.5-2.0>,
    "constitution": <0.5-2.0>,
    "appearance": <0.5-2.0>,
    "size": <0.5-2.0>,
    "power": <0.5-2.0>,
    "education": <0.5-2.0>
  },
  "prioritySkillIds": ["id1", "id2", ..., "id8"]
}

Nota: statWeights guidano la distribuzione dei punti statistica (peso > 1 = stat più alta). prioritySkillIds sono gli ID (dalla lista fornita) delle skill più importanti per questo personaggio.
Rispondi SOLO con il JSON, senza testo aggiuntivo.`;

  const user = `Nome: ${character.firstName} ${character.lastName}
Genere: ${character.gender}
Descrizione: ${character.description}

Occupazioni disponibili:
${occList || '(nessuna disponibile — usa currentOccupation testuale)'}`;

  return { system, user };
}

function resolveOccupation(
  suggestedId: string | undefined,
  occupations: Array<{ id: string; name: string }>
): string | undefined {
  if (!suggestedId) return undefined;
  const found = occupations.find(o => o.id === suggestedId);
  if (found) return found.id;
  const nameFuzzy = occupations.find(o => o.name.toLowerCase().includes(suggestedId.toLowerCase()));
  return nameFuzzy?.id;
}
