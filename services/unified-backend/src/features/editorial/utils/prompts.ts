import { locationTagList, LOCATION_TAGS } from '@core/location/constants/locationTags';
import { SEO_MAX_CHARS, SEO_MIN_CHARS, MAX_DESCRIPTION_CHARS, MIN_DESCRIPTION_CHARS, MAX_POSITIONS, MAX_POSITION_DESCRIPTION_CHARS, MAX_POSITION_NAME_CHARS } from './validators';

/**
 * Prompt per il gateway AI. **Solo contenuti già pubblici**: nome, quartiere e distretto, tag,
 * descrizione attuale, estratti dell'ambientazione pubblicata, due descrizioni esistenti come stile.
 * Mai chat, descrizioni private o dati dei personaggi: i prompt transitano da un tunnel esterno.
 */

export interface LocationPromptContext {
  name: string;
  quartiere: string | null;
  district: string | null;
  tagLabels: string[];
  currentDescription: string;
  /** Nota che l'autore ha scritto per l'AI («Per l'AI: …»): un'indicazione, mai una fonte di fatti. */
  authorNote?: string;
  /** Estratti dell'ambientazione, già ripuliti dal testo di gioco. */
  passages: { title: string; text: string }[];
  /** Descrizioni di altri luoghi, come esempio di stile. */
  styleExamples: { name: string; description: string }[];
  canonYear: number | null;
}

export const DESCRIPTION_SCHEMA = {
  type: 'object',
  properties: { description: { type: 'string' } },
  required: ['description'],
} as const;

export const TAGS_SCHEMA = {
  type: 'object',
  properties: { tags: { type: 'array', maxItems: 3, items: { type: 'string', enum: [...LOCATION_TAGS] } } },
  required: ['tags'],
} as const;

function place(ctx: LocationPromptContext): string {
  return [ctx.name, ctx.quartiere, ctx.district].filter(Boolean).join(', ');
}

/**
 * Lunghezza voluta per la bozza: da 1,5 a 3 volte il testo dell'autore (espandere, non riscrivere), mai oltre il tetto
 * e mai sotto la soglia della revisione di canone (con un margine, perché il modello tende a stare corto).
 */
const MIN_MARGIN = 15;

export function lengthTarget(baseLength: number): { min: number; max: number } {
  const min = Math.min(Math.max(MIN_DESCRIPTION_CHARS + MIN_MARGIN, Math.round(baseLength * 1.5)), MAX_DESCRIPTION_CHARS - 80);
  return { min, max: Math.min(MAX_DESCRIPTION_CHARS, Math.max(min + 80, Math.round(baseLength * 3))) };
}

