---
name: server-ovh-1
description: Connessione SSH al server "Server 1" di TenpennyNovels (51.83.47.109, hostname tenpennynovels-sys1) — reinstallato da zero il 06/08/2026, ospita/ospiterà lo stack TenPenny (4 app Next.js, api-gateway, unified-backend, embeddings-worker, MongoDB, Redis, Qdrant, Elasticsearch, Ollama). Temporaneo: è una VPS da 7.6GB RAM, non ancora il SYS-1 dedicato da 32GB pianificato — l'utente prevede lo switch al SYS-1 "il mese prossimo". Non ospita più MysteryInvestigation/TheKeeperArchive/i siti statici, migrati su `server-ovh-2`. Usa questa skill per il setup di TenPenny su questo server (segui RUNBOOK_SERVER1.md, adattando per la RAM ridotta) o per gestirlo una volta operativo.
---

# Server OVH 1 — TenpennyNovels (temporaneo su VPS 7.6GB, in attesa dello switch a SYS-1)

Esegue comandi remoti via SSH su `51.83.47.109`. Storia recente: fino al 06/08/2026 era la VPS condivisa che ospitava TenPenny + MysteryInvestigation + TheKeeperArchive + siti statici; quel giorno è stata **reinstallata da zero** (immagine Ubuntu pulita) per diventare "Server 1" del piano di migrazione (MIGRAZIONE-SERVER.md), temporaneamente su hardware più piccolo di quanto pianificato.

