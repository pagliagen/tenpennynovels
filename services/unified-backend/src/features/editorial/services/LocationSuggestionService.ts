import { aiGateway, AiGatewayError, type GenerateRequest, type GenerateResult } from '@core/ai';
import { LOCATION_TAG_DEFS, sanitizeLocationTags, type LocationTag } from '@core/location/constants/locationTags';
import { Location } from '@core/location/models/Location';
import { readDocumentsForReview, searchPublicLore, stripGameMeta } from '@features/documenti/api';
import { detectCanonYear } from '../utils/canonRules';
import { buildDescriptionPrompt, buildTagsPrompt, DESCRIPTION_SCHEMA, TAGS_SCHEMA, type LocationPromptContext } from '../utils/prompts';
import { clipToSentence } from '../utils/text';
import { validateDescription, type DraftCheck } from '../utils/validators';

/** Estratti di ambientazione che finiscono nel prompt: pochi e corti (il prefill è il collo di bottiglia). */
const MAX_PASSAGES = 3;
const MAX_PASSAGE_CHARS = 400;
const MIN_PASSAGE_CHARS = 80;
/** Coseno minimo perché un estratto aiuti a descrivere il luogo (più basso di quello del bot: qui serve atmosfera, non una risposta). */
const MIN_PASSAGE_COSINE = 0.35;
const STYLE_EXAMPLES = 2;

export interface SuggestionContext extends LocationPromptContext {
  /** Tutto il testo da cui un nome proprio può legittimamente venire. */
  knownText: string;
}

export interface SuggestDeps {
  loadContext: (locationId: string) => Promise<SuggestionContext | null>;
  generate: (request: GenerateRequest) => Promise<GenerateResult>;
}

export interface DescriptionSuggestion {
  draft: string;
  /** Tutti i controlli passati. */
  ok: boolean;
  checks: DraftCheck[];
  /** Su cosa si è basata la bozza (titoli degli estratti dell'ambientazione). */
  sources: string[];
  ms: number;
}

export interface TagsSuggestion {
  tags: LocationTag[];
  ms: number;
}

export class LocationNotFoundError extends Error {}

/** Il contesto di un luogo, solo da contenuti pubblici: mai chat, descrizioni private o dati dei personaggi. */
export async function loadLocationContext(locationId: string): Promise<SuggestionContext | null> {
  const location = await Location.findById(locationId).select('name description parentLocation tags').lean();
  if (!location) return null;

  // Quartiere e distretto: si risale la catena dei genitori.
  let quartiere: string | null = null;
  let district: string | null = null;
  let parentId = location.parentLocation?.toString();
  for (let depth = 0; parentId && depth < 6; depth++) {
    const parent = await Location.findById(parentId).select('name locationLevel parentLocation').lean();
    if (!parent) break;
    if (parent.locationLevel === 'quartiere' && !quartiere) quartiere = parent.name;
    if (parent.locationLevel === 'district' && !district) district = parent.name;
    parentId = parent.parentLocation?.toString();
  }

  const [{ documents }, found, others] = await Promise.all([
    readDocumentsForReview(),
    searchPublicLore([location.name, quartiere, district].filter(Boolean).join(' '), 6).catch(() => []),
    Location.find({ locationLevel: 'location', _id: { $ne: location._id } }).select('name description').limit(60).lean(),
  ]);

  const passages = found
    .filter((p) => p.vectorScore >= MIN_PASSAGE_COSINE)
    .map((p) => ({ title: p.heading || p.title, text: clipToSentence(stripGameMeta(p.text), MAX_PASSAGE_CHARS) }))
    .filter((p) => p.text.length >= MIN_PASSAGE_CHARS)
    .slice(0, MAX_PASSAGES);

  // Esempi di stile: le descrizioni esistenti più ricche (ma non lunghissime) di altri luoghi.
  const styleExamples = others
    .filter((o) => o.description.length >= 70 && o.description.length <= 300)
    .sort((a, b) => b.description.length - a.description.length)
    .slice(0, STYLE_EXAMPLES)
    .map((o) => ({ name: o.name, description: o.description }));

  const tagLabels = ((location.tags ?? []) as string[]).map((t) => LOCATION_TAG_DEFS[t as LocationTag]?.label ?? t);
  const ctx: LocationPromptContext = {
    name: location.name, quartiere, district, tagLabels, currentDescription: location.description ?? '', passages, styleExamples,
    canonYear: detectCanonYear(documents),
  };
  return { ...ctx, knownText: [ctx.name, quartiere, district, ctx.currentDescription, ...tagLabels, ...passages.map((p) => p.text)].filter(Boolean).join(' ') };
}

const defaultDeps: SuggestDeps = {
  loadContext: loadLocationContext,
  generate: (request) => aiGateway.generate('editorial', request),
};

async function context(locationId: string, deps: SuggestDeps): Promise<SuggestionContext> {
  const ctx = await deps.loadContext(locationId);
  if (!ctx) throw new LocationNotFoundError('Location non trovata');
  return ctx;
}

/** La risposta vincolata dallo schema è comunque non fidata: si verifica la forma. */
function asString(json: unknown, key: string): string {
  const value = (json as Record<string, unknown> | null)?.[key];
  if (typeof value !== 'string' || value.trim() === '') throw new AiGatewayError('Risposta del servizio AI non valida.', 502);
  return value.trim();
}

export async function suggestDescription(locationId: string, deps: SuggestDeps = defaultDeps): Promise<DescriptionSuggestion> {
  const ctx = await context(locationId, deps);
  const { system, user } = buildDescriptionPrompt(ctx);
  const result = await deps.generate({ system, user, schema: DESCRIPTION_SCHEMA as unknown as Record<string, unknown>, maxTokens: 300 });

  const draft = asString(result.json, 'description');
  const { ok, checks } = validateDescription(draft, { knownText: ctx.knownText, canonYear: ctx.canonYear, currentDescription: ctx.currentDescription });
  return { draft, ok, checks, sources: ctx.passages.map((p) => p.title), ms: result.ms };
}

export async function suggestTags(locationId: string, deps: SuggestDeps = defaultDeps): Promise<TagsSuggestion> {
  const ctx = await context(locationId, deps);
  const { system, user } = buildTagsPrompt(ctx);
  const result = await deps.generate({ system, user, schema: TAGS_SCHEMA as unknown as Record<string, unknown>, maxTokens: 80 });

  const raw = (result.json as { tags?: unknown } | null)?.tags;
  if (!Array.isArray(raw)) throw new AiGatewayError('Risposta del servizio AI non valida.', 502);
  // Il modello può sbagliare anche con lo schema: si tengono solo i tag del registro.
  return { tags: sanitizeLocationTags(raw).tags, ms: result.ms };
}
