import { z } from 'zod';
import { psycheSchema } from './config';
import type { Llm } from '../shared/ollama';

/**
 * Genera la scheda di un bot (personaggio + persona + psicologia) da una descrizione libera e dal contesto di una location.
 * Il modello propone, il codice verifica: i controlli sono deterministici e vanno SEMPRE mostrati alla persona, che
 * corregge la bozza prima di creare il bot. Non salva nulla.
 */

/** Un tentativo dura 15-45 s con un 12B: due bastano, e il chiamante aspetta con un flusso SSE (vedi backend `botAdmin`). */
export const MAX_ATTEMPTS = 2;
const TEMPERATURE = 0.8;
const NUM_PREDICT = 1000;

/** Lunghezze volute: oltre sono un avviso (la persona può accorciare), non una scheda da buttare. I limiti duri sono quelli del modello `Character`. */
export const SOFT_LIMITS = { persona: 1500, physicalDescription: 600, publicDescription: 300 } as const;

/** I campi del personaggio nel game (limiti del modello `Character`: nomi 50, altezza 20, colori 50, segni 500). */
export const characterFieldsSchema = z.object({
  name: z.string().trim().min(3).max(50),
  firstName: z.string().trim().min(1).max(50),
  surname: z.string().trim().min(1).max(50),
  gender: z.enum(['male', 'female']),
  age: z.number().int().min(18).max(80),
  apparentAge: z.number().int().min(14).max(90),
  height: z.string().trim().min(3).max(20),
  eyeColor: z.string().trim().min(2).max(50),
  hairColor: z.string().trim().min(2).max(50),
  visibleMarks: z.string().trim().max(500),
  physicalDescription: z.string().trim().min(20).max(5000),
  publicDescription: z.string().trim().min(10).max(5000),
});

export const botDraftSchema = z.object({
  character: characterFieldsSchema,
  persona: z.string().trim().min(200).max(5000),
  psyche: psycheSchema.omit({ stranger: true }),
});

export type BotDraft = z.infer<typeof botDraftSchema>;

export interface DesignContext {
  /** Cosa ha scritto la persona: il ruolo e il carattere del bot. */
  description: string;
  location: {
    name: string;
    quartiere: string | null;
    district: string | null;
    tags: string[];
    description: string;
    positions: string[];
  };
  /** Nomi già in uso (bot e personaggi): il nuovo non deve ripeterli. */
  existingNames: string[];
}

export interface DraftCheck {
  code: 'schema' | 'persona-length' | 'lengths' | 'second-person' | 'third-person' | 'years' | 'unknown-name' | 'name-unique' | 'name-consistent' | 'age' | 'foreign-words';
  ok: boolean;
  detail?: string;
}

/** Schema JSON per l'output vincolato di Ollama (stessa forma di `botDraftSchema`, senza i limiti che l'LLM non rispetta). */
export const DRAFT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    character: {
      type: 'object',
      properties: {
        name: { type: 'string' }, firstName: { type: 'string' }, surname: { type: 'string' },
        gender: { type: 'string', enum: ['male', 'female'] },
        age: { type: 'integer' }, apparentAge: { type: 'integer' },
        height: { type: 'string' }, eyeColor: { type: 'string' }, hairColor: { type: 'string' },
        visibleMarks: { type: 'string' }, physicalDescription: { type: 'string' }, publicDescription: { type: 'string' },
      },
      required: ['name', 'firstName', 'surname', 'gender', 'age', 'apparentAge', 'height', 'eyeColor', 'hairColor', 'visibleMarks', 'physicalDescription', 'publicDescription'],
    },
    persona: { type: 'string' },
    psyche: {
      type: 'object',
      properties: {
        ocean: { type: 'object', properties: { O: { type: 'integer' }, C: { type: 'integer' }, E: { type: 'integer' }, A: { type: 'integer' }, N: { type: 'integer' } }, required: ['O', 'C', 'E', 'A', 'N'] },
        enneagram: { type: 'object', properties: { type: { type: 'integer' }, fear: { type: 'string' }, desire: { type: 'string' } }, required: ['type', 'fear', 'desire'] },
        pad: { type: 'object', properties: { p: { type: 'number' }, a: { type: 'number' }, d: { type: 'number' } }, required: ['p', 'a', 'd'] },
      },
      required: ['ocean', 'enneagram', 'pad'],
    },
  },
  required: ['character', 'persona', 'psyche'],
} as const;

