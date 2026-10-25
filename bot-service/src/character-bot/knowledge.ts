/**
 * Cosa il bot sa del mondo: luoghi e ambientazione, interrogati al bisogno invece di
 * lasciare che il modello li inventi. Come per il meteo (environment.ts) il confine di
 * riservatezza sta nel backend (`/internal/bot-chat/knowledge`: mai luoghi privati,
 * solo ambientazione pubblicata); qui si decide cosa mostrare al modello e come.
 */
export interface LocationTagOption {
  tag: string;
  label: string;
  /** Cosa significa, in parole di chi cerca il luogo: finisce nel prompt dell'analisi. */
  hint: string;
}

/** Ciò che il giocatore sta chiedendo, riconosciuto dall'analisi del messaggio. */
export interface InfoRequest {
  tags: string[];
  /** Nome di un luogo preciso, solo se compare nel testo del giocatore. */
  placeName: string | null;
  needsLore: boolean;
}

export interface KnownPlace {
  name: string;
  district: string | null;
  quartiere: string | null;
  description: string;
  tags: string[];
  proximity: 'here' | 'near' | 'far';
  isCurrent: boolean;
}

export interface BotKnowledge {
  places: KnownPlace[];
  lore: { covered: boolean; passages: { title: string; heading: string; text: string; score: number }[] };
}

export const NO_REQUEST: InfoRequest = { tags: [], placeName: null, needsLore: false };

export function hasRequest(r: InfoRequest | null | undefined): r is InfoRequest {
  return !!r && (r.tags.length > 0 || !!r.placeName || r.needsLore);
}

/**
 * L'analisi propone, il codice verifica: i tag devono stare nell'elenco, il nome del
 * luogo deve comparire davvero nel testo del giocatore (come per il nome della persona).
 */
export function validateInfoRequest(raw: unknown, tags: readonly string[], playerText: string): InfoRequest {
  const r = (raw ?? {}) as { tags?: unknown; placeName?: unknown; needsLore?: unknown };
  const picked = (Array.isArray(r.tags) ? r.tags : []).filter((t): t is string => typeof t === 'string' && tags.includes(t));
  const place = typeof r.placeName === 'string' ? r.placeName.trim() : '';
  const inText = place.length >= 3 && playerText.toLowerCase().includes(place.toLowerCase());
  return { tags: [...new Set(picked)].slice(0, 3), placeName: inText ? place : null, needsLore: r.needsLore === true };
}

const WHERE: Record<KnownPlace['proximity'], string> = {
  here: 'qui vicino, nel tuo quartiere: lo conosci bene',
  near: 'nel tuo distretto: lo conosci abbastanza',
  far: 'dall\'altra parte della città: ne hai solo sentito parlare, non sai com\'è fatto né dove di preciso',
};

const RULES =
  'Nomina SOLO i luoghi elencati qui o già citati nella chat: non esistono altre locande, vie, parchi o persone. ' +
  'Se ciò che cercano non è in elenco, dì in carattere che non ne sai niente. Non inventare indirizzi, prezzi, orari o stanze libere.';

/**
 * Il blocco di prompt. `knowledge` null = il backend non ha risposto: il bot ammette di non
 * saperlo invece di tirare a indovinare.
 */
export function knowledgeLines(request: InfoRequest, knowledge: BotKnowledge | null): string[] {
  if (!hasRequest(request)) return [];
  if (!knowledge) return ['Non riesci a ricordare niente di preciso in questo momento: dillo, in carattere, senza inventare luoghi o storie.'];

  const lines: string[] = [];
  const wantsPlaces = request.tags.length > 0 || !!request.placeName;

  if (wantsPlaces) {
    if (knowledge.places.length === 0) {
      lines.push('Non conosci nessun posto che corrisponda a ciò che cercano.');
    } else {
      lines.push('Luoghi che conosci:');
      for (const p of knowledge.places) {
        const where = [p.quartiere, p.district].filter(Boolean).join(', ');
        if (p.isCurrent) lines.push(`- ${p.name}: è questo stesso locale. ${p.description}`);
        else if (p.proximity === 'far') lines.push(`- ${p.name} (${where}): ${WHERE.far}.`);
        else lines.push(`- ${p.name} (${where}), ${WHERE[p.proximity]}. ${p.description}`);
      }
    }
  }

  if (request.needsLore) {
    if (knowledge.lore.covered) {
      lines.push('Cose che sai o che hai sentito dire:');
      for (const p of knowledge.lore.passages) lines.push(`- ${p.heading || p.title}: ${p.text}`);
      lines.push('Riportale a modo tuo, in poche frasi, senza citare documenti e senza aggiungere dettagli che non ci sono. Se non bastano a rispondere, dì che non sai altro.');
    } else {
      lines.push('Su questo argomento non sai niente di preciso: dillo, in carattere, senza inventare.');
    }
  }

  lines.push(RULES);
  return lines;
}

/** Le parole che il blocco autorizza (nomi di luoghi e distretti): per il controllo sui nomi inventati. */
export function knowledgeVocabulary(knowledge: BotKnowledge | null): string[] {
  if (!knowledge) return [];
  return knowledge.places.flatMap((p) => [p.name, p.district ?? '', p.quartiere ?? '']).filter(Boolean);
}
