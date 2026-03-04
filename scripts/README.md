# TenpennyNovels Scripts

Raccolta organizzata di script per gestione database, seeding, utilities e monitoring del progetto TenpennyNovels.

---

## 📁 Struttura

```
scripts/
├── seeders/              # Database seeders standalone
├── utilities/            # Script utility organizzati per categoria
├── glass-ball/           # Image processing tool (glass effect)
├── log-monitor/          # PM2 log monitoring dashboard
├── data/                 # CSV e markdown data sources
└── tsconfig.json         # TypeScript config condivisa
```

---

## 🌱 Seeders

**Path:** `scripts/seeders/`

Seeders standalone con **MongoDB native driver** (NO Mongoose). Ogni seeder può girare indipendentemente senza dipendenze da `unified-backend`.

### Architettura

- **Package dedicato**: `seeders/package.json` con dipendenze isolate
- **MongoDB native**: Usa `MongoClient` diretto, non modelli Mongoose
- **Standalone**: Possono girare in produzione senza clonare tutto il backend
- **Idempotenti**: Puliscono e ri-popolano collections ad ogni run

### Seeders Disponibili

| Seeder | Descrizione | Source |
|--------|-------------|--------|
| **DocumentSeeder** | Documenti markdown → HTML (ambientazione/regolamento) | `data/documents/**/*.md` |
| **LocationSeeder** | Location gioco (Londra 1890) | `data/locations.csv` |
| **ItemSeeder** | Items/oggetti negozio | `data/items.csv` |
| **SkillSeeder** | Skills personaggi | `data/skills.csv` |
| **OccupationSeeder** | Occupazioni/professioni | `data/occupations.csv` |
| **SocialClassConfigSeeder** | Configurazione classi sociali | `data/social-classes.csv` |
| **UserSeeder** | Utenti test | Inline data |
| **ForumSeeder** | Forum posts iniziali | Inline data |

### Esecuzione

```bash
# Setup (prima volta)
cd scripts/seeders
npm install

# Singolo seeder
tsx DocumentSeeder.ts
tsx LocationSeeder.ts
# ...

# TODO: Run all seeders in order
# tsx run-all.ts
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

## 🛠️ Utilities

**Path:** `scripts/utilities/`

Script utility organizzati per categoria. Usano Mongoose e dipendono da `unified-backend` models.

### Categorie

#### 📦 lib/ - Shared Libraries
- **database.ts** - MongoDB connection helper per altri scripts
- **embeddings.ts** - Helper per generazione embeddings (ML)

#### 🤖 bots/ - Bot Generation
- **generate-bot.ts** - Genera singolo bot character con AI personality
- **generate-whitechapel-bots.ts** - Batch generation bots per Whitechapel district

#### 👤 characters/ - Character Management
- **approve-character.ts** - Approva character draft per renderlo playable
- **draft-character.ts** - Crea draft character da template

#### 📍 locations/ - Location Utilities
- **add-positions.js** - Aggiunge coordinate x,y alle location per mappa
- **complete-positions.js** - Completa coordinate mancanti
- **normalize-tags.ts** - Normalizza tag location (lowercase, trim)
- **check-slugs.ts** - Verifica unicità slug location

#### 🔍 search/ - Search Tools
- **chat-search.ts** - Ricerca full-text nei messaggi chat
- **document-search.ts** - Ricerca semantica documenti (Qdrant)

#### 📊 analytics/ - Analytics
- **aggregation.ts** - Aggregazioni statistiche (user activity, chat metrics)

#### 👑 admin/ - Admin Tools
- **create-users.js** - Crea utenti admin/test
- **check-skills.ts** - Verifica integrità database skills
- **seed-config.ts** - Seed configurazioni di sistema (limiti, regole)
- **import-chat.ts** - Importa conversazioni chat da JSON/CSV

#### 🔧 maintenance/ - Maintenance
- **reset-db.sh** - Drop database e ricrea da zero
- **verify-data.ts** - Verifica integrità relazioni (orphans, references)

### Esecuzione Utilities

```bash
# Eseguire dalla root del progetto
tsx scripts/utilities/bots/generate-bot.ts --name "Jack the Ripper" --location whitechapel
tsx scripts/utilities/admin/create-users.js
bash scripts/utilities/maintenance/reset-db.sh
```

**Nota:** Utilities richiedono `unified-backend` models, quindi MongoDB URI deve puntare al database corretto.

---

## 🔮 Glass Ball

**Path:** `scripts/glass-ball/`

Tool per applicare effetto "palla di vetro" realistica a immagini location usando **ImageMagick**.

### Requisiti

```bash
brew install imagemagick
```

### Uso

```bash
cd scripts/glass-ball

# Batch processing (tutte le immagini in input/)
./batch-process.sh

# Singola immagine
magick input/your-image.jpg \
  -resize 700x700^ \
  -gravity center \
  -extent 700x700 \
  -distort barrel "0.65 0.0 0.0 1.0" \
  # ... (vedi README nel folder per comando completo)
  output/result.png
