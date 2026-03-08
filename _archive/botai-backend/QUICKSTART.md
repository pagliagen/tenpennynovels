# BotAI Backend - Quick Start

Script di gestione rapida per avviare/fermare BotAI Backend in modalità dev o prod.

## 🚀 Comandi Disponibili

### Start

```bash
# Development mode (porta 8082)
./botai.sh start dev

# Production mode (porta 8080)
./botai.sh start prod
```

### Stop

```bash
# Stop development
./botai.sh stop dev

# Stop production
./botai.sh stop prod

# Stop tutto (dev + prod + embeddings)
./botai.sh stop all
```

### Restart

```bash
# Restart development
./botai.sh restart dev

# Restart production
./botai.sh restart prod
```

### Status

```bash
# Mostra stato di tutti i servizi
./botai.sh status
```

## 📦 Cosa Fa lo Script

### `./botai.sh start dev`
1. ✅ Crea symlink `.env → .env.development`
2. ✅ Avvia servizio embeddings condiviso (se non già running)
3. ✅ Avvia MongoDB dev (porta 27020)
4. ✅ Avvia BotAI Backend dev (porta 8082)

### `./botai.sh start prod`
1. ✅ Crea symlink `.env → .env.production`
2. ✅ Avvia servizio embeddings condiviso (se non già running)
3. ✅ Avvia MongoDB prod (porta 27019)
4. ✅ Avvia BotAI Backend prod (porta 8080)

### `./botai.sh stop all`
1. ✅ Ferma tutti i container dev
2. ✅ Ferma tutti i container prod
3. ✅ Ferma servizio embeddings

## 🔍 Esempi di Utilizzo

**Workflow tipico sviluppo**:
```bash
# Start dev environment
./botai.sh start dev

# Verifica che tutto funzioni
curl http://localhost:8082/health

# Guarda i logs
docker logs -f botai-backend-dev

# Quando hai finito
./botai.sh stop dev
```

**Switch da dev a prod**:
```bash
# Stop dev
./botai.sh stop dev

# Start prod
./botai.sh start prod

# Il servizio embeddings rimane attivo (è condiviso!)
```

**Cleanup completo**:
```bash
# Ferma tutto
./botai.sh stop all
```

## 🌐 Porte Utilizzate

| Servizio | Dev | Prod | Note |
|----------|-----|------|------|
| BotAI Backend | 8082 | 8080 | API principale |
| MongoDB | 27020 | 27019 | Database isolato |
| Embeddings | 5002 | 5002 | **Condiviso** |

## 📝 Note Importanti

1. **Servizio Embeddings Condiviso**: Il servizio embeddings (porta 5002) è condiviso tra dev e prod. Viene avviato automaticamente e rimane attivo anche quando switchi tra ambienti.

2. **File .env**: Lo script gestisce automaticamente il symlink `.env` per puntare a `.env.development` o `.env.production`.

3. **Hot Reload**: In dev mode, il backend usa `tsx watch` per hot-reload automatico quando modifichi il codice.

4. **Health Checks**: Tutti i servizi hanno health checks configurati. Usa `./botai.sh status` per verificare.

## 🛠️ Troubleshooting

**Problema: "Port already in use"**
```bash
# Verifica cosa sta usando la porta
lsof -i :8082  # o 8080 per prod

# Ferma il servizio conflittuale
./botai.sh stop all
```

**Problema: "Container unhealthy"**
```bash
# Controlla i logs
docker logs botai-backend-dev  # o botai-backend-prod

# Riavvia il servizio
./botai.sh restart dev
```

**Problema: "Embeddings service non risponde"**
```bash
# Riavvia solo embeddings
docker-compose -f docker-compose.embeddings.yml restart

# Verifica
curl http://localhost:5002/health
```

## 📚 Documentazione Completa

- [README.md](./README.md) - Setup completo e configurazione
- [CHANGELOG.md](./CHANGELOG.md) - Storia delle versioni
- [TODO_LIST.md](./TODO_LIST.md) - Roadmap futuri miglioramenti
- [docs/botai/](../../docs/botai/) - Documentazione sistema completo
