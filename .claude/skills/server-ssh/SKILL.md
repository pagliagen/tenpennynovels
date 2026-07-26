---
name: server-ssh
description: Connessione SSH alla VPS OVH di produzione di TenpennyNovels. Usa questa skill quando l'utente chiede di connettersi al server di produzione, controllare PM2/nginx/Docker sulla VPS OVH, investigare un problema in produzione (es. Bad Gateway, servizio down, deploy fallito) o eseguire un comando remoto sulla macchina di produzione.
---

# Server SSH — VPS OVH produzione TenpennyNovels

Esegue comandi remoti via SSH sulla VPS OVH che ospita l'ambiente di produzione di TenpennyNovels (tenpennynovels.com, game.tenpennynovels.com, documenti.tenpennynovels.com, gestione.tenpennynovels.com, api.tenpennynovels.com, ws.tenpennynovels.com).

## Setup (una volta sola)

Le credenziali SSH stanno in un file `.env` **dedicato a questa skill**. Non va condiviso né committato (già in `.gitignore`).

1. `cp .claude/skills/server-ssh/.env.example .claude/skills/server-ssh/.env`
2. Compila `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `SSH_PORT`.

### Config nota del server

- Host: `tenpennynovels.com`
- Utente: `ubuntu`
- Autenticazione: chiave SSH (`SSH_KEY`, default `~/.ssh/tenpennynovels-deploy`)
- Stack in produzione: PM2 (frontend/backend Node), Docker (eventuali servizi containerizzati), nginx come reverse proxy davanti a tutto

## Uso

```bash
bash .claude/skills/server-ssh/scripts/run.sh "<comando remoto>"
```

Esempi:

```bash
bash .claude/skills/server-ssh/scripts/run.sh "pm2 status"
bash .claude/skills/server-ssh/scripts/run.sh "pm2 logs tenpennynovels-unified-backend --lines 100 --nostream"
bash .claude/skills/server-ssh/scripts/run.sh "sudo systemctl status nginx"
bash .claude/skills/server-ssh/scripts/run.sh "sudo nginx -t"
```

## Note

- Se manca `.env` o una credenziale, lo script si ferma con un messaggio chiaro (non prosegue a vuoto).
- Non eseguire comandi distruttivi (restart di servizi, modifiche a config, `docker compose down`, ecc.) senza conferma esplicita dell'utente — vedi le regole del progetto su azioni rischiose.
- Per riavvii applicativi dopo modifiche, seguire i pattern documentati in `.claude/rules/40-workflow.md`: PM2 `startOrRestart` e Docker `stop` + `up -d` (mai `restart` dopo una build).
