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
  /** Riassunto breve (2-3 frasi) di cosa è successo tra loro: la memoria oltre la chat recente. */
  summary?: string;
  /** L'ultimo fatto emotivamente rilevante, in una frase ("lo ha insultato"). */
  lastEvent?: string;
}

/** Come appare un personaggio a chi lo guarda: solo ciò che la scheda dichiara pubblico. */
export interface Appearance {
  gender?: 'male' | 'female';
  /** Età apparente, non quella reale. */
  apparentAge?: number;
  physicalDescription?: string;
  publicDescription?: string;
  height?: string;
  hairColor?: string;
  eyeColor?: string;
  visibleMarks?: string;
}

export interface Scores {
  trust: number;
  respect: number;
  suspicion: number;
}

/** Cosa la scheda del bot dice di una persona: rapporto autorato + categorie che le corrispondono. */
export interface Stance {
  /** C'è un rapporto autorato con questa persona precisa. */
  authored: boolean;
  label?: string;
  backstory?: string;
  hints: string[];
  /** Il bot la conosce già per nome. */
  knowsName: boolean;
  /** Quanto sposta l'umore mentre le parla. */
  moodOffset: Pad;
  /** Punteggi di partenza al posto di quelli da sconosciuto. */
  initial?: Partial<Scores>;
  /** Spostamenti dovuti alle categorie. */
  shift: Scores;
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
