# Embeddings Worker Setup (PM2 / Ubuntu)

## Prerequisiti

- Python 3.12+ installato
- Node.js 22+ installato
- PM2 installato globalmente

## Setup Iniziale (Da fare UNA VOLTA su nuovo server)

### 1. Installa dipendenze Python

```bash
cd services/embeddings-worker/python

# Crea virtual environment (se non esiste)
python3 -m venv venv

# Attiva venv
source venv/bin/activate

# Installa dipendenze
pip install -r requirements.txt
```

### 2. Scarica modelli HuggingFace

**IMPORTANTE**: Questo passo scarica ~1GB di modelli e richiede qualche minuto.

```bash
# Con venv attivato
python3 setup-models.py
```

Output atteso:
```
✅ Embedding model downloaded (dimension: 384)
✅ Moderation model downloaded (test label: acceptable)
✅ All models downloaded successfully (2/2)
```

### 3. Verifica installazione

```bash
# Test rapido
python3 -c "from sentence_transformers import SentenceTransformer; print('✅ Embedding OK')"
python3 -c "from transformers import pipeline; print('✅ Transformers OK')"
```

### 4. Build e start servizio

```bash
cd ../..  # Torna alla root del progetto

# Build TypeScript
npm run build

# Start con PM2
pm2 start ecosystem.config.js --only tenpennynovels-embeddings-worker
pm2 logs tenpennynovels-embeddings-worker
```

## Troubleshooting

### Errore: "Moderation model not loaded"

**Causa**: Il modello di moderazione non è stato scaricato o `transformers` non è installato.

**Fix**:
```bash
cd services/embeddings-worker/python
source venv/bin/activate
pip install transformers
python3 setup-models.py
pm2 restart tenpennynovels-embeddings-worker
```

### Errore: "Python subprocess startup timeout"

**Causa**: Il modello embedding non è stato pre-scaricato e sta scaricando al primo avvio (lento).

**Fix**:
```bash
cd services/embeddings-worker/python
source venv/bin/activate
python3 setup-models.py  # Pre-scarica i modelli
pm2 restart tenpennynovels-embeddings-worker
```

### Doppi job embedding

**Causa**: Bug nel ChatController che pubblicava eventi due volte (FIXATO).

**Fix**: Aggiorna il codice alla versione più recente (2026-03-13+).

## Aggiornamento Modelli

Per aggiornare i modelli (es. nuova versione):

```bash
cd services/embeddings-worker/python
source venv/bin/activate

# Rimuovi cache HuggingFace
rm -rf ~/.cache/huggingface/

# Riscarica
python3 setup-models.py

# Restart servizio
pm2 restart tenpennynovels-embeddings-worker
```

## Note

- **Docker**: Se usi Docker, i modelli vengono scaricati automaticamente durante il build (vedi Dockerfile riga 25-26)
- **PM2**: Su Ubuntu con PM2, devi scaricare manualmente i modelli con `setup-models.py`
- **Dimensione**: ~1GB totale (paraphrase-multilingual-MiniLM-L12-v2 ~400MB + MilaNLProc/hate-ita ~500MB)
- **Cache**: I modelli vengono salvati in `~/.cache/huggingface/` e riutilizzati tra restart
