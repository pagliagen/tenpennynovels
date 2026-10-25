/**
 * Registro unico dei tag delle location: elenco CHIUSO. Lo usano il modello, il
 * gestionale (`GET /admin/locations/tags`) e il bot (`/internal/bot-chat/knowledge/tags`),
 * che lo passa al modello come enum: un tag fuori elenco non può esistere.
 * `hint` dice cosa significa il tag, in parole di chi cerca il luogo (finisce nel prompt del bot).
 */
export const LOCATION_TAG_DEFS = {
  alloggio: { label: 'Alloggio', hint: 'dove dormire: locande con camere, affittacamere, alberghi, pensioni' },
  taverna: { label: 'Taverna / pub', hint: 'dove bere e stare in compagnia: taverne, pub, birrerie' },
  ristorazione: { label: 'Ristorazione', hint: 'dove mangiare: trattorie, caffè, mense, venditori di cibo' },
  mercato: { label: 'Mercato', hint: 'mercati, bancarelle, dove comprare merce varia' },
  negozio: { label: 'Negozi', hint: 'botteghe, negozi, dove comprare qualcosa di specifico' },
  chiesa: { label: 'Luogo di culto', hint: 'chiese, cattedrali, abbazie, dove pregare o parlare con un religioso' },
  parco: { label: 'Parco / verde', hint: 'parchi, giardini, laghi, dove passeggiare all\'aperto' },
  teatro: { label: 'Teatro / spettacolo', hint: 'teatri, opera, spettacoli' },
  museo: { label: 'Cultura / museo', hint: 'musei, biblioteche, luoghi di studio e cultura' },
  banca: { label: 'Banca / finanza', hint: 'banche, borsa, dove cambiare o depositare denaro' },
  istituzione: { label: 'Istituzione', hint: 'governo, tribunali, municipio, uffici pubblici' },
  polizia: { label: 'Polizia', hint: 'polizia, Scotland Yard, dove denunciare o cercare un agente' },
  ospedale: { label: 'Medico / ospedale', hint: 'medici, ospedali, dove farsi curare' },
  trasporti: { label: 'Trasporti', hint: 'stazioni, ponti, traghetti, dove prendere un treno o attraversare il fiume' },
  porto: { label: 'Porto / moli', hint: 'moli, docks, magazzini, navi e lavoro sul fiume' },
  club: { label: 'Club / salotto', hint: 'club privati, salotti, luoghi per gentiluomini' },
  residenza: { label: 'Residenza', hint: 'quartieri residenziali, case e palazzi in cui si abita' },
  strada: { label: 'Strada / piazza', hint: 'vie, piazze e luoghi di passaggio' },
} as const;

export type LocationTag = keyof typeof LOCATION_TAG_DEFS;

export const LOCATION_TAGS = Object.keys(LOCATION_TAG_DEFS) as LocationTag[];

export function isLocationTag(value: unknown): value is LocationTag {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LOCATION_TAG_DEFS, value);
}

/**
 * Normalizza l'input del gestionale: toglie spazi e doppioni, scarta ciò che non è
 * nel registro (e lo restituisce in `invalid`, per rispondere 400 con il nome sbagliato).
 */
export function sanitizeLocationTags(input: unknown): { tags: LocationTag[]; invalid: string[] } {
  const list = Array.isArray(input) ? input : [];
  const tags: LocationTag[] = [];
  const invalid: string[] = [];
  for (const raw of list) {
    const value = typeof raw === 'string' ? raw.trim().toLowerCase() : String(raw);
    if (isLocationTag(value)) {
      if (!tags.includes(value)) tags.push(value);
    } else {
      invalid.push(String(raw));
    }
  }
  return { tags, invalid };
}

export function locationTagList(): { tag: LocationTag; label: string; hint: string }[] {
  return LOCATION_TAGS.map((tag) => ({ tag, ...LOCATION_TAG_DEFS[tag] }));
}
