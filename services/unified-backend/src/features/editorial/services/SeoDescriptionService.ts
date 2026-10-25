import { aiGateway, AiGatewayError, type GenerateRequest, type GenerateResult } from '@core/ai';
import { readDocumentForSeo, saveSeoDescription, type SeoSource } from '@features/documenti/api';
import { buildSeoPrompt, SEO_SCHEMA } from '../utils/prompts';
import { clipToSentence } from '../utils/text';
import { validateSeoDescription, type DraftCheck } from '../utils/validators';
import { InsufficientInputError } from './LocationSuggestionService';

/** Quanto testo del documento entra nel prompt: il prefill è il collo di bottiglia, e l'inizio di una pagina dice di cosa parla. */
const MAX_SOURCE_CHARS = 2500;
/** Sotto questa soglia non c'è abbastanza materiale per descrivere la pagina senza inventare. */
export const MIN_SEO_SOURCE_CHARS = 200;
/** Tentativi prima di arrendersi: la bozza si salva da sola, quindi si accetta solo se TUTTI i controlli passano. */
export const MAX_SEO_ATTEMPTS = 3;

export class DocumentNotFoundError extends Error {}

/** Nessuna bozza ha superato i controlli: non è stato salvato nulla. */
export class SeoChecksFailedError extends Error {
  constructor(readonly checks: DraftCheck[], readonly attempts: number) {
    super('Nessuna bozza ha superato i controlli');
  }
}

export interface SeoDeps {
  load: (documentId: string) => Promise<SeoSource | null>;
  generate: (request: GenerateRequest) => Promise<GenerateResult>;
  save: (documentId: string, description: string) => Promise<{ previous: string } | null>;
}

export interface SeoGeneration {
  description: string;
  /** Quella che c'era prima (vuota se non c'era): serve a poterla ripristinare a mano. */
  previous: string;
  attempts: number;
  ms: number;
}

const defaultDeps: SeoDeps = {
  load: readDocumentForSeo,
  generate: (request) => aiGateway.generate('editorial', request),
  save: saveSeoDescription,
};

const cleanDraft = (text: string): string => text.replace(/\s+/g, ' ').trim().replace(/^["«“]+|["»”]+$/g, '').trim();

/**
 * Genera la descrizione SEO di un documento pubblico dal suo titolo e dal suo testo, e la SALVA.
 * Salva soltanto una bozza che supera tutti i controlli; altrimenti non tocca nulla (SeoChecksFailedError).
 * La descrizione attuale non entra nel prompt: oggi è vuota quasi ovunque e non è una fonte di fatti.
 */
export async function generateSeoDescription(documentId: string, deps: SeoDeps = defaultDeps): Promise<SeoGeneration> {
  const doc = await deps.load(documentId);
  if (!doc) throw new DocumentNotFoundError('Documento non trovato');

  // Niente `stripGameMeta`: serve al bot per restare nel mondo, ma una meta description descrive la pagina com'è, anche se parla del gioco.
  const text = clipToSentence(doc.text, MAX_SOURCE_CHARS);
  if (text.length < MIN_SEO_SOURCE_CHARS) {
    throw new InsufficientInputError('Il documento ha troppo poco testo per descriverlo: scrivi prima il contenuto.');
  }

  const { system, user } = buildSeoPrompt({ title: doc.title, type: doc.type, text });
  let ms = 0;
  let lastChecks: DraftCheck[] = [];
  for (let attempt = 1; attempt <= MAX_SEO_ATTEMPTS; attempt++) {
    const result = await deps.generate({ system, user, schema: SEO_SCHEMA as unknown as Record<string, unknown>, maxTokens: 200 });
    ms += result.ms;
    const raw = (result.json as { description?: unknown } | null)?.description;
    if (typeof raw !== 'string' || raw.trim() === '') throw new AiGatewayError('Risposta del servizio AI non valida.', 502);

    const description = cleanDraft(raw);
    const { ok, checks } = validateSeoDescription(description, { title: doc.title, source: text });
    lastChecks = checks;
    if (!ok) continue;

    const saved = await deps.save(documentId, description);
    if (!saved) throw new DocumentNotFoundError('Documento non trovato');
    return { description, previous: saved.previous, attempts: attempt, ms };
  }
  throw new SeoChecksFailedError(lastChecks, MAX_SEO_ATTEMPTS);
}
