import type { Llm } from '../ollama';
import { formatTranscript, situationBlock } from '../prompt';
import type { Plan, TurnContext } from './types';

const SCHEMA = {
  type: 'object',
  properties: {
    problems: { type: 'array', items: { type: 'string' }, maxItems: 4 },
  },
  required: ['problems'],
};

/**
 * Step 3 — il critico. Controlla il CONTENUTO (non il formato, che è l'ultimo
 * step): cose che nessun controllo deterministico vede, come un barista che
 * si comporta da cliente. Una lista di domande precise è più affidabile di
 * "valuta se va bene". Ritorna i problemi trovati; lista vuota = va bene.
 */
export async function critiqueReply(llm: Llm, ctx: TurnContext, draft: string, plan: Plan | null): Promise<string[]> {
  const { bot, history } = ctx;
  const system = [
    `Sei un revisore severo di battute per una chat di gioco di ruolo. L'attore interpreta ${bot.name}.`,
    `Il personaggio: ${bot.persona}`,
    '',
    'Leggi la chat e la battuta proposta e rispondi a queste domande. Elenca in "problems" SOLO i problemi reali, ognuno in una frase che dica cosa correggere. Se la battuta va bene, "problems" è una lista vuota.',
    `1. Risponde davvero a ciò che l'altro ha detto o fatto?`,
    `2. ${bot.name} si comporta secondo il suo ruolo e la sua persona? (es. un barista serve e chiede cosa vuole il cliente, non chiede soldi a sé stesso né si fa servire)`,
    '3. Introduce persone, nomi, luoghi, eventi, meteo o oggetti che nessuno ha menzionato e che non sono nella persona? (errore grave)',
    '4. Decide azioni, parole o pensieri dell\'altro personaggio?',
    '5. Ha frasi che non hanno senso, parole inesistenti o contraddizioni?',
    plan ? `6. Segue la scaletta prevista (${plan.points.join('; ')})?` : '',
    '',
    'Non giudicare lo stile né la lunghezza. Rispondi SOLO con il JSON.',
  ].filter(Boolean).join('\n');

  const user = [
    '[Chat recente]',
    formatTranscript(history),
    ...situationBlock(history),
    '',
    '[Battuta proposta]',
    draft,
  ].join('\n');

  try {
    const raw = (await llm.generateJson(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      SCHEMA,
      { temperature: 0.1, numPredict: 300 },
    )) as { problems?: unknown };
    return (Array.isArray(raw.problems) ? raw.problems : [])
      .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      .slice(0, 4);
  } catch {
    // Un critico che fallisce non deve bloccare la risposta.
    return [];
  }
}
