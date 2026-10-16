/**
 * Stato mostrato nei Presenti: disponibilità a giocare + motivazione libera.
 * Validazione pura (nessun I/O) per poterla testare senza server.
 */

export const MAX_PRESENCE_REASON_LENGTH = 80;

export interface PresenceStatusInput {
  availableToPlay: boolean;
  reason: string;
}

export type PresenceStatusParseResult =
  | { ok: true; value: PresenceStatusInput }
  | { ok: false; error: string };

// Caratteri di controllo (a-capo e tab inclusi: la motivazione è una riga sola),
// zero-width e override della direzione del testo (spoofing visivo)
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS =
  /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2066-\u2069\uFEFF]/g;

export function parsePresenceStatus(body: unknown): PresenceStatusParseResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Dati dello stato non validi' };
  }
  const { availableToPlay, reason } = body as Record<string, unknown>;

  if (typeof availableToPlay !== 'boolean') {
    return { ok: false, error: 'availableToPlay deve essere vero o falso' };
  }
  if (reason !== undefined && typeof reason !== 'string') {
    return { ok: false, error: 'La motivazione deve essere un testo' };
  }

  const cleaned = (reason ?? '').replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length > MAX_PRESENCE_REASON_LENGTH) {
    return {
      ok: false,
      error: `La motivazione non può superare ${MAX_PRESENCE_REASON_LENGTH} caratteri`
    };
  }

  return { ok: true, value: { availableToPlay, reason: cleaned } };
}
