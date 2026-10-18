# 30 — bot-service (`bot-service/`)

Servizio **locale e separato** (non va in produzione: escluso dal rsync) che risponde in chat con un LLM (Ollama).
Descrizione, setup e dati misurati: `bot-service/README.md`.

```
Chat.ts ─publish─▶ Redis `bot:chat:message` ─▶ bot-service ─POST─▶ /internal/bot-chat/messages (unified-backend, feature botChat)
```

`local-ai/` (botai, character-gen, gateway) **non esiste più**: se ne trovi tracce, sono residui da togliere.
Il Q&A "Bibliotecario" vive in `services/embeddings-worker` (vedi `20-backend.md`).

---

## Regole

**Endpoint interno fail-closed.** Senza `BOT_SERVICE_SECRET` risponde 404; accetta solo personaggi con `userId = SYSTEM_BOT_USER_ID` e `approved` (il secret non permette di scrivere a nome di un giocatore vero). Il gateway non inoltra `/internal`. Il secret sta nel `.env` della **root** (lo legge `docker-compose.yml`), non in `services/unified-backend/.env`: il backend gira in Docker.

**Cosa vede il bot.** Solo messaggi `standard`, `public`, non nascosti. **Non riusare `embedding:chat:created`**: parte anche per le azioni master/moderazione e non porta `visibility`. Il bot non risponde mai a un bot (anche a un altro bot configurato).

**`position` è un tag libero** ("Bancone", "Tavolo 2"): il bot risponde con il tag del giocatore. Non validarlo contro `location.positions` (elenca solo Ingresso/Uscita): le risposte perdevano il tag.

**Il bot non sa il nome di chi non si è presentato.** Nel prompt è «Straniero»; il nome entra solo se l'analisi lo propone **e** compare davvero nel testo del giocatore (`validateIntroducedName`).

**I numeri non arrivano al modello.** Big Five, PAD e punteggi di rapporto vivono nel codice e `psyche/describe.ts` li traduce in frasi. L'AI propone le variazioni di umore/rapporto, il codice le limita (`psyche/dynamics.ts`). Umore e rapporti stanno nel db Mongo `botservice`, separato da quello del game.

**Aggiornamento dello stato nello stesso job della coda** (concurrency 1): il messaggio successivo legge lo stato già aggiornato. Il vecchio botai lo faceva fuori coda (race).

**Configurazione**: una scheda per bot in `bots/<nome>.json` + `mapping.json` (location → bot, una location ha un solo bot). Entrambi ignorati da git (contengono id dell'ambiente); gli `*.example.json` sono modelli. Nuovo bot: `BotCharacterSeeder` (`seed:dev:bots`).

**Ollama.** Modelli a ragionamento (qwen3.5, gemma4) con `think: false`; il client riprova senza il parametro con quelli che lo rifiutano (gemma3). Il tempo per risposta non è un vincolo (1-2 minuti vanno bene).

**Test**: `cd bot-service && npm test` (non coprono Ollama né il backend).

---

## Incidenti reali (2026-10-17)

- **Nome copiato dall'esempio** — l'esempio nel prompt del formato diceva «guarda John»: il bot citava un John mai nominato. Negli esempi dei prompt **niente nomi propri**.
- **Critico LLM peggiorativo** — con un 9B segnalava problemi inesistenti in 8/8 casi e la riscrittura introduceva errori (pulite 6/8 contro 8/8 senza). Resta nel codice, spento di default (`DEFAULT_PIPELINE`).
- **Umore saturo** — la dominanza finiva a 1,0: il bot "tiene la situazione in mano" a ogni scambio. Ora spinta verso la base a ogni scambio (`PULL_TO_BASELINE`) e ancore di grandezza nel prompt di analisi.
- **Prima persona nelle azioni** — il feedback di rigenerazione non la corregge (anche a storia pulita sbaglia 4 volte su 8); la risolve lo step di **riscrittura nel formato**, che è l'ultimo della pipeline.
- **Seeder utenti** — importare una costante da `UserSeeder.ts` ne eseguiva il `main()`, con `--force` cancellava admin e personaggi. Le costanti condivise stanno in `scripts/seeders/utils/`.
