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

export function buildDescriptionPrompt(ctx: LocationPromptContext): { system: string; user: string } {
  const system = [
    `Sei un redattore della guida di un gioco di ruolo ambientato nella Londra vittoriana${ctx.canonYear ? ` del ${ctx.canonYear}` : ''}.`,
    'Scrivi in italiano la descrizione di un luogo, in 2 o 3 frasi (al massimo ' + MAX_DESCRIPTION_CHARS + ' caratteri), con lo stesso tono e la stessa lunghezza degli esempi.',
    'Regole ferree:',
    '- ARRICCHISCI la descrizione attuale, non sostituirla: conserva TUTTI i fatti che contiene (nomi propri, chi l\'ha progettato, caratteristiche) e aggiungi atmosfera e aspetto;',
    '- descrivi com\'è il luogo (atmosfera, aspetto, chi lo frequenta): niente trama, niente eventi;',
    '- NON iniziare ripetendo il nome del luogo (la scheda lo mostra già) e non ripeterlo: attacca direttamente con la descrizione;',
    '- evita le frasi fatte ("tempio di", "cuore pulsante", "rifugio", "alveare") e non cambiare il TIPO di luogo (una stazione resta una stazione, non una cattedrale);',
    '- scrivi in italiano corretto, con articoli e plurali giusti, senza parole straniere ("viale", non "boulevard"; "stazione", non "terminal");',
    '- usa SOLO ciò che è nel contesto o è del tutto generico; NON inventare nomi propri di persone, vie, locali o negozi;',
    '- non citare anni, prezzi né orari (l\'epoca è già nota al lettore);',
    '- usa gli estratti SOLO se parlano proprio di questo luogo o del suo quartiere; altrimenti ignorali. Non citare alla lettera le etichette del tipo di luogo;',
    '- non parlare del gioco, dei giocatori, delle regole o dei personaggi giocanti;',
    '- niente oggetti o concetti posteriori all\'epoca.',
    'Rispondi SOLO con un JSON {"description": "..."}.',
  ].join('\n');

  const user = [
    `Luogo: ${place(ctx)}`,
    ctx.tagLabels.length ? `Che tipo di luogo è: ${ctx.tagLabels.join(', ')}` : '',
    `Descrizione attuale (da migliorare, non da ripetere): ${ctx.currentDescription || '(nessuna)'}`,
    ctx.passages.length ? ['', 'Dall\'ambientazione pubblicata:', ...ctx.passages.map((p) => `- ${p.title}: ${p.text}`)].join('\n') : '',
    ctx.styleExamples.length ? ['', 'Esempi di stile (altri luoghi):', ...ctx.styleExamples.map((e) => `- ${e.name}: ${e.description}`)].join('\n') : '',
    '',
    'Scrivi la nuova descrizione.',
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
