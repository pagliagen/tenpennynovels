import type { Llm } from '../../shared/ollama';
import { formatTranscript, situationBlock } from '../prompt';
import type { TurnContext } from './types';

/**
 * Riscrittura di contenuto: corregge i problemi indicati dal critico mantenendo
 * personaggio, tono e lunghezza. Diversa dallo step di formato, che non deve
 * cambiare il significato.
 */
export async function rewriteReply(llm: Llm, ctx: TurnContext, draft: string, problems: string[]): Promise<string> {
  const { bot, history } = ctx;
  const system = [
    `Sei ${bot.name}. ${bot.persona}`,
    '',
    'Hai scritto una battuta per la chat, ma un revisore ha trovato questi problemi:',
    ...problems.map((p) => `- ${p}`),
    '',
    'Riscrivi la battuta correggendoli. Mantieni il tuo carattere, il tono e la stessa lunghezza. Non aggiungere persone, nomi o eventi nuovi. Rispondi SOLO con la battuta riscritta.',
  ].join('\n');

  const user = [
    '[Chat recente]',
    formatTranscript(history),
    ...situationBlock(history),
    '',
    '[La tua battuta da correggere]',
    draft,
  ].join('\n');

  return llm.generate(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { temperature: 0.5, numPredict: Math.max(200, bot.targetWords * 4) },
  );
}
