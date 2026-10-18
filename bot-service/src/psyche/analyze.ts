import type { Llm } from '../ollama';
import type { TurnContext } from '../pipeline/types';
import { formatTranscript } from '../prompt';
import { describeMood } from './describe';
import type { PadDelta, RelationDelta } from './types';

const SCHEMA = {
  type: 'object',
  properties: {
    mood: {
      type: 'object',
      properties: { pleasure: { type: 'number' }, arousal: { type: 'number' }, dominance: { type: 'number' } },
      required: ['pleasure', 'arousal', 'dominance'],
    },
    relation: {
      type: 'object',
      properties: { trust: { type: 'number' }, respect: { type: 'number' }, suspicion: { type: 'number' } },
      required: ['trust', 'respect', 'suspicion'],
    },
    introducedName: { type: ['string', 'null'] },
    facts: { type: 'array', items: { type: 'string' }, maxItems: 2 },
  },
  required: ['mood', 'relation', 'introducedName', 'facts'],
};

export interface Analysis {
  pad: PadDelta;
  relation: RelationDelta;
  /** Non fidato: va validato col testo del giocatore (validateIntroducedName). */
  introducedName: unknown;
  facts: unknown;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Dopo lo scambio: come cambia l'umore del bot e il suo rapporto con l'altro, e
 * cosa ha imparato di lui. L'AI propone, il codice limita (psyche/dynamics.ts).
 * Un fallimento qui non deve mai impedire di salvare lo scambio: ritorna null.
 */
export async function analyzeExchange(llm: Llm, ctx: TurnContext, reply: string): Promise<Analysis | null> {
  const { bot } = ctx;
  const other = ctx.otherName ?? 'lo straniero';

  const system = [
    `Analizzi uno scambio in una chat di gioco di ruolo, dal punto di vista di ${bot.name}. ${bot.persona}`,
    '',
    'Produci SOLO un JSON:',
    '- "mood": come è cambiato l\'umore di ' + bot.name + ' per questo scambio, tre numeri da -0.5 a 0.5. "pleasure": più contento > 0, più infastidito o offeso < 0. "arousal": più agitato > 0, più calmo < 0. "dominance": cambia SOLO se qualcuno lo intimidisce, lo sfida o lo mette in soggezione (< 0) o lo asseconda e gli cede (> 0); altrimenti 0.',
    'Scala: scambio ordinario = 0 o poco più (±0.05); gentilezza o complimento chiaro = +0.2/+0.3 di pleasure; insulto, accusa o scenata = -0.3/-0.4 di pleasure e +0.3 di arousal; minaccia o violenza = -0.5 di pleasure, +0.5 di arousal.',
    `- "relation": come cambia il rapporto di ${bot.name} con ${other}, tre numeri da -10 a 10: "trust" (si fida di più > 0), "respect" (lo rispetta di più > 0), "suspicion" (diffida di più > 0). Scala: scambio ordinario = ±1; gentilezza, mancia o aiuto = +3/+5; insulto o accusa = -4/-6 di trust e respect e +4 di suspicion; minaccia o violenza = -8 e +8.`,
    `- "introducedName": il nome che ${other} ha detto esplicitamente di sé nell'ultimo messaggio ("mi chiamo...", "sono..."), altrimenti null. Non dedurlo, non inventarlo.`,
    `- "facts": fino a 2 fatti brevi e certi che ${bot.name} ha appreso su ${other} da ciò che ha detto o fatto IN QUESTO scambio (es. "è un marinaio", "ha pagato in anticipo"). Solo ciò che è esplicito nella chat: niente deduzioni, niente "torna spesso" o "è un cliente abituale" se non è scritto. Lista vuota se non c'è nulla di nuovo.`,
  ].join('\n');

  const user = [
    `[Umore di ${bot.name} prima dello scambio] ${describeMood(ctx.mood)}`,
    '',
    '[Chat]',
    formatTranscript(ctx.history),
    `${bot.name}: ${reply}`,
  ].join('\n');

  try {
    const raw = (await llm.generateJson(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      SCHEMA,
      { temperature: 0.2, numPredict: 300 },
    )) as { mood?: Record<string, unknown>; relation?: Record<string, unknown>; introducedName?: unknown; facts?: unknown };

    return {
      pad: { p: num(raw.mood?.pleasure), a: num(raw.mood?.arousal), d: num(raw.mood?.dominance) },
      relation: { trust: num(raw.relation?.trust), respect: num(raw.relation?.respect), suspicion: num(raw.relation?.suspicion) },
      introducedName: raw.introducedName,
      facts: raw.facts,
    };
  } catch {
    return null;
  }
}
