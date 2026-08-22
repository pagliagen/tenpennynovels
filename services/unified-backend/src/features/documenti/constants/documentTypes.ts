/**
 * Document types — sorgente unica di verità
 *
 * Prima esisteva solo l'array letterale ['ambientazione', 'regolamento'],
 * duplicato in 8 punti fra controller e route. Con l'aggiunta di
 * 'manuale-master', che è a lettura riservata, quella duplicazione smette di
 * essere un fastidio stilistico e diventa un rischio: basta dimenticare un
 * call site perché un documento riservato compaia in una lista pubblica.
 *
 * Regola: in ogni percorso di lettura pubblica si parte da
 * PUBLIC_DOCUMENT_TYPES (default-deny). Il tipo riservato entra solo dietro
 * una guardia esplicita di permesso.
 *
 * @module features/documenti/constants/documentTypes
 */

/** Tipi leggibili da chiunque (compatibilmente con isPublic/visible/isDraft). */
export const PUBLIC_DOCUMENT_TYPES = ['ambientazione', 'regolamento'] as const;

/** Tipi a lettura riservata: richiedono un permesso dedicato. */
export const RESTRICTED_DOCUMENT_TYPES = ['manuale-master'] as const;

export const ALL_DOCUMENT_TYPES = [
  ...PUBLIC_DOCUMENT_TYPES,
  ...RESTRICTED_DOCUMENT_TYPES,
] as const;

export type PublicDocumentType = (typeof PUBLIC_DOCUMENT_TYPES)[number];
export type RestrictedDocumentType = (typeof RESTRICTED_DOCUMENT_TYPES)[number];
export type DocumentType = (typeof ALL_DOCUMENT_TYPES)[number];

/**
 * Mutabili e tipizzate: gli enum Mongoose e i filtri `$in` non accettano
 * readonly array, e con strict typing rifiutano `string[]` su un campo il cui
 * enum è una union di letterali.
 */
export const PUBLIC_DOCUMENT_TYPE_LIST: PublicDocumentType[] = [...PUBLIC_DOCUMENT_TYPES];
export const ALL_DOCUMENT_TYPE_LIST: DocumentType[] = [...ALL_DOCUMENT_TYPES];

/**
 * Type guard su un tipo qualsiasi (pubblico o riservato).
 * Il `typeof value === 'string'` esplicito serve anche a CodeQL (CWE-943):
 * includes() su stringhe letterali non combacerebbe mai con un oggetto, ma
 * senza il check l'analisi statica non lo dimostra.
 */
export function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' && (ALL_DOCUMENT_TYPE_LIST as readonly string[]).includes(value);
}

/** Type guard sui soli tipi a lettura libera. */
export function isPublicDocumentType(value: unknown): value is PublicDocumentType {
  return typeof value === 'string' && (PUBLIC_DOCUMENT_TYPE_LIST as readonly string[]).includes(value);
}

/** True se il tipo richiede il permesso di lettura riservata. */
export function isRestrictedDocumentType(value: unknown): value is RestrictedDocumentType {
  return typeof value === 'string' && (RESTRICTED_DOCUMENT_TYPES as readonly string[]).includes(value);
}
