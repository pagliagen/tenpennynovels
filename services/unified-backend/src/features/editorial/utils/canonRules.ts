import { findAnachronisms } from './anachronisms';

/**
 * Regole di coerenza di canone: funzioni pure su dati già letti, così si provano senza DB.
 * Nessuna usa un modello: sono controlli che una persona potrebbe fare a mano, ma su tutto il
 * materiale. Producono rilievi da guardare, mai correzioni automatiche.
 */

export type Severity = 'error' | 'warning' | 'info';

export interface ReviewDocument {
  _id: string;
  title: string;
  slug: string;
  type: string;
  isDraft: boolean;
  /** Testo senza HTML. */
  text: string;
}

export interface ReviewSubtype {
  _id: string;
  slug: string;
  title: string;
  type: string;
}

export interface ReviewLocation {
  _id: string;
  name: string;
  description: string;
  locationLevel: string;
}

export interface CanonInput {
  documents: ReviewDocument[];
  subtypes: ReviewSubtype[];
  locations: ReviewLocation[];
}

export interface CanonTarget {
  kind: 'location' | 'document' | 'subtype';
  id: string;
  label: string;
  excerpt?: string;
}

export interface CanonFinding {
  code: 'year-mismatch' | 'slug-year-typo' | 'anachronism' | 'empty-document' | 'short-location' | 'duplicate-title';
  severity: Severity;
  title: string;
  detail: string;
  targets: CanonTarget[];
}

export interface CanonReport {
  /** L'anno in cui è ambientato il gioco, ricavato dai documenti (null se non ce n'è uno prevalente). */
  canonYear: number | null;
  findings: CanonFinding[];
  stats: { documents: number; subtypes: number; locations: number; findings: number };
}

/** Un anno vicino al canone citato in un testo del mondo è quasi sempre una svista, uno lontano è storia. */
const NEAR_YEARS = 15;
const MIN_DOCUMENT_CHARS = 80;
export const MIN_LOCATION_DESCRIPTION_CHARS = 120;

