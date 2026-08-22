/**
 * Sessione personaggio (per-tab)
 *
 * Il `sessionId` identifica il PERSONAGGIO, non l'utente, e determina permessi
 * come la lettura del Manuale Master. Arriva come query param `?sessionId=`
 * dal link nella TopBar del gioco (origin diverso: sessionStorage non è
 * condiviso) e va persistito in `sessionStorage`, che è per-tab — su
 * `localStorage` due tab si ruberebbero il personaggio a vicenda.
 *
 * Perché la lettura dall'URL sta qui e non solo in `_app`:
 * `AuthInitializer` è un DISCENDENTE di `App`, e React esegue gli effect dei
 * figli prima di quelli del padre. Il `GET /auth/session` di `useAuth` partiva
 * quindi prima che l'effect di `_app` avesse scritto il sessionId, e senza
 * header il backend non restituisce `gamePermissions`. Peggio: quell'effect
 * gira una sola volta, quindi i permessi restavano vuoti per tutta la visita e
 * la tab del Manuale Master non compariva mai — nemmeno per un gestore.
 * Leggere dall'URL come fallback rende la cosa indipendente dall'ordine degli
 * effect e da `router.isReady`.
 *
 * @module lib/characterSession
 */

import { logger } from '@/lib/logger';

const STORAGE_KEY = 'character_session_id';

/** Legge il sessionId dalla query string corrente, senza passare dal router. */
function readSessionIdFromUrl(): string | null {
  try {
    const value = new URLSearchParams(window.location.search).get('sessionId');
    return value && value.trim().length > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * sessionId del personaggio attivo in questo tab.
 *
 * Se non è ancora in sessionStorage lo recupera dall'URL e lo persiste, così
 * la PRIMA richiesta dopo il redirect dal gioco porta già l'header.
 * Restituisce null lato server e quando sessionStorage è inaccessibile
 * (Safari in navigazione privata, cookie di terze parti bloccati).
 */
export function getCharacterSessionId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return stored;

    const fromUrl = readSessionIdFromUrl();
    if (fromUrl) {
      sessionStorage.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }

    return null;
  } catch (error) {
    logger.debug('[characterSession] sessionStorage non accessibile', { error });
    return readSessionIdFromUrl();
  }
}

/** True se in questo tab c'è un personaggio selezionato. */
export function hasCharacterSession(): boolean {
  return getCharacterSessionId() !== null;
}

/**
 * Propaga `?sessionId=` attraverso una redirect di getServerSideProps.
 *
 * Il link nella TopBar del gioco punta alla ROOT di documenti con
 * `?sessionId=`, e la root (come /ambientazione e /regolamento) fa una
 * redirect SSR verso il primo documento foglia. Una redirect di Next non
 * conserva la query string: il sessionId veniva perso lato server, prima che
 * qualunque JS client potesse leggerlo, quindi in quel tab non c'era MAI un
 * personaggio — la tab del Manuale Master non compariva nemmeno a un gestore.
 *
 * Il bug era latente da prima: su documenti nessuna feature usava il
 * personaggio (i preferiti sono a livello account), quindi non si notava.
 */
export function withSessionId(
  destination: string,
  query: Partial<Record<string, string | string[]>>
): string {
  const sessionId = query.sessionId;
  if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    return destination;
  }

  const separator = destination.includes('?') ? '&' : '?';
  return `${destination}${separator}sessionId=${encodeURIComponent(sessionId)}`;
}