export function buildDesignPrompt(ctx: DesignContext): { system: string; user: string } {
  const system = [
    'Sei un autore di personaggi non giocanti per un gioco di ruolo ambientato nella Londra vittoriana.',
    'Crei un personaggio che lavora o vive in un luogo preciso e risponde ai giocatori nella chat di quel luogo.',
    'Regole ferree:',
    '- la descrizione dell\'autore decide ruolo, età di massima e carattere: rispettala, non contraddirla e non aggiungere ruoli che non cita;',
    '- `persona`: da 5 a 8 frasi in italiano, in SECONDA persona, che iniziano con «Sei»: chi è, che lavoro fa, il temperamento, come tratta gli sconosciuti, cosa sa e cosa condivide solo a certe condizioni, come parla. Nessun anno, nessun nome proprio di altre persone, niente luoghi che non siano quello dato;',
    '- nome e cognome inglesi plausibili per l\'epoca, diversi da quelli già usati; `name` è «nome cognome»;',
    '- età fra 18 e 80; `apparentAge` è l\'età che si vede a occhio e resta entro 8 anni dall\'età reale; `height` nel formato «1.75m»; colori in una o due parole;',
    '- `visibleMarks`: un segno visibile (o stringa vuota se non serve); `physicalDescription` e `publicDescription` sono in TERZA persona, come le vedrebbe un altro (mai «hai», «ti», «indossi»): la prima sono due frasi su aspetto e portamento (al massimo 500 caratteri), la seconda UNA frase di al massimo 200 caratteri su ciò che vede uno sconosciuto, senza segreti né carattere;',
    '- psicologia coerente con la persona: Big Five da 1 a 100 (O apertura, C coscienziosità, E estroversione, A gradevolezza, N nevroticismo), tipo di Enneagramma da 1 a 9 con paura e desiderio in una frase ciascuno, umore di base PAD con p, a, d fra -1 e 1;',
    '- accordi giusti in italiano nei colori («capelli bianchi», «occhi grigi»);',
    '- italiano corretto, senza parole straniere, senza oggetti o concetti posteriori all\'epoca;',
    'Rispondi SOLO con il JSON richiesto.',
  ].join('\n');

  const where = [ctx.location.name, ctx.location.quartiere, ctx.location.district].filter(Boolean).join(', ');
  const user = [
    `Luogo: ${where}`,
    ctx.location.tags.length ? `Che tipo di luogo è: ${ctx.location.tags.join(', ')}` : '',
    ctx.location.description ? `Descrizione del luogo: ${ctx.location.description}` : '',
    ctx.location.positions.length ? `Punti del luogo: ${ctx.location.positions.join(', ')}` : '',
    ctx.existingNames.length ? `Nomi GIÀ usati (non ripeterli): ${ctx.existingNames.join(', ')}` : '',
    '',
    `DESCRIZIONE DELL'AUTORE: ${ctx.description}`,
    '',
    'Crea il personaggio.',
  ].filter((line) => line !== '').join('\n');
  return { system, user };
}