const YEAR = /(?<!\d)(1[89]\d{2})(?!\d)/g;
/** Anno detto come «presente»: «nell'anno 1889», «anno 1889». */
const PRESENT_YEAR = /(?:nell['’]\s?)?\banno\s+(1[89]\d{2})\b/gi;

function around(text: string, at: number, length: number): string {
  return text.slice(Math.max(0, at - 50), at + length + 50).replace(/\s+/g, ' ').trim();
}

/** L'anno più citato nei documenti di ambientazione; a parità, il più recente. */
export function detectCanonYear(documents: readonly ReviewDocument[]): number | null {
  const counts = new Map<number, number>();
  for (const doc of documents) {
    if (doc.type !== 'ambientazione') continue;
    for (const match of doc.text.matchAll(YEAR)) {
      const year = Number(match[1]);
      counts.set(year, (counts.get(year) ?? 0) + 1);
    }
  }
  let best: number | null = null;
  for (const [year, n] of counts) {
    if (best === null || n > counts.get(best)! || (n === counts.get(best) && year > best)) best = year;
  }
  // Un solo accenno a un anno non fa un canone.
  return best !== null && counts.get(best)! >= 3 ? best : null;
}

function isNear(year: number, canon: number): boolean {
  return year !== canon && Math.abs(year - canon) <= NEAR_YEARS;
}

export function findYearMismatches(canon: number, input: CanonInput): CanonFinding[] {
  const targets: CanonTarget[] = [];

  for (const loc of input.locations) {
    for (const match of loc.description.matchAll(YEAR)) {
      if (isNear(Number(match[1]), canon)) {
        targets.push({ kind: 'location', id: loc._id, label: loc.name, excerpt: around(loc.description, match.index ?? 0, 4) });
      }
    }
  }
  for (const doc of input.documents) {
    for (const match of doc.text.matchAll(PRESENT_YEAR)) {
      if (isNear(Number(match[1]), canon)) {
        targets.push({ kind: 'document', id: doc._id, label: doc.title, excerpt: around(doc.text, match.index ?? 0, match[0].length) });
      }
    }
  }
  if (targets.length === 0) return [];
  return [{
    code: 'year-mismatch',
    severity: 'warning',
    title: `Anno diverso dal canone (${canon})`,
    detail: `I documenti ambientano il gioco nel ${canon}. Questi testi citano un anno vicino ma diverso: se non è un riferimento storico voluto, va corretto.`,
    targets,
  }];
}

const sortedDigits = (n: number): string => String(n).split('').sort().join('');

export function findSlugYearTypos(canon: number, input: CanonInput): CanonFinding[] {
  const targets: CanonTarget[] = [];
  const check = (kind: CanonTarget['kind'], id: string, label: string, slug: string, title: string): void => {
    for (const source of [slug, title]) {
      for (const match of source.matchAll(/(?<!\d)(\d{4})(?!\d)/g)) {
        const year = Number(match[1]);
        // Stesse cifre dell'anno canonico in ordine diverso: 1985 invece di 1895.
        if (year !== canon && sortedDigits(year) === sortedDigits(canon)) {
          targets.push({ kind, id, label, excerpt: `${source} (probabile ${canon})` });
          return;
        }
      }
    }
  };
  for (const sub of input.subtypes) check('subtype', sub._id, sub.title, sub.slug, sub.title);
  for (const doc of input.documents) check('document', doc._id, doc.title, doc.slug, doc.title);
  if (targets.length === 0) return [];
  return [{
    code: 'slug-year-typo',
    severity: 'warning',
    title: 'Anno con cifre scambiate in titolo o slug',
    detail: `Stesse cifre del ${canon} in ordine diverso: probabile refuso. Se è nello slug fa parte dell'URL pubblico: cambiarlo rompe i link esistenti (non c'è un redirect).`,
    targets,
  }];
}

export function findAnachronismFindings(input: CanonInput): CanonFinding[] {
  const targets: CanonTarget[] = [];
  const words = new Set<string>();
  for (const loc of input.locations) {
    for (const hit of findAnachronisms(loc.description)) {
      words.add(hit.word);
      targets.push({ kind: 'location', id: loc._id, label: loc.name, excerpt: hit.excerpt });
    }
  }
  for (const doc of input.documents) {
    for (const hit of findAnachronisms(doc.text)) {
      words.add(hit.word);
      targets.push({ kind: 'document', id: doc._id, label: doc.title, excerpt: hit.excerpt });
    }
  }
  if (targets.length === 0) return [];
  return [{
    code: 'anachronism',
    severity: 'warning',
    title: `Parole anacronistiche: ${[...words].sort().join(', ')}`,
    detail: 'Termini che nel 1895 non esistono. Verifica il contesto: a volte sono spiegazioni per il giocatore, non descrizioni del mondo.',
    targets,
  }];
}

export function findEmptyDocuments(input: CanonInput): CanonFinding[] {
  const empty = input.documents.filter((d) => d.text.trim().length < MIN_DOCUMENT_CHARS);
  if (empty.length === 0) return [];
  return [{
    code: 'empty-document',
    severity: 'warning',
    title: 'Documenti vuoti o quasi',
    detail: `Meno di ${MIN_DOCUMENT_CHARS} caratteri di testo: non producono sezioni nella ricerca e non servono né ai giocatori né al bot.`,
    targets: empty.map((d) => ({
      kind: 'document' as const, id: d._id, label: d.title,
      excerpt: `${d.text.trim().length} caratteri${d.isDraft ? ' (bozza)' : ''}`,
    })),
  }];
}

export function findShortLocations(input: CanonInput): CanonFinding[] {
  const short = input.locations.filter((l) => l.locationLevel === 'location' && l.description.trim().length < MIN_LOCATION_DESCRIPTION_CHARS);
  if (short.length === 0) return [];
  return [{
    code: 'short-location',
    severity: 'info',
    title: `${short.length} luoghi con descrizione sotto i ${MIN_LOCATION_DESCRIPTION_CHARS} caratteri`,
    detail: 'Il bot, la mappa e la ricerca sanno poco di questi luoghi. Candidati per una descrizione più ricca (suggerimento AI nella scheda della location).',
    targets: short.map((l) => ({ kind: 'location' as const, id: l._id, label: l.name, excerpt: `${l.description.trim().length} caratteri` })),
  }];
}

const normalizeTitle = (t: string): string => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function findDuplicateTitles(input: CanonInput): CanonFinding[] {
  const groups = new Map<string, ReviewDocument[]>();
  for (const doc of input.documents) {
    const key = `${doc.type}::${normalizeTitle(doc.title)}`;
    groups.set(key, [...(groups.get(key) ?? []), doc]);
  }
  const targets = [...groups.values()].filter((g) => g.length > 1).flat()
    .map((d) => ({ kind: 'document' as const, id: d._id, label: d.title, excerpt: d.slug }));
  if (targets.length === 0) return [];
  return [{ code: 'duplicate-title', severity: 'info', title: 'Documenti con lo stesso titolo', detail: 'Stesso titolo nello stesso tipo: facile confonderli e farli rispondere alla stessa ricerca.', targets }];
}

const ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

export function buildCanonReport(input: CanonInput): CanonReport {
  const canonYear = detectCanonYear(input.documents);
  const findings = [
    ...(canonYear !== null ? [...findYearMismatches(canonYear, input), ...findSlugYearTypos(canonYear, input)] : []),
    ...findAnachronismFindings(input),
    ...findEmptyDocuments(input),
    ...findShortLocations(input),
    ...findDuplicateTitles(input),
  ].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

  return {
    canonYear,
    findings,
    stats: { documents: input.documents.length, subtypes: input.subtypes.length, locations: input.locations.length, findings: findings.length },
  };
}
