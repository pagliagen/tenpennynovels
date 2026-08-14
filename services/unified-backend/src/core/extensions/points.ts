/**
 * Contratti dei punti di estensione.
 *
 * Una voce si aggiunge qui SOLO nel momento in cui una fase del refactor
 * introduce un extension point reale, leggendo il payload dal codice che
 * lo emette davvero — vedi docs/refactor/FEATURE-MODULES-PLAN.md.
 *
 * Interfacce non-vuote da qui in poi accettano solo le chiavi elencate:
 * niente index signature, `keyof HookMap`/`keyof FilterMap` restano un
 * union esplicito di stringhe letterali, non `string`.
 */

/** Frammento di documento usato come contesto per una domanda al Bibliotecario. */
export interface ContextChunk {
  heading: string;
  content: string;
  source: {
    documentId?: string;
    slug?: string;
    fullPath?: string;
    title?: string;
    subtypeTitle?: string;
  };
}

/**
 * Vista ristretta sullo stream SSE già aperto dal chiamante: una feature
 * può solo inviare eventi, mai chiudere lo stream (invariante "chi apre
 * lo stream lo chiude" — vedi FEATURE-MODULES-PLAN.md §7).
 */
export interface SseWriter {
  send(event: string, data: unknown): void;
}

/** Extension point di sola notifica: nessun valore di ritorno, un errore in un handler non blocca il core. */
export interface HookMap {
  /**
   * Fase 2 (bibliotecario). Il core ha già inviato l'evento 'results' sullo
   * stream SSE della ricerca documenti; un handler può inviare eventi
   * aggiuntivi sullo stesso stream ma non deve mai chiamare res.end() —
   * resta il core a mandare 'complete' e chiudere, dopo che emit() risolve.
   */
  'documents.search.stream': {
    question: string;
    chunks: ContextChunk[];
    sse: SseWriter;
    signal: AbortSignal;
  };

  /**
   * Fase 7.2 (consolidamento core). Character.ts (core) ha già salvato il
   * documento (emesso da post('save'), non da pre('save') — il personaggio
   * è già persistito quando l'handler gira) con playerStatus appena
   * transitato a 'pending'. tickets si registra qui per creare il ticket
   * character_approval + notificare lo staff, invece di un import statico
   * di una feature dentro core.
   */
  'character.playerStatus.pending': {
    characterId: string;
    characterName: string;
    characterAvatar?: string;
  };
}

/**
 * Extension point di trasformazione: riceve un valore, ne restituisce uno,
 * eseguiti in sequenza per priorità.
 */
export interface FilterMap {
  /** Fase 2 (bibliotecario). Se nessuna feature registrata lo modifica, resta il valore di default passato dal chiamante. */
  'documents.search.capabilities': {
    value: { aiAvailable: boolean };
    ctx: { userId?: string };
  };
}
