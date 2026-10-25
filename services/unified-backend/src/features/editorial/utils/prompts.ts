import { locationTagList, LOCATION_TAGS } from '@core/location/constants/locationTags';
import { MAX_DESCRIPTION_CHARS } from './validators';

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

/** Lunghezza voluta per la bozza: da 1,5 a 3,5 volte il testo dell'autore (espandere, non riscrivere), mai oltre il tetto. */
export function lengthTarget(baseLength: number): { min: number; max: number } {
  const min = Math.max(60, Math.round(baseLength * 1.5));
  return { min: Math.min(min, MAX_DESCRIPTION_CHARS - 80), max: Math.min(MAX_DESCRIPTION_CHARS, Math.max(min + 80, Math.round(baseLength * 3.5))) };
}

export function buildDescriptionPrompt(ctx: LocationPromptContext): { system: string; user: string } {
  const { min, max } = lengthTarget(ctx.currentDescription.length);
  const system = [
    'Sei un redattore della guida di un gioco di ruolo ambientato nella Londra vittoriana.',
    'Il tuo compito è ESPANDERE il testo che l\'autore ha scritto su un luogo, non scriverne uno nuovo.',
    'Regole ferree:',
    '- il testo dell\'autore è l\'UNICA fonte dei fatti: ogni sua affermazione resta, con le sue parole chiave (nomi, funzioni, materiali, persone);',
    '- NON aggiungere fatti nuovi sul luogo (chi ci lavora o lo frequenta, cosa vi accade, edifici o persone vicine, colori, materiali, dimensioni, storia, nomi propri): aggiungi SOLO atmosfera sensoriale (suoni, odori, luce, movimento) coerente con quei fatti e con il tipo di luogo;',
    `- lunghezza: da ${min} a ${max} caratteri (2 o 3 frasi), mai oltre ${MAX_DESCRIPTION_CHARS};`,
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