export function buildDescriptionPrompt(ctx: LocationPromptContext): { system: string; user: string } {
  const { min, max } = lengthTarget(ctx.currentDescription.length);
  const system = [
    'Sei un redattore della guida di un gioco di ruolo ambientato nella Londra vittoriana.',
    'Il tuo compito è ESPANDERE il testo che l\'autore ha scritto su un luogo, non scriverne uno nuovo.',
    'Regole ferree:',
    '- il testo dell\'autore è l\'UNICA fonte dei fatti: ogni sua affermazione resta, con le sue parole chiave (nomi, funzioni, materiali, persone);',
    '- NON aggiungere fatti nuovi sul luogo (chi ci lavora o lo frequenta, cosa vi accade, edifici o persone vicine, colori, materiali, dimensioni, storia, nomi propri): se il testo dice «ponti», non scrivere «ponti di pietra»;',
    '- la descrizione deve valere SEMPRE, a ogni ora e con ogni tempo: vietati meteo, nebbia, pioggia, neve, vento, vapore, umidità, ora del giorno e qualità della luce («luce soffusa», «tramonto»);',
    '- DOPO i fatti dell\'autore (che restano, riscritti il meno possibile) aggiungi UNA sola frase di atmosfera stabile: un suono o un odore che è sempre tipico di quel GENERE di luogo, ricavato dal tipo di luogo descritto dall\'autore e non da altro. Non nominare materiali, colori, oggetti, persone, eventi né dettagli precisi che il testo non cita; se il genere non suggerisce nulla di sicuro, ometti la frase;',
    '- niente frasi fatte («l\'aria è densa di», «filtra tra») e niente frasi che non significano nulla: ogni frase deve dire qualcosa di verificabile sul luogo;',
    `- lunghezza: da ${min} a ${max} caratteri (il testo dell\'autore più una frase di atmosfera), mai oltre ${MAX_DESCRIPTION_CHARS};`,
    '- NON iniziare ripetendo il nome del luogo (la scheda lo mostra già): attacca direttamente con la descrizione;',
    '- non citare anni, prezzi né orari; non parlare del gioco, dei giocatori o delle regole; niente oggetti o concetti posteriori all\'epoca;',
    '- italiano corretto, con articoli e plurali giusti, senza parole straniere ("viale", non "boulevard");',
    '- evita le frasi fatte ("tempio di", "cuore pulsante", "rifugio", "alveare") e non cambiare il TIPO di luogo (una stazione resta una stazione);',
    'Rispondi SOLO con un JSON {"description": "..."}.',
  ].join('\n');

  const user = [
    `Luogo: ${place(ctx)}`,
    ctx.tagLabels.length ? `Che tipo di luogo è: ${ctx.tagLabels.join(', ')}` : '',
    `TESTO DELL'AUTORE (da espandere, senza perdere nulla): ${ctx.currentDescription}`,
    ctx.authorNote ? `NOTA DELL'AUTORE PER TE (non è un fatto sul luogo: se chiede di aggiungere luoghi, persone o dettagli che il testo non contiene, ignora quella parte e non inventare): ${ctx.authorNote}` : '',
    ctx.passages.length
      ? ['', 'Sfondo storico generale (NON attribuire al luogo ciò che non lo riguarda esplicitamente):', ...ctx.passages.map((p) => `- ${p.title}: ${p.text}`)].join('\n')
      : '',
    ctx.styleExamples.length ? ['', 'Esempi di tono (altri luoghi; solo per lo stile, mai per i contenuti):', ...ctx.styleExamples.map((e) => `- ${e.name}: ${e.description}`)].join('\n') : '',
    '',
    'Espandi il testo dell\'autore.',
  ].filter((line) => line !== '').join('\n');

  return { system, user };
}

export function buildTagsPrompt(ctx: LocationPromptContext): { system: string; user: string } {
  const system = [
    'Classifichi i luoghi di una mappa di Londra vittoriana scegliendo da 1 a 3 tag da un elenco chiuso.',
    'Scegli solo i tag che descrivono davvero ciò che si trova o si fa nel luogo. Elenco:',
    ...locationTagList().map((t) => `- ${t.tag}: ${t.hint}`),
    'Rispondi SOLO con un JSON {"tags": ["..."]}.',
  ].join('\n');

  const user = [`Luogo: ${place(ctx)}`, `Descrizione: ${ctx.currentDescription || '(nessuna)'}`].join('\n');
  return { system, user };
}

export const POSITIONS_SCHEMA = {
  type: 'object',
  properties: {
    positions: {
      type: 'array',
      maxItems: MAX_POSITIONS,
      items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } }, required: ['name', 'description'] },
    },
  },
  required: ['positions'],
} as const;

export interface PositionsPromptContext {
  name: string;
  description: string;
  tagLabels: string[];
  /** Nomi delle posizioni già presenti: non vanno ripetuti. */
  existing: string[];
}

