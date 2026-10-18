/** Piacere, Attivazione, Dominanza: ciascuno in -1..1 (modello PAD). */
export interface Pad {
  p: number;
  a: number;
  d: number;
}

/** Umore del bot, uno solo (non dipende dall'interlocutore). */
export interface MoodState {
  botId: string;
  pad: Pad;
  updatedAt: Date;
}

/** Cosa il bot sa e pensa di un giocatore. Punteggi 0-100. */
export interface Relation {
  botId: string;
  playerId: string;
  /** Ultimo nome visibile in chat: serve solo a leggere il DB, il bot NON lo usa. */
  playerName: string;
  trust: number;
  respect: number;
  suspicion: number;
  interactions: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  /** Il nome che il giocatore ha detto di sé. Assente finché non si è presentato. */
  knownName?: string;
  /** Cose apprese su di lui, brevi (max 8). */
  facts: string[];
}

export interface PadDelta {
  p: number;
  a: number;
  d: number;
}

export interface RelationDelta {
  trust: number;
  respect: number;
  suspicion: number;
}
