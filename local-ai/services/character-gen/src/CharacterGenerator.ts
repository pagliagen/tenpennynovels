import * as https from 'https';
import { createLogger } from '../../../shared/logger';
import { CharacterGenInput, CharacterGenResult, GeneratedStats, GeneratedBackground } from './types';
import { allocateStats } from './StatAllocator';
import { allocateSkills } from './SkillAllocator';

const logger = createLogger('CharacterGenerator');

const ANTHROPIC_API_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

function anthropicRequest(apiKey: string, model: string, body: Record<string, unknown>): Promise<AnthropicResponse> {
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
          'x-api-key': apiKey,
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
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error(`Invalid JSON from Anthropic: ${data.substring(0, 200)}`)); }
        });
      }
    );
    req.on('error', (err) => reject(new Error(`Anthropic connection error: ${err.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Anthropic timeout')); });
    req.write(payload);
    req.end();
  });
}

function extractText(res: AnthropicResponse): string {
  return res.content.filter(c => c.type === 'text').map(c => c.text).join('');
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
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    this.model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
    if (!this.apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  }

  async generate(input: CharacterGenInput): Promise<CharacterGenResult> {
    const { character, gameConfig } = input;
    const statsBudget = gameConfig.statsBudget ?? 450;
    const skillsBudget = gameConfig.skillsBudget ?? 250;

    logger.info(`Generating character: ${character.firstName} ${character.lastName}`);

    // ── Step 1: Narrative data via Anthropic ──
    const narrativePrompt = buildNarrativePrompt(character, gameConfig.occupations);

    const res1 = await anthropicRequest(this.apiKey, this.model, {
      model: this.model,
      max_tokens: 3000,
      temperature: 0.8,
      system: narrativePrompt.system,
      messages: [{ role: 'user', content: narrativePrompt.user }],
    });

    const raw1 = extractText(res1);
    const tokens1 = (res1.usage?.input_tokens || 0) + (res1.usage?.output_tokens || 0);
    logger.info(`Narrative generation complete (${tokens1} tokens)`);


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

    const narrative: NarrativeOutput = parseJSON<NarrativeOutput>(raw1, 'narrative');

    // ── Step 2: Allocate stats ──
    const stats = allocateStats(narrative.statWeights ?? {}, statsBudget);

    // ── Step 3: Allocate skills ──
    const skills = allocateSkills(
      gameConfig.skills,
      narrative.prioritySkillIds ?? [],
      skillsBudget
    );

    // ── Step 4: Resolve occupation ID ──
    const occupationId = resolveOccupation(narrative.occupationId, gameConfig.occupations);

    // ── Assemble result ──
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
  // Fuzzy fallback: try name match
  const nameFuzzy = occupations.find(o => o.name.toLowerCase().includes(suggestedId.toLowerCase()));
  return nameFuzzy?.id;
}
