import type { Llm } from '../../shared/ollama';
import { formatTranscript, situationBlock } from '../prompt';
import type { Plan, TurnContext } from './types';

const SCHEMA = {
  type: 'object',
  properties: {
    reaction: { type: 'string' },
    points: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
    tone: { type: 'string' },
  },
  required: ['reaction', 'points', 'tone'],
};

/**
 * Step 1 — la scaletta. Decide COSA dire o fare, non COME scriverlo: così il
 * modello non deve badare al formato mentre ragiona sul contenuto.
 */
export async function planReply(llm: Llm, ctx: TurnContext): Promise<Plan | null> {
  const { bot, history } = ctx;
  const system = [
    `Sei l'autore che pianifica la prossima battuta di ${bot.name} in una chat di gioco di ruolo ambientata nella Londra vittoriana.`,
    '',
    `Il personaggio: ${bot.persona}`,
    ...(ctx.psycheLines.length > 0 ? ['', ...ctx.psycheLines] : []),
    '',
    'Produci SOLO un JSON con:',
    '- "reaction": cosa ha appena detto o fatto l\'altro, in una frase;',
    '- "points": da 1 a 3 punti brevi su cosa il personaggio dice o fa, in ordine (es. "lo accoglie e lo invita a sedersi", "chiede cosa vuole bere");',
    '- "tone": il tono in due parole.',
    '',
    'Regole: i punti reagiscono SOLO a ciò che c\'è nella chat. Non inventare persone, nomi, eventi, meteo o luoghi. Non decidere azioni o parole degli altri. Non ripetere ciò che il personaggio ha già detto o fatto. Tieni conto del suo carattere, dell\'umore e di cosa sa (o non sa) dell\'altro.',
  ].join('\n');

  const user = [
    '[Chat recente]',
    formatTranscript(history),
    ...situationBlock(history),
    '',
    `Pianifica la prossima battuta di ${bot.name}.`,
  ].join('\n');

  try {
    const raw = (await llm.generateJson(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      SCHEMA,
      { temperature: 0.4, numPredict: 300 },
    )) as Partial<Plan>;
    const points = (raw.points ?? []).filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
    if (points.length === 0) return null;
    return { reaction: String(raw.reaction ?? ''), points, tone: String(raw.tone ?? '') };
  } catch {
    // Senza scaletta si scrive comunque: lo step successivo regge anche da solo.
    return null;
  }
}
