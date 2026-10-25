# TenPennyNovels Scripts

Script del progetto TenPennyNovels: **seeder** del database, migrazioni una tantum, setup locale e un benchmark per Ollama.

---


## 📁 Struttura

```
scripts/
├── seeders/                 # Seeder standalone (package a sé: npm run seed:dev:* / seed:prod:*)
│   ├── seeders/             # un file per seeder (Document, Location, Item, Skill, Occupation, User, Forum, …)
│   ├── data/                # CSV e documenti markdown sorgente
│   └── utils/               # connessione, export documenti, costanti condivise (es. systemBot)
├── migrations/              # migrazioni una tantum (add-character-types, lock-occultismo-skill, …)
├── setup-local-env.sh       # prepara i .env locali
└── bench-ollama-rag.mjs     # confronto modelli Ollama sui prompt del Bibliotecario (da lanciare sul server)
```

I tool di immagini (`glass-ball`), il monitor dei log (`log-monitor`) e le utility per categoria **non esistono più** in questo repository.

---

## 🌱 Seeders

**Path:** `scripts/seeders/`

Seeders standalone con **MongoDB native driver** (NO Mongoose). Ogni seeder può girare indipendentemente senza dipendenze da `unified-backend`.

### Architettura

- **Package dedicato**: `seeders/package.json` con dipendenze isolate
- **MongoDB native**: Usa `MongoClient` diretto, non modelli Mongoose
- **Standalone**: Possono girare in produzione senza clonare tutto il backend
- **Non tutti idempotenti**: `Location`, `Skill`, `Occupation`, `SocialClassConfig`, `User`, `Document` saltano se i dati esistono (salvo `--force`, che cancella e ricrea); **`Item`, `Service` e `Forum` fanno `deleteMany({})` a ogni run, anche senza `--force`** (su un forum con contenuti veri cancellerebbero tutto)


### Seeders disponibili

| Comando (`npm run …` dalla root) | Cosa fa | Sorgente |
|---|---|---|
| `seed:dev:users` | utenti di test e utente di sistema dei bot | dati nel codice |
| `seed:dev:locations` | location (Londra 1895) | `data/locations.csv` |
| `seed:dev:location-tags` | **solo** i tag delle location già nel DB (non cancella nulla) | `data/locations.csv` |
| `seed:dev:items` · `skills` · `occupations` · `social-classes` · `services` | dati di gioco | `data/*.csv` |
| `seed:dev:documents` | documenti markdown → HTML (**con `--force` cancella quelli scritti dal gestionale**) | `data/documents/**/*.md` |
| `seed:dev:reindex-documents` | riallinea l'indice di ricerca ai documenti nel DB, senza toccare Mongo (`-- --dry-run`, `-- --wait`) | DB |
| `seed:dev:forum` · `system-config` | forum iniziale, configurazioni di sistema | dati nel codice |
| `seed:dev:bots` | personaggi dei bot (`BOT_CHARACTERS`); stampa le schede per `bot-service` | dati nel codice |
| `seed:dev:all` · `seed:dev:all:force` | **eseguono ogni seeder con `--force`** (distruttivo): users, bots, locations, items, services, skills, occupations, social-classes, documents, forum, system-config. **Non** includono `location-tags` e `reindex-documents`. | |

Le stesse voci esistono con prefisso `seed:prod:` (users, bots, locations, items, services, skills, occupations, social-classes, documents, forum, system-config); `location-tags` e `reindex-documents` sono solo `dev`; `seed:prod:all` non include `bots`. Il seeder utenti **non va importato** da altri file (eseguirebbe il suo `main()`): le costanti condivise stanno in `seeders/utils/`.

### Esecuzione

```bash
# Setup (prima volta)
cd scripts/seeders && npm install

# Dalla root
# ATTENZIONE: `seed:*:all` esegue TUTTI i seeder con --force e cancella i dati esistenti (compresi i documenti scritti dal gestionale).
npm run seed:dev:skills         # un seeder alla volta (skills, locations, occupations, users…: salta se i dati esistono)
# ma `seed:*:items`, `:services` e `:forum` cancellano e ricreano SEMPRE
npm run seed:dev:all            # ricrea tutto (distruttivo)
```


### Formato Frontmatter (Documents)

```markdown
---
title: "Londra 1890"
slug: "londra-1890"
type: "ambientazione"
group: "geografia"
visibility: "pubblico"
description: "La capitale dell'impero britannico"
order: 1
---

# Contenuto markdown...
```

---


---

## 📂 Data Sources

**Path:** `scripts/seeders/data/`

Formato CSV standard: **separatore `;`**, UTF-8.

```
scripts/seeders/data/
├── locations.csv            # nome, slug, descrizione, parent, coordinate, tags…
├── items.csv                # oggetti (nome, tipo, prezzo, rarità)
├── skills.csv               # skill (nome, tipo, stat associata)
├── occupations.csv          # professioni
├── social-class-configs.csv # classi sociali
├── services.csv             # servizi continuativi
├── subtypes.csv             # sottotipi dei documenti
├── documents.csv            # indice dei documenti
└── documents/               # markdown sorgente (ambientazione/, regolamento/)
```

Ogni file markdown ha frontmatter YAML (vedi sopra).

---

## 🔒 Security Notes

- ⚠️ **NON committare** `.env` con credenziali
- ⚠️ Le chiavi SSH restano in `~/.ssh/`, mai nel repository
- ⚠️ Gli URI MongoDB stanno in variabili d'ambiente, non nel codice
- ⚠️ `--force` cancella dati: mai su un database con contenuti scritti dal gestionale

---

## 📚 See Also

- [Seeders: guida](../docs/tecnica/scripts/seeders.md)
- [Project Root README](../README.md)