> ⚠️ **Non è ancora il SYS-1**: il piano originale prevedeva un dedicato da 32GB RAM / 6c12t per Server 1 (per via di `qwen3:8b`, che da solo vuole ~5-6GB caricato). Questa è una VPS OVH da **7.6GB RAM totali, 75GB disco** (hostname `vps753946` prima del rename) — l'utente ha deciso di usarla come ripiego temporaneo, con switch al SYS-1 vero "il mese prossimo" (confermato 06/08/2026). Elasticsearch (JVM, pesante) + Ollama con `qwen3:8b` insieme sono al limite su questa RAM — da verificare col carico reale, non dare per scontato che regga come sul SYS-1.
>
> **TenPennyNovels non è ancora live**: deployato ma non ha mai avuto traffico/utenti reali (confermato dall'utente il 06/08/2026) — un errore di configurazione qui non impatta utenti veri, a differenza di quanto la documentazione più vecchia lasciava intendere.

## Setup (una volta sola)

Le credenziali SSH stanno in un file `.env` **dedicato a questa skill**. Non va condiviso né committato (già in `.gitignore`).

1. `cp .claude/skills/server-ovh-1/.env.example .claude/skills/server-ovh-1/.env`
2. Compila `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `SSH_PORT`.

### Config nota del server

- Host: `51.83.47.109`
- Utente: `ubuntu` (pre-esistente sull'immagine OVH dopo il reinstall, sudo NOPASSWD — stesso pattern di `server-ovh-2`, non root diretto nonostante il primo login SSH accetti `root@`)
- Autenticazione: chiave SSH dedicata `~/.ssh/server1-deploy` (diversa da `server-ovh-2`)
- Stack previsto: PM2 (4 app Next.js, api-gateway, unified-backend, embeddings-worker di TenPenny), MongoDB, Redis, Qdrant (Docker), Elasticsearch (dual-write con Qdrant, da provisionare — vedi MIGRAZIONE-SERVER.md), Ollama (`qwen3:8b`, RAG "Bibliotecario")
- **Stato reale verificato il 15/08/2026**: `pm2` non è installato (`command not found`) — le 4 app Next.js + api-gateway/unified-backend/embeddings-worker **non girano ancora** su questo server. In Docker (`sudo docker ps`) ci sono solo `elasticsearch` (porta 9200, loopback) e `qdrant` (porte 6333-6334, loopback). MongoDB **non è in Docker**: è un servizio nativo (`systemctl is-active mongod` → `active`), `mongosh` è già installato globalmente (`/usr/bin/mongosh`). Redis non verificato.

## Uso

```bash
bash .claude/skills/server-ovh-1/scripts/run.sh "<comando remoto>"
```

Esempi:

```bash
bash .claude/skills/server-ovh-1/scripts/run.sh "whoami"
bash .claude/skills/server-ovh-1/scripts/run.sh "pm2 status"
bash .claude/skills/server-ovh-1/scripts/run.sh "sudo systemctl status nginx"
bash .claude/skills/server-ovh-1/scripts/run.sh "free -h"
```

## MongoDB (verificato 15/08/2026)

`mongod` è **nativo** (systemd), bind su `127.0.0.1:27017` **solo loopback**: non è raggiungibile dal Mac, va interrogato **da dentro il server** via `run.sh`, non con un tunnel/client locale.

Credenziali applicative: dentro `MONGODB_URI` in `/home/ubuntu/tenpennynovels/services/unified-backend/.env.production` sul server (root utente `tenpennynovels_app`, non admin — sufficiente per query/CRUD sulle collection applicative). Estrarla al bisogno invece di copiarla qui in chiaro:

```bash
bash .claude/skills/server-ovh-1/scripts/run.sh "grep -i mongo /home/ubuntu/tenpennynovels/services/unified-backend/.env.production"
```

Formato: `mongodb://tenpennynovels_app:<password>@127.0.0.1:27017/tenpennynovels?authSource=tenpennynovels&replicaSet=rs0`.

**Pattern per query anche complesse** (evita l'inferno di quoting tra shell locale → SSH → shell remota → mongosh): passa uno script `--eval` **multi-riga** con `print()`/`printjson()`, dentro doppi apici che racchiudono l'intera stringa; l'URI e il JS interno restano tra apici singoli. Redirigi lo stdout direttamente su file — il banner `→ user@host:porta` va su stderr, **non** finisce nello stdout catturato (niente bisogno di `tail -n +1`/`+2` per scartare righe).

```bash
MONGO_URI="mongodb://tenpennynovels_app:<password>@127.0.0.1:27017/tenpennynovels?authSource=tenpennynovels&replicaSet=rs0"
bash .claude/skills/server-ovh-1/scripts/run.sh "mongosh '$MONGO_URI' --quiet --eval '
print(\"--- risultato ---\");
print(EJSON.stringify(db.characters.findOne({name:\"testuser\"})));
'" > /tmp/out.json
```

Per liste complete di collezioni (es. tutte le skill, tutte le occupation) usa `EJSON.stringify(db.<coll>.find({},{name:1}).toArray())` così ottieni `_id` + `name` in un colpo solo — utile per rimappare gli ObjectId quando copi dati da qui al DB locale (gli ID non coincidono tra ambienti, il seed è indipendente: **serve sempre remap per nome**, mai copiare gli ObjectId as-is tra prod e locale).

Nessun mongo-express/Compass esposto: solo CLI via SSH.

## Note

- Se manca `.env` o una credenziale, lo script si ferma con un messaggio chiaro (non prosegue a vuoto).
- Se il server viene reinstallato di nuovo (es. al momento dello switch al SYS-1): il primo accesso richiede la password temporanea di `ubuntu` (email OVH) da un terminale interattivo vero — questa skill non funziona finché quel primo login + installazione della chiave pubblica non sono stati rifatti a mano.
- Non eseguire comandi distruttivi (reboot, modifiche a firewall/SSH config, cutover DNS) senza conferma esplicita dell'utente — vedi le regole del progetto su azioni rischiose, anche se il rischio reale oggi è più basso di quando questa macchina era condivisa/in produzione.
- Per riavvii applicativi dopo modifiche, seguire i pattern documentati in `.claude/rules/40-workflow.md`: PM2 `startOrRestart` e Docker `stop` + `up -d` (mai `restart` dopo una build).