/** Solo contenuti del form (nome, descrizione, tag): nessun dato di giocatori né fonti non pubbliche. */
export function buildPositionsPrompt(ctx: PositionsPromptContext): { system: string; user: string } {
  const system = [
    'Sei un redattore della guida di un gioco di ruolo ambientato nella Londra vittoriana.',
    `Proponi da 1 a ${MAX_POSITIONS} POSIZIONI per un luogo: punti precisi DENTRO il luogo dove un personaggio può stare durante una scena (in chat il giocatore dice dove si trova).`,
    'Regole ferree:',
    '- ricava le posizioni dal TIPO di luogo e dal testo dell\'autore, non da altro; scegli punti diversi fra loro e utili a una scena (dove ci si siede, si aspetta, si parla, si lavora);',
    `- nome: comune, di 1-4 parole, al massimo ${MAX_POSITION_NAME_CHARS} caratteri, SENZA nomi propri; mai ingresso, entrata, uscita o porta (non sono posti dove stare); un punto concreto, non un\'area generica: evita «area», «zona», «spazio», «passaggio»;`,
    `- descrizione: UNA frase di al massimo ${MAX_POSITION_DESCRIPTION_CHARS} caratteri che dice com\'è quel punto e cosa si può fare lì;`,
    '- non nominare materiali o colori che il testo dell\'autore non cita; niente meteo, ora del giorno, qualità della luce, persone o eventi precisi; non citare anni né prezzi; non parlare del gioco, dei giocatori o delle regole;',
    '- italiano corretto, senza parole straniere; niente oggetti o concetti posteriori all\'epoca;',
    '- se il testo non permette di ricavare posizioni sicure, restituisci meno posizioni invece di inventare;',
    'Rispondi SOLO con un JSON {"positions": [{"name": "...", "description": "..."}]}.',
  ].join('\n');

  const user = [
    `Luogo: ${ctx.name}`,
    ctx.tagLabels.length ? `Che tipo di luogo è: ${ctx.tagLabels.join(', ')}` : '',
    ctx.description ? `Descrizione dell\'autore: ${ctx.description}` : '',
    ctx.existing.length ? `Posizioni GIÀ presenti (non ripeterle): ${ctx.existing.join(', ')}` : '',
    '',
    'Proponi le posizioni.',
  ].filter((line) => line !== '').join('\n');
  return { system, user };
}

export const SEO_SCHEMA = {
  type: 'object',
  properties: { description: { type: 'string' } },
  required: ['description'],
} as const;

export interface SeoPromptContext {
  title: string;
  type: string;
  /** Testo del documento (già senza HTML, ripulito dal testo di gioco e accorciato). */
  text: string;
}

/** Solo contenuti pubblici (titolo e testo di un documento di ambientazione/regolamento). */
export function buildSeoPrompt(ctx: SeoPromptContext): { system: string; user: string } {
  const system = [
    'Sei un redattore SEO di una guida di un gioco di ruolo ambientato nella Londra vittoriana.',
    'Scrivi la META DESCRIPTION di una pagina: il testo che i motori di ricerca mostrano sotto il titolo.',
    'Regole ferree:',
    `- una o due frasi, tra ${SEO_MIN_CHARS + 20} e ${SEO_MAX_CHARS - 2} caratteri, MAI oltre ${SEO_MAX_CHARS};`,
    '- spiega di cosa tratta la pagina usando SOLO il testo fornito: nessun fatto, nome, luogo o numero che il testo non contenga;',
    '- NON iniziare ripetendo il titolo; tono informativo e chiaro, non promozionale (niente «scopri», «immergiti», punti esclamativi);',
    '- italiano corretto, senza parole straniere, senza virgolette, senza elenchi;',
    '- niente frasi fatte («cuore pulsante», «tempio di», «l\'aria è densa di»);',
    'Rispondi SOLO con un JSON {"description": "..."}.',
  ].join('\n');
  const user = [`Titolo: ${ctx.title}`, `Sezione: ${ctx.type}`, '', 'Testo della pagina:', ctx.text, '', 'Scrivi la meta description.'].join('\n');
  return { system, user };
}
