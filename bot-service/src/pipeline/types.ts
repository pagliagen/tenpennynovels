import type { BotConfig, Psyche } from '../config';
import type { Pad, Relation } from '../psyche/types';
import type { HistoryLine } from '../prompt';

/** Tutto ciò che gli step conoscono di questo turno. Qui si aggiungono umore e rapporto. */
export interface TurnContext {
  bot: BotConfig;
  history: HistoryLine[];
  /** Ultime battute dello stesso bot, per rilevare le ripetizioni. */
  previousOwn: string[];
  /** Testo da cui un nome può legittimamente venire (persona + chat). */
  knownText: string;
  psyche: Psyche;
  /** Umore attuale (già decaduto verso la base). */
  mood: Pad;
  /** Cosa il bot sa dell'interlocutore; null se è la prima volta. */
  relation: Relation | null;
  /** Sezioni di prompt su carattere, umore e rapporto (psyche/blocks.ts). */
  psycheLines: string[];
  /** Il genere dell'interlocutore è noto (campo pubblico della scheda): se no, il bot lo evita. */
  genderKnown?: boolean;
  /** Nome dell'interlocutore solo se si è presentato; altrimenti assente. */
  otherName?: string;
}

/** La scaletta prodotta dal primo step. */
export interface Plan {
  /** Cosa ha detto o fatto l'altro, in una frase. */
  reaction: string;
  /** Cosa dire o fare, in ordine. */
  points: string[];
  tone: string;
}

export interface StepTrace {
  step: string;
  ms: number;
}
