/**
 * Sezione corrente derivata dal path
 *
 * Sidebar e HamburgerMenu deducevano il tipo con
 * `isOnRegolamento ? 'regolamento' : 'ambientazione'`: un ternario che regge
 * esattamente due tipi e che, al terzo, avrebbe mostrato l'albero
 * dell'ambientazione dentro la sezione del manuale master.
 *
 * @module utils/documentSection
 */

import { DOCUMENT_TYPES, DOCUMENT_TYPE_CONFIGS, type DocumentType } from '@/types/document';

export interface DocumentSection {
  /** Tipo corrente; 'ambientazione' come default sulla home e sui path ignoti. */
  type: DocumentType;
  /** Etichetta della sezione mostrata in cima alla sidebar. */
  label: string;
  /** True sulla sezione preferiti, che non è un tipo di documento. */
  isFavorites: boolean;
}

/** Ricava la sezione dal primo segmento del path (`/regolamento/x/y` → regolamento). */
export function resolveDocumentSection(currentPath: string): DocumentSection {
  if (currentPath.startsWith('/preferiti')) {
    return { type: 'ambientazione', label: 'Preferiti', isFavorites: true };
  }

  const matched = DOCUMENT_TYPES.find((type) => currentPath.startsWith(`/${type}`));
  const type: DocumentType = matched ?? 'ambientazione';

  return {
    type,
    label: DOCUMENT_TYPE_CONFIGS[type].label,
    isFavorites: false,
  };
}
