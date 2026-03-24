import { Ollama } from 'ollama';

const SYSTEM_PROMPT = `Sei un esperto SEO specializzato in giochi di ruolo e narrativa italiana.
Il tuo unico compito è scrivere una meta description SEO in italiano.

REGOLE ASSOLUTE:
- Tra 110 e 155 caratteri (spazi inclusi)
- Frasi complete che terminano con punto o punto esclamativo
- Solo la description, senza virgolette, senza prefissi, senza spiegazioni
- Italiano corretto e fluente
- Includi 1-2 parole chiave tematiche
- Non menzionare "meta description" o "SEO"
- Non iniziare con "Questo documento" o "In questo articolo"
- Non usare puntini di sospensione (...)`;

const SHORTEN_SYSTEM_PROMPT = `Sei un esperto SEO. Accorcia la meta description che ti viene fornita.

REGOLE ASSOLUTE:
- Il risultato deve essere tra 110 e 155 caratteri (spazi inclusi)
- Mantieni il significato e le parole chiave principali
- Frasi complete che terminano con punto o punto esclamativo
- Solo la description accorciata, senza virgolette, senza prefissi
- Non usare puntini di sospensione (...)`;

const MAX_CHARS = 155;
const MAX_RETRIES = 3;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function generateSeoDescription(
  title: string,
  content: string
): Promise<{ description: string; tokensUsed: number; iterations: number }> {
  const client = new Ollama({
    host: process.env.OLLAMA_URL || 'http://localhost:11434',
  });
  const model = process.env.OLLAMA_MODEL || 'mistral:7b-instruct';

  const cleanContent = stripHtml(content).slice(0, 800);

  let totalTokens = 0;
  let description = '';
  let iterations = 1;

  // Iteration 1: generate from title + content
  const firstResponse = await client.chat({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Titolo documento: "${title}"\n\nContenuto (estratto):\n${cleanContent}\n\nScrivi la meta description SEO (110-155 caratteri):`,
      },
    ],
    options: { temperature: 0.4, num_predict: 80 },
    keep_alive: -1,
  });

  description = firstResponse.message.content.trim().replace(/^["']|["']$/g, '').trim();
  totalTokens += (firstResponse.eval_count || 0) + (firstResponse.prompt_eval_count || 0);

  // Refinement loop: if too long, ask the model to shorten it
  for (let attempt = 2; attempt <= MAX_RETRIES; attempt++) {
    if (description.length <= MAX_CHARS) break;

    iterations = attempt;

    const refineResponse = await client.chat({
      model,
      messages: [
        { role: 'system', content: SHORTEN_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Questa description è troppo lunga (${description.length} caratteri, limite ${MAX_CHARS}):\n\n"${description}"\n\nRiscrivila più breve (110-155 caratteri):`,
        },
      ],
      options: { temperature: 0.3, num_predict: 70 },
      keep_alive: -1,
    });

    description = refineResponse.message.content.trim().replace(/^["']|["']$/g, '').trim();
    totalTokens += (refineResponse.eval_count || 0) + (refineResponse.prompt_eval_count || 0);
  }

  return { description, tokensUsed: totalTokens, iterations };
}
