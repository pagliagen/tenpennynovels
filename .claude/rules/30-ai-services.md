# 30 — AI services (`local-ai/`)

Due microservizi Express 4 + TypeScript in Docker. Provider LLM di default: **Ollama locale** (nessun costo API).

| Service | Porta | Ruolo |
|---|---|---|
| botai | 8080 | interazioni dei personaggi AI (pipeline multi-step con memoria e relazioni) |
| character-gen | 8130 | generazione personaggi (stat, skill, prompt) |

`local-ai/gateway` (9000) espone i service verso l'esterno.
Il Q&A RAG "Bibliotecario" **non vive più qui**: è stato spostato in `services/embeddings-worker` perché è feature di produzione (vedi `20-backend.md`).

---

## Regole comuni

**Coda sequenziale**: `p-queue` con `concurrency: 1` — l'LLM è CPU-bound, il parallelismo lo saturerebbe. Ordine FIFO deterministico.

**Pattern 202 Accepted**: rispondere **subito** con `202` + posizione in coda, poi elaborare in background e notificare via callback. Non attendere la coda prima di rispondere.

```typescript
res.status(202).json({ status: 'accepted', queuePosition: queue.size });
queue.add(async () => { /* lavoro pesante */ });
```

**Callback con whitelist**: `CallbackSender` valida l'hostname contro `CALLBACK_ALLOWED_HOSTS` prima di chiamare. Mai fare POST verso un URL arbitrario fornito dall'input: è una SSRF. Retry: 2 tentativi, delay 2s. I callback di progresso sono fire-and-forget senza retry.

**Logger**: `local-ai/shared/logger.ts` (wrapper Winston), niente `console.*`.

**Health**: `local-ai/shared/health.ts` — verifica server, connettività unified-backend e disponibilità LLM.

**Rete Docker**: bridge `tenpennynovels_default`. I service chiamano `http://unified-backend:3001` (porta reale del servizio, **non** 4001 che è la game app).

**Aggiornamento container**: `stop` + `up -d`, mai `restart` (vedi `40-workflow.md`).

---

## Selezione dell'agent LLM

`AI_PROVIDER` (default `ollama`; `inception` richiede `INCEPTION_API_KEY`).

**Dual-role in botai** — due singleton lazy con modelli distinti:

| Ruolo | Uso | Env |
|---|---|---|
| creativo | dialoghi, generazione/refine bot | `OLLAMA_MODEL` (es. `gemma3:12b`) |
| analitico | context analysis, output JSON strutturato | `OLLAMA_ANALYTICAL_MODEL` (fallback su `OLLAMA_MODEL`) |

```typescript
getCreativeAgent().generate(systemPrompt, userMessage, numPredict, temperature, topP, repeatPenalty)
getAnalyticalAgent().analyzeJSON(stepName, systemPrompt, userMessage, options)   // format: 'json', 1 retry
```

Interfaccia in `local-ai/services/botai/src/agent/IAgent.ts`.
`AgentFactory` è **service-local**: non sta in `shared/`. character-gen e il RAG dell'embeddings-worker hanno la propria integrazione Ollama, non la condividono.

---

## botai — struttura reale

Tutto sotto `local-ai/services/botai/src/`:

| Dir | Contenuto |
|---|---|
| `agent/` | `AgentFactory`, `IAgent`, `OllamaAgent`, `InceptionAgent`, `ContextAnalyzer`, `ContextBuilder`, `PromptBuilder`, `ResponseRefiner`, `DeterministicRefiner`, `ResponseFormatter`, `PostResponseAnalyzer`, `EmotionManager`, `SecondaryEmotions`, `NeedsManager`, `ConflictEngine`, `ReciprocityEngine`, `SpontaneityEngine`, `PhaseDetector`, `BaselineComputer`, `AttachmentMapper` |
| `memory/` | `MemoryStore`, `RelationshipStore`, `ArcSummarizer` |
| `models/` | `Bot`, `Memory`, `Relationship` |
| `queue/` | `RequestQueue` |
| `callback/` | `CallbackSender` |
| `utils/` | `SessionDetector` |

⚠️ **Attenzione ai path**: i componenti della pipeline stanno **tutti** in `agent/`. Non esistono `src/context/`, `src/refine/`, `src/analysis/` (le rules precedenti li citavano erroneamente).

**Pipeline**: analisi contesto → generazione → refine/critica → post-analisi con aggiornamento di emozioni, mood, bisogni, relazioni e memoria. Prima di modificarla, leggi i file reali: la logica emotiva e relazionale è più articolata di qualunque riassunto.

**Parametri di sampling** tipici: `temperature 0.72`, `topP 0.85`, `repeatPenalty 1.2`, `numPredict` ~700 (standard) / ~950 (narrativo).

---

## character-gen — struttura reale

`src/`: `CharacterGenerator`, `GenerationManager`, `PromptBuilder`, `SkillAllocator`, `StatAllocator`, `routes`, `types`.
Endpoint: `POST /generate` (202), `GET /health`, `GET /queue-status`.

---

## Docker build (monorepo)

Multi-stage `node:24-alpine`. Il builder crea un symlink verso i `node_modules` del service per far risolvere gli import da `shared/`. Runtime con `npm install --omit=dev`, utente non-root, healthcheck sul `/health`.
`tsconfig.base.json` mappa `@shared/*` → `shared/*`.