const norm = (text: string): string => text.trim().toLowerCase().replace(/\s+/g, ' ');
const FOREIGN = /\b(boulevard|terminal|station|street|market|downtown|skyline)\b/gi;
/** Maiuscole che non sono nomi inventati: Londra, il Tamigi, titoli, giorni. */
const CAPITAL_OK = new Set(['londra', 'inghilterra', 'tamigi', 'signore', 'signora', 'signorina', 'dio', 'regina', 'vittoria', 'natale', 'pasqua', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica', 'east', 'end']);

function sentences(text: string): number {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0).length;
}

/** Nomi propri a metà frase che non vengono dal personaggio né dal luogo: il modello li ha inventati. */
function inventedNames(persona: string, allowed: string): string[] {
  const known = new Set(allowed.toLowerCase().split(/[^a-zàèéìòù']+/).filter(Boolean));
  const found: string[] = [];
  for (const m of persona.matchAll(/\b([A-ZÀ-Ý][a-zà-ÿ']{2,})\b/g)) {
    const w = m[1]!;
    const before = persona.slice(0, m.index!).trimEnd();
    if (before === '' || /[.!?«"]$/.test(before)) continue;
    if (CAPITAL_OK.has(w.toLowerCase()) || known.has(w.toLowerCase())) continue;
    found.push(w);
  }
  return [...new Set(found)];
}

/** Il modello a volte lascia una virgola o un punto e virgola dopo l'ultima frase («…scaglie e acqua.,»). */
export function tidyText(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim().replace(/[\s,;:]+$/, '');
  return clean === '' || /[.!?»"]$/.test(clean) ? clean : `${clean}.`;
}

function tidyDraft(raw: unknown): unknown {
  const d = raw as { character?: Record<string, unknown>; persona?: unknown } | null;
  if (!d || typeof d !== 'object' || !d.character || typeof d.character !== 'object') return raw;
  const c = { ...d.character };
  for (const k of ['physicalDescription', 'publicDescription'] as const) if (typeof c[k] === 'string') c[k] = tidyText(c[k] as string);
  if (typeof c.visibleMarks === 'string') c.visibleMarks = (c.visibleMarks as string).replace(/\s+/g, ' ').trim().replace(/[\s,;:]+$/, '');
  return { ...d, character: c, ...(typeof d.persona === 'string' ? { persona: tidyText(d.persona) } : {}) };
}

export function checkDraft(raw: unknown, ctx: DesignContext): { draft: BotDraft | null; checks: DraftCheck[] } {
  const parsed = botDraftSchema.safeParse(tidyDraft(raw));
  if (!parsed.success) {
    const detail = parsed.error.issues.slice(0, 4).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { draft: null, checks: [{ code: 'schema', ok: false, detail }] };
  }
  const draft = parsed.data;
  const { character: c, persona } = draft;
  const checks: DraftCheck[] = [{ code: 'schema', ok: true }];

  const n = sentences(persona);
  checks.push({ code: 'persona-length', ok: n >= 5 && n <= 8, ...(n >= 5 && n <= 8 ? {} : { detail: `${n} frasi (da 5 a 8)` }) });
  checks.push({ code: 'second-person', ok: /^Sei\b/.test(persona), ...(/^Sei\b/.test(persona) ? {} : { detail: 'deve iniziare con «Sei»' }) });

  const tooLong = (Object.keys(SOFT_LIMITS) as (keyof typeof SOFT_LIMITS)[])
    .filter((k) => (k === 'persona' ? persona : c[k]).length > SOFT_LIMITS[k])
    .map((k) => `${k} ${(k === 'persona' ? persona : c[k]).length}/${SOFT_LIMITS[k]}`);
  checks.push({ code: 'lengths', ok: tooLong.length === 0, ...(tooLong.length ? { detail: `troppo lunghe: ${tooLong.join(', ')}` } : {}) });

  const second = /\b(hai|ti|tuo|tua|tuoi|tue|sei|indossi|porti|ti muovi)\b/i.exec(`${c.physicalDescription} ${c.publicDescription} ${c.visibleMarks}`);
  checks.push({ code: 'third-person', ok: !second, ...(second ? { detail: `le descrizioni sono in terza persona, non «${second[0]}»` } : {}) });

  const years = [...`${persona} ${c.physicalDescription} ${c.publicDescription} ${c.visibleMarks}`.matchAll(/(?<!\d)(1[0-9]\d{2}|20\d{2})(?!\d)/g)].map((m) => m[1]!);
  checks.push({ code: 'years', ok: years.length === 0, ...(years.length ? { detail: `anni nel testo: ${[...new Set(years)].join(', ')}` } : {}) });

  const allowed = [c.name, c.firstName, c.surname, ctx.location.name, ctx.location.quartiere, ctx.location.district, ctx.location.description, ctx.description, ...ctx.location.positions].filter(Boolean).join(' ');
  const invented = inventedNames(persona, allowed);
  checks.push({ code: 'unknown-name', ok: invented.length === 0, ...(invented.length ? { detail: `nomi non presenti nelle fonti: ${invented.join(', ')}` } : {}) });

  const taken = new Set(ctx.existingNames.map(norm));
  checks.push({ code: 'name-unique', ok: !taken.has(norm(c.name)), ...(taken.has(norm(c.name)) ? { detail: `«${c.name}» è già in uso` } : {}) });

  const consistent = norm(c.name) === norm(`${c.firstName} ${c.surname}`);
  checks.push({ code: 'name-consistent', ok: consistent, ...(consistent ? {} : { detail: 'nome e cognome non coincidono con il nome completo' }) });

  const ageOk = Math.abs(c.apparentAge - c.age) <= 10;
  checks.push({ code: 'age', ok: ageOk, ...(ageOk ? {} : { detail: `età ${c.age}, apparente ${c.apparentAge}: troppa distanza` }) });

  const foreign = [...new Set([...`${persona} ${c.physicalDescription} ${c.publicDescription}`.matchAll(FOREIGN)].map((m) => m[1]!.toLowerCase()))];
  checks.push({ code: 'foreign-words', ok: foreign.length === 0, ...(foreign.length ? { detail: foreign.join(', ') } : {}) });

  return { draft, checks };
}

export interface DesignResult {
  /** null solo se nessun tentativo ha prodotto una scheda leggibile. */
  draft: BotDraft | null;
  checks: DraftCheck[];
  attempts: number;
}

const failures = (checks: DraftCheck[]): number => checks.filter((c) => !c.ok).length;

/**
 * Fino a 3 tentativi: si ferma al primo con tutti i controlli superati, altrimenti restituisce quello con meno
 * difetti (la persona li vede e può correggere). Un errore del modello a metà propaga solo se non c'è nessuna bozza.
 */
export async function designBot(llm: Llm, ctx: DesignContext): Promise<DesignResult> {
  const { system, user } = buildDesignPrompt(ctx);
  const messages = [{ role: 'system' as const, content: system }, { role: 'user' as const, content: user }];
  let best: DesignResult | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let raw: unknown;
    try {
      raw = await llm.generateJson(messages, DRAFT_JSON_SCHEMA, { temperature: TEMPERATURE, numPredict: NUM_PREDICT });
    } catch (error: unknown) {
      lastError = error;
      continue;
    }
    const { draft, checks } = checkDraft(raw, ctx);
    const result: DesignResult = { draft, checks, attempts: attempt };
    if (draft && failures(checks) === 0) return result;
    if (!best || (draft && (!best.draft || failures(checks) < failures(best.checks)))) best = result;
  }
  if (!best) throw lastError instanceof Error ? lastError : new Error('Il modello non ha risposto');
  return { ...best, attempts: MAX_ATTEMPTS };
}
