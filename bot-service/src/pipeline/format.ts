import type { Llm } from '../ollama';
import type { TurnContext } from './types';

// Gli esempi non contengono nomi propri: un nome nell'esempio viene copiato nelle risposte
// (visto dal vivo: il bot citava un "John" che nessuno in chat aveva mai nominato).
const EXAMPLES = `Esempio 1
Prima: *Mi asciugo le mani e ti guardo con diffidenza.* Cosa vuoi?
Dopo: *Si asciuga le mani e lo guarda con diffidenza.* Cosa vuoi?

Esempio 2
Prima: *Prendo un boccale e te lo porgo.* Ecco il gin. *Torno al mio lavoro.*
Dopo: *Prende un boccale e glielo porge.* Ecco il gin. *Torna al suo lavoro.*`;

/**
 * Step 3 — il formato. È un compito di riscrittura, che un modello piccolo
 * esegue molto meglio che rispettare lo stesso vincolo mentre inventa il testo.
 * `feedback` serve alla revisione: stesso step, con il difetto da correggere.
 */
export async function formatReply(llm: Llm, ctx: TurnContext, draft: string, feedback?: string): Promise<string> {
  const system = [
    'Sei un correttore di formato per messaggi di una chat di gioco di ruolo. Riscrivi il messaggio SENZA cambiarne il significato e SENZA aggiungere nulla di nuovo.',
    '',
    'Regole di formato:',
    '1. Ogni azione sta tra *asterischi* ed è in TERZA persona singolare (alza, prende, porge, si asciuga): mai in prima persona (alzo, prendo, mi asciugo).',
    `2. Nelle azioni chi è di fronte si indica con lo/la/gli${ctx.otherName ? ` (oppure col suo nome, ${ctx.otherName})` : ''}, mai con "ti"/"te". Non usare nomi.`,
    '3. Le parole dette restano in prima persona, senza virgolette.',
    '4. Le azioni vanno all\'inizio del messaggio e tra una frase parlata e l\'altra, mai in coda a tutto.',
    '5. Correggi parole inesistenti ed errori di italiano.',
    '6. Resta breve: non allungare il messaggio.',
    feedback ? `7. Inoltre: ${feedback}` : '',
    '',
    EXAMPLES,
    '',
    'Rispondi SOLO con il messaggio riscritto.',
  ].filter(Boolean).join('\n');

  return llm.generate(
    [{ role: 'system', content: system }, { role: 'user', content: draft }],
    { temperature: 0.2, numPredict: 420 },
  );
}
