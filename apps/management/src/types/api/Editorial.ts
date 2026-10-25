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
