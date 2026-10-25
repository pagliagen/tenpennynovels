/** Rapporto di revisione di canone (`GET /admin/editorial/canon-check`). */

export type CanonSeverity = 'error' | 'warning' | 'info';

export type CanonTargetKind = 'location' | 'document' | 'subtype';

export interface CanonTarget {
  kind: CanonTargetKind;
  id: string;
  label: string;
  excerpt?: string;
}

export interface CanonFinding {
  code: string;
  severity: CanonSeverity;
  title: string;
  detail: string;
  targets: CanonTarget[];
}

export interface CanonReport {
  /** Anno in cui è ambientato il gioco, ricavato dai documenti; null se non ce n'è uno prevalente. */
  canonYear: number | null;
  findings: CanonFinding[];
  stats: { documents: number; subtypes: number; locations: number; findings: number };
}

/** Un controllo deterministico sulla bozza del modello (`POST /admin/editorial/ai/locations/:id/suggest-description`). */
export interface DraftCheck {
  code: 'length' | 'year' | 'anachronism' | 'foreign-words' | 'unknown-name' | 'lost-facts' | 'game-meta';
  ok: boolean;
  detail?: string;
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
  tags: string[];
  ms: number;
}

