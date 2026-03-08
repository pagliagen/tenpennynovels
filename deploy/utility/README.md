# Deploy Utility Scripts

Script **manuali occasionali** per operazioni speciali. NON usati dal workflow automatico.

---

## Script Disponibili

### `link-env.sh`
Crea symlink per file `.env` condivisi tra directory.

**Quando usare**:
- Setup development locale
- Condividere env vars tra servizi
- Evitare duplicazione file .env

**Cosa fa**:
- Crea symlink da `.env` a `.env.production` per ogni servizio/app
- Utile per development, NON per production

**Esecuzione**:
```bash
./deploy/utility/link-env.sh
```

**Nota**: In production, ogni servizio ha il proprio `.env.production` separato. Non usare symlink in production.

---

## Quando NON Usare Questi Script

- Deploy automatico (GitHub Actions)
- Routine maintenance
- Ogni deploy

Questi script sono per **fix specifici** o **setup speciali** occasionali.

---

## Differenza con Altri Script

| Directory | Scopo | Frequenza |
|-----------|-------|-----------|
| **primo-rilascio-manuale/** | Setup iniziale server | Una volta (primo deploy) |
| **scripts/** | Automazione deploy | Ogni deploy (GitHub Actions) |
| **utility/** | Fix occasionali | Quando serve (manuale) |

---

**Vedi anche**:
- [../scripts/](../scripts/) - Script automazione deploy
- [../primo-rilascio-manuale/](../primo-rilascio-manuale/) - Setup iniziale server
