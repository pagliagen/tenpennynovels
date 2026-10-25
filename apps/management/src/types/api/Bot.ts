/** Bot di chat (strumento da sviluppo, tab «Bot» della lista personaggi). Forma di `GET/POST /admin/bots`. */

export interface BotRow {
  name: string;
  characterId: string;
  locationId: string | null;
  locationName: string | null;
  file: string;
  /** Il servizio dei bot lo ha caricato (si legge solo all'avvio e dopo «Crea»). */
  active: boolean;
  /** Stato del personaggio nel game (`approved`...). */
  playerStatus: string | null;
}

export interface BotCharacterFields {
  name: string;
  firstName: string;
  surname: string;
  gender: 'male' | 'female';
  age: number;
  apparentAge: number;
  height: string;
  eyeColor: string;
  hairColor: string;
  visibleMarks: string;
  physicalDescription: string;
  publicDescription: string;
}

export interface BotPsyche {
  ocean: { O: number; C: number; E: number; A: number; N: number };
  enneagram: { type: number; fear: string; desire: string };
  pad: { p: number; a: number; d: number };
}

export interface BotDraft {
  character: BotCharacterFields;
  persona: string;
  psyche: BotPsyche;
}

export interface BotDraftCheck {
  code: string;
  ok: boolean;
  detail?: string;
}

export interface BotDesignResult {
  /** null = nessuna scheda leggibile dopo i tentativi: ci sono solo i controlli falliti. */
  draft: BotDraft | null;
  checks: BotDraftCheck[];
  attempts: number;
  ms: number;
}

export interface BotDesignRequest {
  locationId: string;
  description: string;
}

export interface CreatedBot {
  characterId: string;
  file: string;
  /** false = bot creato ma il servizio non si è ricaricato: parte al prossimo riavvio. */
  reloaded: boolean;
}
