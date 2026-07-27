#!/usr/bin/env node
/**
 * Benchmark dell'inferenza del Bibliotecario.
 *
 * Misura separatamente prefill (prompt) e decode (risposta) chiamando Ollama
 * direttamente, così il numero non è inquinato da rete, Mongo o Qdrant.
 * Serve a decidere l'hardware con dati invece che con stime: il decode su CPU
 * è limitato dalla banda di memoria, quindi scala con la dimensione del modello.
 *
 * Uso:
 *   node scripts/bench-ollama-rag.mjs
 *   node scripts/bench-ollama-rag.mjs --models qwen3:8b,qwen3:4b,qwen3:1.7b
 *   node scripts/bench-ollama-rag.mjs --think          # confronto con reasoning attivo
 *   node scripts/bench-ollama-rag.mjs --context 6000 --predict 250
 *
 * Env: OLLAMA_URL (default http://127.0.0.1:11434)
 */

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const MODELS = flag('models', process.env.OLLAMA_MODEL || 'qwen3:8b').split(',').map((m) => m.trim());
const CONTEXT_CHARS = parseInt(flag('context', '6000'), 10);
const NUM_PREDICT = parseInt(flag('predict', '250'), 10);
const NUM_CTX = parseInt(flag('numctx', '4096'), 10);
const THINK = has('think');
const RUNS = parseInt(flag('runs', '2'), 10);

// Prompt di sistema identico a RAGPipeline, così la misura riflette il carico reale.
const SYSTEM_PROMPT = `Sei il Bibliotecario, l'assistente esperto di un gioco di ruolo play-by-chat ambientato nell'epoca vittoriana (Londra, 1885-1895).

Rispondi alla domanda del giocatore usando SOLO le informazioni nel contesto.
Scrivi una risposta fluida e naturale come se fosse conoscenza tua: MAI dire "il documento", "nel contesto", "secondo le fonti" o simili.
Motiva sempre brevemente la risposta.
Se il contesto non contiene abbastanza informazioni, dillo.
Rispondi in italiano, in 2-4 frasi sintetiche ma complete.`;

const QUESTION = 'Quali sono le regole per un duello alla pistola tra gentiluomini?';

/** Contesto sintetico della lunghezza voluta, in italiano, per un prefill realistico. */
function buildContext(chars) {
  const paragraph =
    'Nel codice cavalleresco londinese del 1885 il duello alla pistola resta pratica illegale ma tollerata tra ' +
    'gentiluomini di rango. La sfida viene recapitata da un padrino, che concorda luogo, ora e condizioni con il ' +
    'padrino dell offeso. Le pistole sono identiche, fornite da un terzo neutrale, caricate in presenza di entrambi ' +
    'i testimoni. La distanza convenzionale è di venti passi, misurati dal padrino più anziano. Un medico deve essere ' +
    'presente sul posto, pena la nullità dello scontro secondo la consuetudine. ';
  let text = '';
  while (text.length < chars) text += paragraph;
  return text.slice(0, chars);
}

const CONTEXT = buildContext(CONTEXT_CHARS);
const USER_MESSAGE = `Documenti di contesto:\nIl duello\n${CONTEXT}\n\nDomanda del giocatore: ${QUESTION}`;

const ns = (v) => (v || 0) / 1e9;
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

async function runOnce(model) {
  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_MESSAGE },
    ],
    think: THINK,
    options: { temperature: 0.3, num_predict: NUM_PREDICT, num_ctx: NUM_CTX },
    keep_alive: -1,
    stream: false,
  };

  const started = Date.now();
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  const wallMs = Date.now() - started;

  const promptTokens = data.prompt_eval_count || 0;
  const answerTokens = data.eval_count || 0;
  const prefillS = ns(data.prompt_eval_duration);
  const decodeS = ns(data.eval_duration);

  return {
    wallS: wallMs / 1000,
    loadS: ns(data.load_duration),
    promptTokens,
    answerTokens,
    prefillS,
    decodeS,
    prefillTps: prefillS > 0 ? promptTokens / prefillS : 0,
    decodeTps: decodeS > 0 ? answerTokens / decodeS : 0,
    truncated: answerTokens >= NUM_PREDICT,
    answer: (data.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim(),
  };
}

async function main() {
  console.log(`\nBenchmark RAG — ${OLLAMA_URL}`);
  console.log(`contesto ${CONTEXT_CHARS} char · num_predict ${NUM_PREDICT} · num_ctx ${NUM_CTX} · think ${THINK} · ${RUNS} run per modello`);
  console.log(`Budget da rispettare: 60s (AbortSignal.timeout in EmbeddingService.askQuestion)\n`);

  console.log(
    pad('modello', 16) + padL('prompt tok', 12) + padL('risp tok', 10) +
    padL('prefill s', 11) + padL('decode s', 10) + padL('tok/s', 8) + padL('totale s', 10) + '  esito'
  );
  console.log('─'.repeat(88));

  for (const model of MODELS) {
    try {
      // Primo giro a vuoto: carica il modello, così non misuriamo il cold start.
      await runOnce(model);

      const runs = [];
      for (let i = 0; i < RUNS; i++) runs.push(await runOnce(model));

      const best = runs.reduce((a, b) => (a.wallS <= b.wallS ? a : b));
      const verdict = best.wallS < 50 ? '✅ dentro budget' : best.wallS < 60 ? '⚠️ al limite' : '❌ oltre i 60s';
      const trunc = best.truncated ? ' (risposta troncata a num_predict)' : '';

      console.log(
        pad(model, 16) + padL(best.promptTokens, 12) + padL(best.answerTokens, 10) +
        padL(best.prefillS.toFixed(1), 11) + padL(best.decodeS.toFixed(1), 10) +
        padL(best.decodeTps.toFixed(1), 8) + padL(best.wallS.toFixed(1), 10) + '  ' + verdict + trunc
      );
    } catch (err) {
      console.log(pad(model, 16) + '  ❌ ' + err.message);
    }
  }

  console.log(`
Come leggerlo:
  prefill s  costo del prompt. Se domina, il problema è la lunghezza del contesto
             (QA_MAX_CONTEXT_CHARS), non la CPU.
  tok/s      velocità di generazione. Limitata dalla banda di memoria: dimezzare
             la dimensione del modello raddoppia questo numero.
  totale s   quello che conta. Deve stare sotto 60s con margine.

Confronto utile: rilanciare con --think per vedere quanto costa il reasoning.
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
