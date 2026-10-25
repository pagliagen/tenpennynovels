# ai-gateway

L'**ingresso dei servizi AI**: l'unico punto raggiunto da fuori. Autentica, limita e smista le chiamate verso
`bot-service` (servizi `editorial` e `character-bot`). Non chiama mai Ollama e non ha accesso a Mongo né a Redis.
Il `character-bot` si raggiunge con `POST /v1/character-bot/event` (il gioco spinge i messaggi; vedi `bot-service/README.md`),
più `list`, `design` e `register` per il gestionale.

```
server di gioco ──HTTPS──▶ ai-gateway (:8787) ──loopback──▶ bot-service (:8788) ──▶ Ollama
 (core/ai/AiGatewayClient)   ngrok oggi,                      editorial · character-bot
                             dominio del server AI domani
```

Oggi gira sulla tua macchina dietro un tunnel ngrok; se la sperimentazione va bene traslocherà, insieme a `bot-service`,
su un **server AI dedicato** così l'AI non pesa sul server di gioco. Per il gioco cambia solo `AI_GATEWAY_URL`.

## Come il gioco decide se l'AI c'è

`ENABLE_IA_EDITORIAL=true` sul server di gioco significa «l'AI editoriale è abilitata». È **davvero attiva solo se**
`GET /health` del gateway risponde 200 e `editorial` è fra i servizi attivi. Se il Mac è spento, il tunnel chiuso o il
servizio non abilitato, l'AI semplicemente non c'è (route 404, pulsanti nascosti): puoi tenere `true` anche in produzione.
La revisione di canone (deterministica) è sempre attiva e non dipende da questo.

## Avvio (locale)

```bash
cd ai-gateway && nvm use && npm install
cp .env.example .env            # GATEWAY_SECRET (openssl rand -hex 32), NGROK_URL
npm run dev                     # gateway su 127.0.0.1:8787
npm run tunnel                  # ngrok http 8787 --url $NGROK_URL
```

Il tunnel di questo progetto: `ngrok http 8787 --url https://onomatopoeically-unforgeable-ozie.ngrok-free.dev`.
In parallelo servono `bot-service` (`ENABLED_SERVICES=editorial` o `editorial,character-bot`) e Ollama.

Sul **server di gioco**: `ENABLE_IA_EDITORIAL=true`, `AI_GATEWAY_URL=<dominio ngrok>`, `AI_GATEWAY_SECRET=<lo stesso valore di GATEWAY_SECRET>`.
In Docker locale non serve ngrok: `AI_GATEWAY_URL=http://host.docker.internal:8787`.

## API

| Richiesta | Risposta |
|---|---|
| `GET /health` | 200 `{"services":[...],"down":[...]}` con i servizi **abilitati e sani**; 503 se nessuno (o se bot-service non risponde) |
| `POST /v1/<servizio>/<azione>` | inoltra a bot-service (oggi `POST /v1/editorial/generate`) |
| qualunque altra cosa | 404 |

## Sicurezza

1. **Segreto** nell'header `X-AI-Gateway-Secret`, confronto a tempo costante. **Ogni** richiesta lo richiede, anche `/health` e i
   percorsi inesistenti: il 401 è identico, non si scopre nulla. Mai nel repo.
2. **Non è un proxy aperto**: solo `POST /v1/<servizio>/<azione>` con servizio in `src/registry.ts`; corpo ≤ `MAX_BODY_BYTES`;
   rate limit globale; timeout (502/504 senza dettagli tecnici).
3. **Il modello lo sceglie il servizio**, mai la richiesta.
4. **Dati**: con ngrok i prompt transitano dai suoi server. Regola fissa: **solo contenuti già pubblici** (ambientazione,
   descrizioni di location, tag), mai chat, descrizioni private o dati dei personaggi. Il gateway non registra prompt né
   risposte, solo metodo, percorso, stato e tempo.
5. Ascolta su loopback (`HOST=127.0.0.1`), non su `0.0.0.0`.

**Quota ngrok (piano gratuito)**: c'è un tetto di richieste mensili. Per questo il gioco **non** interroga `/health` con un
timer: la sonda è pigra (solo se qualcuno la chiede), con cache 60 s se ok e 10 s se ko, e il gestionale rilegge i flag ogni
2 minuti a scheda visibile.

## Rotazione del segreto

Genera un valore nuovo (`openssl rand -hex 32`), mettilo in `ai-gateway/.env` (`GATEWAY_SECRET`) e nell'env del server di
gioco (`AI_GATEWAY_SECRET`), poi riavvia i due. Fino ad allora l'AI risulta spenta (401): è il comportamento giusto.

## Trasloco sul server AI dedicato (checklist)

1. Installa Ollama e i modelli, Node (`.nvmrc`) e PM2.
2. Copia `ai-gateway/` e `bot-service/` (con `npm install`, `npm run build`); `bot-service` con `ENABLED_SERVICES=editorial,character-bot`,
   Mongo `botservice` locale al servizio e `ALLOWED_REPLY_ORIGINS` con l'indirizzo pubblico del gioco (nient'altro: nessun segreto di gioco).
3. nginx/Caddy davanti al gateway con TLS e **allowlist IP del server di gioco** nel firewall.
4. Sul server di gioco: `AI_GATEWAY_URL=https://ai.<dominio>`; ngrok non serve più.
5. Opzionale: spostare qui Bibliotecario e riassunti di scena (handler nuovi nel registro, con fallback sul VPS di gioco).

**Il `character-bot` non richiede rete privata:** il gioco gli spinge gli eventi (azione `event`, con la storia e l'indirizzo + token per rispondere) e lui risponde su `/bot-api` del gioco con quel token. Non servono Redis, Mongo di gioco né VPN; il servizio spento = il bot non esiste.

## Sviluppo

`npm test` (porta effimera, bot-service finto), `npm run typecheck`, `npm run build` (`tsc` → `dist/`, avvio `node dist/index.js`).
`typescript` è in `dependencies` perché il server può compilare dopo `npm prune --production` (`00-critical.md` §7).
