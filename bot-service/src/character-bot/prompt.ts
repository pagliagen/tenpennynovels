import type { BotConfig } from './config';
import type { Plan } from './pipeline/types';
import type { ChatMessage } from '../shared/ollama';

export interface HistoryLine {
  characterId: string;
  characterName: string;
  content: string;
  /** Tag di posizione del messaggio (es. "Ingresso") e la sua descrizione. */
  position?: string;
  positionDescription?: string;
}

export type { ChatMessage };

/** Limite del backend sul campo content (Chat.ts). */
export const MAX_REPLY_CHARS = 1200;

/** Quante battute precedenti del bot restano nel prompt: di più e il modello le copia. */
const OWN_LINES_KEPT = 2;

function trimOwnLines(history: HistoryLine[], botCharacterId: string): HistoryLine[] {
  const ownIndexes = history.flatMap((h, i) => (h.characterId === botCharacterId ? [i] : []));
  const dropped = new Set(ownIndexes.slice(0, Math.max(0, ownIndexes.length - OWN_LINES_KEPT)));
  return history.filter((_, i) => !dropped.has(i));
}

export interface PromptExtras {
  /** Scaletta prodotta dallo step di pianificazione. */
  plan?: Plan;
  feedback?: string;
  /** Carattere, umore e rapporto, già tradotti in frasi. */
  psycheLines?: string[];
  /** Se il genere dell'interlocutore è noto la regola 9 non serve. */
  genderKnown?: boolean;
}

export function buildMessages(bot: BotConfig, fullHistory: HistoryLine[], extras: PromptExtras = {}): ChatMessage[] {
  const { plan, feedback, psycheLines, genderKnown } = extras;
  const history = trimOwnLines(fullHistory, bot.characterId);
  const system = [
    bot.persona,
    ...(psycheLines && psycheLines.length > 0 ? ['', ...psycheLines] : []),
    '',
    '--- REGOLE ---',
    'Sei in una chat di gioco di ruolo ambientato nella Londra vittoriana (circa 1880-1900). Questo è il tuo mondo reale.',
    '1. Scrivi in italiano semplice e corretto, solo con parole che esistono. Frasi brevi.',
    '2. Formato: le azioni in TERZA persona tra *asterischi* (es. *asciuga un boccale e lo guarda di traverso*), le parole dette in PRIMA persona, senza virgolette.',
    '3. Resta sempre nel personaggio. Mai meta-commenti, mai riferimenti a essere un\'IA o a regole di gioco.',
    '4. Rispondi SOLO a ciò che è stato detto o fatto. Non anticipare eventi, non decidere azioni o parole degli altri personaggi.',
    '5. Usa solo valuta e riferimenti dell\'epoca (sterline, scellini, penny, farthing). Niente centesimi, dollari o personaggi di fantasia.',
    `6. Una sola battuta di AL MASSIMO ${bot.targetWords} parole, in un unico paragrafo. Meglio corta che lunga.`,
    '7. Non ripetere frasi o gesti che hai già usato nei messaggi precedenti.',
    '8. Non inventare dettagli che nessuno ha detto (meteo, oggetti, eventi, persone): reagisci solo a ciò che c\'è nella chat.',
    '10. Non fai mai del male fisico agli altri e non li blocchi o trattieni (niente afferrare, colpire, spintonare): puoi minacciare a parole, cacciare, voltare le spalle, ma ciò che subisce l\'altro lo decide il suo giocatore.',
    ...(genderKnown ? [] : ['9. Non sai se l\'altro è uomo o donna: evita aggettivi e participi che ne indichino il genere (non "attenta", "stanco").']),
  ].join('\n');

  const user = [
    '[Chat recente]',
    formatTranscript(history),
    ...situationBlock(history),
    ...(plan ? ['', '[Scaletta da seguire]', ...plan.points.map((p) => `- ${p}`), `Tono: ${plan.tone}`] : []),
    ...(feedback ? ['', `[Correzione] ${feedback}`] : []),
    '',
    `Scrivi la prossima battuta di ${bot.name}. Solo il testo del messaggio, senza il tuo nome davanti.`,
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * Ripulisce l'output del modello. Non accorcia mai a metà frase: se supera il
 * limite del backend taglia all'ultima frase intera (o, in mancanza, all'ultimo
 * spazio). La lunghezza normale si controlla nel prompt, non qui.
 */
export function sanitizeReply(raw: string, botName: string): string {
  let text = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/\r?\n+/g, ' ')
    .replace(/["“”«»]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const prefix = new RegExp(`^\\*{0,2}${botName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*{0,2}\\s*[:\\-–]\\s*`, 'i');
  text = text.replace(prefix, '');

  if (text.length <= MAX_REPLY_CHARS) return text;

  const slice = text.slice(0, MAX_REPLY_CHARS);
  const sentenceEnd = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '), slice.lastIndexOf('* '));
  if (sentenceEnd > MAX_REPLY_CHARS / 2) return slice.slice(0, sentenceEnd + 1).trim();
  return slice.slice(0, slice.lastIndexOf(' ')).trim();
}

/**
 * Dove si trova chi parla e cosa implica. Le posizioni "Ingresso" e "Uscita"
 * sono presenti in ogni location: chi è all'Ingresso non è ancora entrato.
 */
export function formatTranscript(history: HistoryLine[]): string {
  return history
    .map((h) => `${h.characterName}${h.position ? ` [${h.position}]` : ''}: ${h.content}`)
    .join('\n');
}

export function situationBlock(history: HistoryLine[]): string[] {
  const last = history.at(-1);
  if (!last?.position) return [];

  const lines = ['', '[Situazione]', `${last.characterName} si trova in: ${last.position}${last.positionDescription ? ` (${last.positionDescription})` : ''}.`];
  if (/ingresso/i.test(last.position)) {
    lines.push('È ancora all\'ingresso, appena arrivato dall\'esterno: accoglilo e invitalo a entrare e ad accomodarsi.');
  } else if (/uscita/i.test(last.position)) {
    lines.push('Sta per andarsene: salutalo, senza trattenerlo.');
  } else {
    lines.push('Rispondi tenendo conto che vi trovate vicini, in quel punto del locale.');
  }
  return lines;
}
