import type { Llm } from '../../shared/ollama';
import type { TurnContext } from '../pipeline/types';
import { formatTranscript } from '../prompt';

/** Ogni quanti scambi si aggiorna il riassunto del rapporto. */
export const SUMMARY_EVERY = 3;
const MAX_SUMMARY_CHARS = 400;

const SCHEMA = { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] };

/**
 * Il riassunto è la memoria oltre la chat recente: cosa è successo tra il bot e questa
 * persona, in 2-3 frasi. Aggiorna quello precedente, non lo riscrive da capo. Se fallisce
 * resta il vecchio: ritorna null.
 */
export async function updateSummary(llm: Llm, ctx: TurnContext, previous: string | undefined, reply: string): Promise<string | null> {
  const { bot } = ctx;
  const other = ctx.otherName ?? 'lo straniero';
  const system = [
    `Tieni la memoria di ${bot.name} su ${other}. Produci SOLO un JSON {"summary": "..."} con un riassunto di 2-3 frasi, in terza persona, di cosa è successo tra loro e come si sono lasciati.`,
    'Aggiorna il riassunto precedente con lo scambio nuovo, senza ripetere e senza inventare nulla che non sia scritto. Tieni ciò che conta (offese, favori, promesse, segreti detti), butta il resto. Niente nomi che non compaiono nel testo.',
  ].join('\n');
  const user = [
    `[Riassunto precedente] ${previous ?? '(nessuno)'}`,
    '',
    '[Scambio]',
    formatTranscript(ctx.history.slice(-4)),
    `${bot.name}: ${reply}`,
  ].join('\n');

  try {
    const raw = (await llm.generateJson(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      SCHEMA,
      { temperature: 0.2, numPredict: 200 },
    )) as { summary?: unknown };
    const summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
    return summary.length >= 10 ? summary.slice(0, MAX_SUMMARY_CHARS) : null;
  } catch {
    return null;
  }
}
