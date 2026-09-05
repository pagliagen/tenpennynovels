---
name: sonarcloud
description: Legge metriche, issue e stato del quality gate da SonarCloud (o SonarQube self-hosted). Usa quando l'utente chiede lo stato Sonar, coverage, bug/vulnerabilità/code smell, debito tecnico, quality gate, o le issue di un progetto.
user-invocable: true
---

## Overview

Interroga la Web API di SonarCloud in sola lettura tramite `scripts/sonar.mjs`
(Node 24, `fetch` nativo, nessuna dipendenza npm).

Config in `.claude/skills/sonarcloud/.env` — coperto da `.gitignore` (riga `.env`), non committato.
Al primo uso, se `.env` è vuoto, dillo all'utente: deve incollare `SONAR_TOKEN`
(https://sonarcloud.io/account/security), `SONAR_ORGANIZATION` e `SONAR_PROJECT_KEY`.
Il template è in `.env.example`.

## Comandi

Eseguire dalla root del progetto:

```bash
node .claude/skills/sonarcloud/scripts/sonar.mjs <comando> [opzioni]
```

| Comando | Cosa fa |
|---|---|
| `summary` (default) | Quality gate + metriche chiave (bug, vuln, hotspot, code smell, coverage, duplicazione, ncloc, debito tecnico, rating) + condizioni del gate non superate |
| `issues [--severities=…] [--types=…] [--limit=N] [--resolved=true] [--branch=…]` | Elenco issue, ordinate per severità. `types`: BUG,VULNERABILITY,CODE_SMELL. `severities`: BLOCKER,CRITICAL,MAJOR,MINOR,INFO |
| `measures [--keys=a,b,c]` | Valori grezzi delle metriche |
| `quality-gate` | JSON completo dello stato del quality gate |
| `projects` | Elenco progetti dell'organization (usa solo `SONAR_ORGANIZATION`) |
| `raw <endpoint> [k=v …]` | Chiamata arbitraria alla Web API, es. `raw project_branches/list project=KEY` |

## Esempi

```bash
node .claude/skills/sonarcloud/scripts/sonar.mjs summary
node .claude/skills/sonarcloud/scripts/sonar.mjs issues --types=BUG,VULNERABILITY --limit=20
node .claude/skills/sonarcloud/scripts/sonar.mjs issues --severities=BLOCKER,CRITICAL
node .claude/skills/sonarcloud/scripts/sonar.mjs measures --keys=coverage,ncloc,new_bugs
node .claude/skills/sonarcloud/scripts/sonar.mjs raw project_branches/list project=$SONAR_PROJECT_KEY
```

## Note

- Auth: header `Authorization: Bearer <token>`. Il token non compare mai nell'output.
- `issues` passa sempre `organization` + `componentKeys`: SonarCloud rifiuta la query senza almeno uno dei due.
- Su errore HTTP lo script stampa status + messaggio di SonarCloud ed esce con codice 1.
- Riferimento API: https://sonarcloud.io/web_api
