# 40 — Workflow: TypeScript, npm, git, CI/CD, deploy

Solo le specificità di questo progetto. Non contiene tutorial su git/npm/Docker.

---

## TypeScript

**Strict mode sempre attivo**, più: `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.

**Path alias** — frontend: `@/*` → `src/*`. Backend: `@shared/*`, `@modules/*`, `@database/*`, `@config/*` (in produzione risolti da `module-alias`).

**Niente `any`**: usa `unknown` + type guard, o generici. Se è inevitabile, documenta il perché nel commento.

**Parametri non usati**: prefisso `_` (`(req, res, _next)`).

**Zod** per validare i dati che entrano dal confine (response API, form, env). `z.infer` per derivare i tipi invece di scriverli a mano.

**Interface** per gli oggetti estendibili, **type** per union/tuple/mapped type.

---

## npm — nessun workspace

Il root ha `"workspaces": []`: **non** è un monorepo npm. Ogni app/service ha il proprio `node_modules`.

```bash
cd services/unified-backend && npm install express   # ✅ installazione per-directory
npm install --workspace=services/unified-backend     # ❌ non esiste in questo repo
```

Gli script `*:all` nel root sono catene di `cd <dir> && npm run <script>` orchestrate da `concurrently` (dev) o in sequenza (build), non la feature nativa dei workspace.

Il deploy itera manualmente su `apps/*/` e `services/*/`, vedi `deploy/scripts/install-all.sh`.

**`dependencies` vs `devDependencies`**: runtime vs build/test. Eccezione importante in `00-critical.md` §7 (build tool usati nel deploy).

**`package-lock.json`**: sempre committato, mai editato a mano. Sui conflitti: `git checkout --theirs`, poi `npm install` per rigenerarlo.

---

## Git

**Branch**: `master` = produzione, `develop` = integrazione. Feature branch: `feature/`, `fix/`, `refactor/`, `hotfix/` + kebab-case.

**Commit**: `<type>(<scope>): <subject>` in imperativo, minuscolo, senza punto finale, max 72 caratteri.
Type: `feat`, `fix`, `refactor`, `perf`, `docs`, `style`, `test`, `chore`, `ci`.

**Pre-commit hook fallito**: correggi il problema e fai un **nuovo commit**. Non usare `--no-verify` (se non richiesto esplicitamente) e non fare `--amend` dopo un hook fallito.

**Mai fare amend/rebase** su commit già pushati o su branch pubblici. `master`/`develop` si aggiornano via merge.

**Operazioni distruttive** (`push --force`, `reset --hard`, `clean -fd`, push diretto su master): richiedono conferma esplicita dell'utente.

**Non committare mai**: `node_modules/`, `.env*` (tranne `.env.example`), segreti, `dist/`, `.next/`, `.claude/settings.local.json`.

---

## CI/CD — deploy SOLO da master

`.github/workflows/deploy.yml`.

| Evento | Job |
|---|---|
| PR su master/develop | solo `build-check` |
| push su develop | solo `build-check` (**nessun deploy**) |
| push su master | `build-check` + `deploy` → **produzione** |
| `workflow_dispatch` | deploy solo se il ref è `master`, altrimenti skip |

Condizione del job: `github.ref == 'refs/heads/master' && (push || workflow_dispatch)`.
Motivo: un solo canale di deploy elimina il rischio di pubblicare per errore (push accidentale su develop, dispatch sul branch sbagliato). Nessun ambiente di staging.

**Installazione dipendenze hash-based**: si calcola lo sha256 di tutti i `package.json` + `package-lock.json`; se coincide con `.deps-hash` l'installazione viene saltata. Per forzare la reinstallazione: `rm .deps-hash`.

**Build backend**: le devDependencies vanno reinstallate **prima** del build (serve `tsc`, e il deploy precedente ha fatto `prune --production`), poi `npm prune --production`.

**Python (embeddings-worker)**: venv + `requirements.txt` + `setup-models.py` per pre-scaricare i modelli HuggingFace. Se il download fallisce (rate limit), i modelli si scaricano al primo uso.

**PM2**: `pm2 startOrRestart ecosystem.config.js --update-env --env production` (non `restart`: `startOrRestart` avvia anche se il processo non c'è e ricarica le env).

**Health check post-deploy**: 15s di attesa, poi `api.tenpennynovels.com/health` (1 tentativo) e `ws.tenpennynovels.com/health` (**5 tentativi**, 5s di intervallo — il WebSocket è più lento a salire per le connessioni MongoDB/Redis).

**Sitemap lastmod**: `git log -1 --format=%cs > apps/landing/public/landing-sitemap-lastmod.txt` prima del rsync.

**Sitemap generation**: step dedicato dopo "Build backend services" (serve `dist/scripts/generate-sitemap.js` già compilato) e prima del `prune --production`: `NODE_ENV=production node dist/scripts/generate-sitemap.js` in `services/unified-backend`. Fallimento non blocca il deploy (rete di sicurezza: cron 03:00). `apps/landing/public/sitemap.xml` e `apps/documents/public/sitemap.xml` sono esclusi da `--delete` in `.github/rsync-exclude.txt`: non stanno nel repo (generati a runtime da `SitemapService`), e senza l'esclusione rsync li cancellerebbe ad ogni deploy lasciando un 404 fino al cron successivo.
**Incidente 2026-08-01** — proprio questo: mancava sia lo step pipeline sia l'esclusione rsync, `sitemap.xml` assente su entrambi i domini per ~9h dopo un deploy delle 12:29 fino al cron delle 03:00 del giorno dopo.

**Secret richiesti**: `SSH_HOST`, `SSH_PORT`, `SSH_USERNAME`, `SSH_PRIVATE_KEY`, `HUGGINGFACE_TOKEN`, `DOCUMENTS_BUILD_BYPASS_SECRET`.

---

## Docker

**Dopo un rebuild: `stop` + `up -d`, mai `restart`.**

```bash
docker compose stop unified-backend
docker compose build unified-backend
docker compose up -d unified-backend      # ✅ nuovo container con la nuova immagine
```

`restart` riavvia il container esistente con l'**immagine vecchia**: le modifiche non vengono applicate.
Incidente 2026-02-23 su embeddings-worker: modifiche apparentemente ignorate per questo motivo.

**Qdrant**: nei `depends_on` usa `service_started`, non `service_healthy` — l'healthcheck è lento a passare mentre il servizio è già operativo, e `service_healthy` causa timeout.

**embeddings-worker/Dockerfile**: `FROM python:3.12-slim`, non Node (vedi `20-backend.md`).

**Multi-stage** per i service Node: builder + runtime con `--omit=dev`, utente non-root, healthcheck.

**Env**: valori sensibili via substitution dall'ambiente host, non hardcodati in `.env.production` committato.

---

## Produzione

VPS OVH, Nginx davanti, PM2 per i processi Node, Docker per Qdrant/Redis/AI.
Accesso e diagnostica: skill `/server-ssh`. Gestione container in locale: skill `/docker-services`.

**Rollback**: identificare l'ultimo commit buono, `git revert` (preferito) o reset + push, che riattiva il deploy. Via SSH è più rapido: reset, rebuild, `pm2 restart`, verifica degli health check.
