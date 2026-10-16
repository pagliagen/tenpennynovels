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

import { DOCUMENT_TYPES, DOCUMENT_TYPE_CONFIGS, PUBLIC_DOCUMENT_TYPES, type DocumentType } from '@/types/document';

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

/**
 * Tipo a cui limitare ricerca e Bibliotecario per il path corrente.
 *
 * Chi sta leggendo l'ambientazione non deve ricevere risposte pescate dal
 * regolamento (e viceversa): sono due corpus con registri diversi, e il
 * modello li fonde in una risposta che non è vera in nessuno dei due.
 * Fuori da una sezione pubblica (home, preferiti, manuale-master, che non è
 * indicizzato) non c'è scope: si cerca su tutto, come prima.
 * Accetta anche `asPath` con query string o hash.
 */
export function searchScopeForPath(currentPath: string): DocumentType | undefined {
  const pathname = currentPath.split(/[?#]/)[0] ?? '';
  return PUBLIC_DOCUMENT_TYPES.find((type) => pathname === `/${type}` || pathname.startsWith(`/${type}/`));
}