```

### Effetti Applicati

1. ✅ Distorsione barrel (curvatura palla di vetro)
2. ✅ Maschera circolare con bordi sfumati
3. ✅ Tonalità ambrata/seppia (Victorian style)
4. ✅ Riflesso vetro (highlight radiale)
5. ✅ Bordo ambrato trasparente (doppio layer blur)

**Performance:** ~2-3 secondi per immagine, output ~150-200KB PNG

Vedi `glass-ball/README.md` per dettagli parametri e customizzazione.

---

## 📊 Log Monitor

**Path:** `scripts/log-monitor/`

Dashboard web real-time per monitorare log PM2 dei servizi backend in produzione via SSH.

### Features

- **Real-time streaming**: WebSocket + SSH2
- **Auto-rotation**: Switch automatico tra servizi
- **Error detection**: Alert audio + visual quando rileva errori
- **6 servizi**: Gateway, Auth, Game, Management, Embeddings, Worker
- **Keyboard shortcuts**: Tasti 1-6 per switch rapido

### Setup

```bash
# Assicurati che SSH key sia caricata
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/tenpennynovels_deploy

# Avvia dashboard
cd scripts/log-monitor
npm install
npm start
```

Dashboard disponibile su: **http://localhost:9001**

### Servizi Monitorati

1. **Gateway** - API Gateway (port 8000)
2. **Auth** - Authentication Backend (port 3000)
3. **Game** - Game Backend (port 3001)
4. **Management** - Management Backend (port 3002)
5. **Embeddings** - ML Service (Flask, port 5001)
6. **Worker** - Embeddings Queue Worker (Bull + Redis)

### Error Detection

Rileva automaticamente pattern di errore nei log:
```
error | exception | fatal | crash | killed | failed | timeout | refused | cannot | errno
```

Quando trova errore:
- 🔊 Alert audio (3 beeps)
- 🔴 Badge rosso sul bottone servizio
- 🎯 Auto-switch al servizio con errore (se auto-rotate attivo)

Vedi `log-monitor/README.md` per configurazione SSH credentials e settings avanzati.

---

## 📂 Data Sources

**Path:** `scripts/data/`

### CSV Files

Formato standard: **separatore `;`**, encoding **UTF-8**

```
scripts/data/
├── locations.csv          # Location gioco (nome, slug, descrizione, parent, coordinate)
├── items.csv              # Items negozio (nome, tipo, prezzo, rarità)
├── skills.csv             # Skills (nome, tipo, stat associata)
├── occupations.csv        # Professioni (nome, skills, income)
└── social-classes.csv     # Classi sociali (nome, tier, bonus)
```

### Markdown Documents

```
scripts/data/documents/
├── ambientazione/
│   ├── londra-1890.md
│   ├── whitechapel.md
│   └── ...
└── regolamento/
    ├── creazione-pg.md
    ├── sistema-combattimento.md
    └── ...
```

Ogni file markdown ha frontmatter YAML (vedi sezione Seeders).

---

## 🚀 Quick Start

### 1. Setup Seeders (Prima Volta)

```bash
cd scripts/seeders
npm install
```

### 2. Seed Database

```bash
# Seed documenti da markdown
tsx DocumentSeeder.ts

# Seed location da CSV
tsx LocationSeeder.ts

# TODO: Run all seeders
# tsx run-all.ts
```

### 3. Utilities (quando servono)

```bash
# Dalla root del progetto
tsx scripts/utilities/admin/create-users.js
tsx scripts/utilities/bots/generate-whitechapel-bots.ts
```

### 4. Monitoring (Development)

```bash
cd scripts/log-monitor
npm install
npm start
# → http://localhost:9001
```

---

## 🗂️ File Rimossi (Cleanup Feb 2025)

### Deleted

- ❌ **migrations/** - Migration scripts (nulla in produzione, db droppa/ricrea)
- ❌ **deploy/** - FTP deploy scripts obsoleti (ora Docker)
- ❌ **scripts/lib/deploy-*.sh** - Bash deployment scripts manuali
- ❌ **scripts/populate-from-csv*.ts** - Vecchi seeders duplicati
- ❌ **scripts/migrate-*.ts** - Migration bot gender, location occupants

### Reorganized

- ✅ **log-monitor/** moved from root → `scripts/log-monitor/`
- ✅ **test-glass-ball/** renamed → `scripts/glass-ball/`
- ✅ Root-level scripts → organized in `scripts/utilities/` by category

---

## 📝 TODOs

### Seeders
- [ ] Convertire seeders Mongoose → MongoDB native driver (LocationSeeder, ItemSeeder, etc.)
- [ ] Creare `run-all.ts` orchestrator per eseguire tutti i seeders in ordine
- [ ] Verificare bloat ForumSeeder (32KB) e ItemSeeder (40KB) - estrarre dati in CSV?

### Utilities
- [ ] Aggiungere README in ogni sottocartella utilities/ con esempi uso
- [ ] Standardizzare argomenti CLI (usare yargs o commander)
- [ ] Verificare quali utilities sono ancora usate vs obsolete

### Documentation
- [ ] Aggiungere esempi uso per ogni utility script
- [ ] Documentare formato CSV per ogni data source
- [ ] Creare troubleshooting section per errori comuni

---

## 🔒 Security Notes

- ⚠️ **NON committare** `.env` files con credenziali
- ⚠️ **log-monitor** è SOLO per uso locale development, NON deployare in produzione
- ⚠️ SSH keys devono rimanere in `~/.ssh/`, MAI nel repository
- ⚠️ Credenziali MongoDB URI in environment variables, non hardcoded

---

## 📚 See Also

- [Seeders standalone pattern](./seeders/DocumentSeeder.ts) - Esempio MongoDB native
- [Glass Ball ImageMagick](./glass-ball/README.md) - Dettagli effetti vetro
- [Log Monitor](./log-monitor/README.md) - Dashboard PM2 monitoring
- [Project Root README](../README.md) - Documentazione progetto principale

---

**Made for TenpennyNovels** 🎩🔮
