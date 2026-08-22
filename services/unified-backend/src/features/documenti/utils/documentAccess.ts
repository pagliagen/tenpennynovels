/**
 * Controllo di accesso per tipo di documento
 *
 * Unico punto in cui si decide quali `type` un richiedente può leggere.
 * Ogni percorso di lettura pubblica (dettaglio, liste, ricerca full-text,
 * ricerca semantica, preferiti) deve passare da qui: è la differenza fra
 * "il manuale master non compare" e "il manuale master non compare tranne
 * nel canale che ci siamo dimenticati".
 *
 * Default-deny: si parte dai tipi pubblici e si aggiunge quello riservato
 * solo se il personaggio ha il permesso.
 *
 * Il permesso è valutato con hasGamePermission(), non con
 * requireGameplayRoles(): hasGamePermission risolve già lo stato del
 * personaggio (un draft/pending non eredita i permessi di ruolo, e il bypass
 * gestore è dormiente finché non è approvato — vedi config/permissions/game.ts).
 *
 * @module features/documenti/utils/documentAccess
 */

import type { Request } from 'express';

import { GamePermissions, hasGamePermission } from '@config/permissions';

import {
  PUBLIC_DOCUMENT_TYPE_LIST,
  ALL_DOCUMENT_TYPE_LIST,
  isDocumentType,
  isRestrictedDocumentType,
  type DocumentType,
} from '../constants/documentTypes';

/**
 * True se il richiedente può leggere i tipi riservati (manuale master).
 * Richiede il contesto personaggio (header X-Session-Id): il ruolo master vive
 * sul personaggio, non sull'utente, quindi il solo cookie JWT non basta.
 */
export function canReadRestrictedDocuments(req: Request): boolean {
  const character = req.character;
  if (!character) return false;

  return hasGamePermission(
    GamePermissions.DOCUMENTS_MASTER_MANUAL_READ,
    character.playerStatus || 'draft',
    character.isGestore || false,
    character.gameplayRoles || [],
    character.characterPermissions || []
  );
}

/** Elenco dei `type` leggibili dal richiedente. */
export function readableDocumentTypes(req: Request): DocumentType[] {
  return canReadRestrictedDocuments(req)
    ? [...ALL_DOCUMENT_TYPE_LIST]
    : [...PUBLIC_DOCUMENT_TYPE_LIST];
}

/** True se il richiedente può leggere quello specifico `type`. */
export function canReadDocumentType(req: Request, type: string): boolean {
  if (!isRestrictedDocumentType(type)) return true;
  return canReadRestrictedDocuments(req);
}

/**
 * Applica il vincolo di tipo a un filtro Mongoose.
 *
 * - `requestedType` valido e leggibile → filtra su quello
 * - `requestedType` assente o non valido → `$in` sui soli tipi leggibili
 * - `requestedType` riservato senza permesso → `$in` sui tipi pubblici
 *   (la lista non espone l'esistenza del tipo; il 403 esplicito lo dà il
 *   dettaglio, dove l'utente ha chiesto una risorsa precisa)
 */
export function applyReadableTypeFilter(
  filter: Record<string, unknown>,
  req: Request,
  requestedType?: unknown
): void {
  const readable = readableDocumentTypes(req);

  if (isDocumentType(requestedType) && readable.includes(requestedType)) {
    filter.type = requestedType;
    return;
  }

  filter.type = { $in: readable };
}
