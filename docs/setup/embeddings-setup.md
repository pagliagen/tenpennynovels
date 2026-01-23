# Sistema Embeddings - Ricerca Semantica Asincrona

Sistema di embeddings event-driven per ricerca semantica su documenti e location actions. Utilizza Redis pub/sub per processing asincrono con zero-latency sulle API.

## 📋 Panoramica

Il sistema genera **embeddings vettoriali** per permettere ricerche semantiche intelligenti:
- "Come posso creare un personaggio?" → trova documenti su creazione personaggi
- "Quali sono le regole del combattimento?" → trova sezioni su combattimento
- "Azioni di Lord Blackwood al pub" → trova giocate specifiche per personaggio/location

### 🚀 Zero-Latency Design

L'utente non percepisce rallentamenti: gli embeddings vengono generati in background mentre l'API risponde immediatamente.

## 🎯 Architettura Event-Driven

```
┌─────────────────┐      ┌──────────────┐      ┌──────────────────┐
│  API Backends   │─────▶│ Redis Pub/Sub │─────▶│ Embeddings Worker│
│ (Game/Mgmt)     │      │  (3 channels) │      │   (Node.js)      │
└─────────────────┘      └──────────────┘      └──────────────────┘
        │ 150ms                                         │ 100ms
        ▼                                               ▼
┌─────────────────┐                            ┌──────────────────┐
│    MongoDB      │◀───────────────────────────│ Embeddings       │
│   (Documents)   │      Update embeddings     │ Service (Flask)  │
└─────────────────┘                            └──────────────────┘
```

### Componenti

1. **Embeddings Service** (Flask HTTP, port 5001)
   - Modello pre-caricato: `paraphrase-multilingual-MiniLM-L12-v2` (384 dim)
   - Supporto multilingue: Italiano + Inglese + 50+ lingue
   - Performance: ~100ms per embedding

2. **Embeddings Worker** (Node.js/TypeScript)
   - Ascolta 3 canali Redis: document created/updated, location_action created
   - Processing asincrono 24/7
   - Modelli Mongoose ridotti (solo campi essenziali)

3. **Redis Pub/Sub**
   - Event channels per async processing
   - Zero impatto su API latency
   - Throughput: ~19 documenti in 3-4 secondi

## 🐳 Installazione con Docker (Raccomandato)

Il modo più semplice per eseguire il servizio embeddings è tramite Docker, già configurato nell'infrastruttura del progetto.

### Prerequisiti

```bash
# Verifica Docker
docker --version
docker-compose --version
```

### Avvio Rapido

```bash
# Build delle immagini
npm run docker:embeddings:build    # Embeddings service (Flask)
npm run docker:worker:build         # Embeddings worker (Node.js)

# Avvia i servizi (in background)
npm run docker:infra:up             # Avvia tutta l'infrastruttura (MongoDB, Redis, Embeddings)

# Oppure avvia singolarmente
npm run docker:embeddings:up
npm run docker:worker:up

# Verifica che siano attivi
npm run embeddings:health           # Test embeddings service
docker ps | grep embeddings         # Check containers status

# Visualizza logs in tempo reale
npm run docker:embeddings:logs      # Flask service logs
npm run docker:worker:logs          # Worker processing logs
```

### Test Sistema Async

```bash
# Seed documenti con embeddings async
npm run seed:documents -- --force

# Verifica worker processing
npm run docker:worker:logs

# Check embeddings nel database
docker exec tenpennynovels-mongodb mongosh -u admin -p password123 \
  --authenticationDatabase admin tenpennynovels \
  --eval "db.documents.findOne({}, {title: 1, contentEmbedding: 1, embeddingGeneratedAt: 1})"
```

### Gestione Container

```bash
# Avvia tutta l'infrastruttura (MongoDB, Redis, Embeddings)
npm run docker:infra:up

# Ferma tutta l'infrastruttura
npm run docker:infra:down

# Riavvia solo il servizio embeddings
npm run docker:embeddings:restart

# Visualizza logs di tutta l'infrastruttura
npm run docker:infra:logs
```

### Rebuild dopo Modifiche

```bash
# Se modifichi il codice Python, rebuilda l'immagine
npm run docker:embeddings:build
npm run docker:embeddings:restart
```

Il container:
- ✅ Scarica automaticamente il modello al primo build (~118MB)
- ✅ Resta sempre attivo e si riavvia automaticamente in caso di errori
- ✅ È integrato nella stessa rete Docker di MongoDB e Redis
- ✅ Espone la porta 5001 su localhost

---

## 🖥️ Installazione Manuale (Alternativa)

Se preferisci eseguire il servizio senza Docker:

### Prerequisiti

```bash
# Verifica versione Python (richiesto >= 3.8)
python3 --version

# Verifica pip
pip3 --version
```

### Step 1: Installare Virtual Environment e Dipendenze

```bash
# Vai nella root del progetto
cd /path/to/tenpennynovels

# Installa tutto automaticamente
npm run embeddings:install
```

Oppure manualmente:

```bash
cd services/embeddings-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Note per macOS con Apple Silicon (M1/M2/M3):**
Il virtual environment utilizzerà automaticamente le versioni ottimizzate per Apple Silicon.

### Step 2: Avviare il Servizio

```bash
# Avvia il microservizio embeddings
npm run embeddings:start
```

Il servizio si avvierà su **http://127.0.0.1:5001** e caricherà automaticamente il modello (~118MB, download automatico al primo avvio).

Output atteso:
```
🚀 Initializing embeddings generator with model: paraphrase-multilingual-MiniLM-L12-v2
Loading model: paraphrase-multilingual-MiniLM-L12-v2
✅ Model loaded successfully
   Model dimension: 384
🚀 Starting TenpennyNovels Embeddings Service
   Host: 127.0.0.1
   Port: 5001
✅ Service ready to accept requests
 * Running on http://127.0.0.1:5001
```

### Step 3: Verifica Salute del Servizio

In un altro terminale:

```bash
# Verifica che il servizio risponda
npm run embeddings:health

# Output atteso:
# {
#   "status": "healthy",
#   "service": "embeddings-service",
#   "model": "paraphrase-multilingual-MiniLM-L12-v2"
# }
```

### Step 4: Configurazione (Opzionale)

Se vuoi personalizzare host/port, copia il file di configurazione:

```bash
cd services/embeddings-service
cp .env.example .env
# Modifica .env secondo le tue necessità
```

Variabili disponibili:
```bash
EMBEDDINGS_SERVICE_HOST=127.0.0.1
EMBEDDINGS_SERVICE_PORT=5001
EMBEDDINGS_MODEL=paraphrase-multilingual-MiniLM-L12-v2
LOG_LEVEL=INFO
```

### Step 5: Test Utilizzo

```bash
# Con il servizio attivo, testa la generazione di embeddings
curl -X POST http://127.0.0.1:5001/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "Come posso creare un personaggio?"}'

# Output: {"success":true,"embedding":[0.123,-0.456,...],"dimensions":384}
```

**Ora puoi eseguire il seed dei documenti:**

```bash
# Il seeder userà automaticamente il servizio HTTP
npm run seed:documents
```

## 🚀 Installazione Server (Production)

### Server Ubuntu/Debian

```bash
# 1. Connetti al server
ssh user@your-server.com

# 2. Naviga nella directory del progetto
cd /var/www/tenpennynovels

# 3. Installa Python3 e pip (se non presenti)
sudo apt update
sudo apt install -y python3 python3-pip python3-venv

# 4. Crea virtual environment
cd services/embeddings-service
python3 -m venv venv
source venv/bin/activate

# 5. Installa dipendenze
pip install -r requirements.txt

# 6. Verifica installazione
python3 -c "from flask import Flask; from sentence_transformers import SentenceTransformer; print('✅ OK')"

# 7. Test servizio
python3 embeddings_service.py
# Ctrl+C per fermare
```

### Configurazione Systemd Service

Per mantenere il servizio embeddings sempre attivo in background:

```bash
# Crea file service
sudo nano /etc/systemd/system/tenpennynovels-embeddings.service
```

Contenuto del file:
```ini
[Unit]
Description=TenpennyNovels Embeddings Microservice
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/tenpennynovels/services/embeddings-service
Environment="EMBEDDINGS_SERVICE_HOST=127.0.0.1"
Environment="EMBEDDINGS_SERVICE_PORT=5001"
Environment="LOG_LEVEL=INFO"
ExecStart=/var/www/tenpennynovels/services/embeddings-service/venv/bin/python3 embeddings_service.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Attiva e avvia il servizio:

```bash
# Ricarica systemd
sudo systemctl daemon-reload

# Abilita avvio automatico
sudo systemctl enable tenpennynovels-embeddings

# Avvia il servizio
sudo systemctl start tenpennynovels-embeddings

# Verifica stato
sudo systemctl status tenpennynovels-embeddings

# Visualizza logs
sudo journalctl -u tenpennynovels-embeddings -f
```

### Nginx Reverse Proxy (Opzionale)

Se vuoi esporre il servizio via HTTPS:

```nginx
# /etc/nginx/sites-available/embeddings.tenpennynovels.com
server {
    listen 443 ssl http2;
    server_name embeddings.tenpennynovels.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout per batch processing
        proxy_read_timeout 120s;
        proxy_connect_timeout 120s;
    }
}

[Install]
WantedBy=multi-user.target
```

Abilita e avvia:
```bash
sudo systemctl daemon-reload
sudo systemctl enable tenpennynovels-embeddings
sudo systemctl start tenpennynovels-embeddings
sudo systemctl status tenpennynovels-embeddings
```

### Server CentOS/RHEL

```bash
# Installazione Python3
sudo yum install -y python3 python3-pip

# Segui gli stessi step di Ubuntu dal punto 4
```

### Docker (Alternative)

Se preferisci usare Docker:

```bash
# Build immagine con embeddings
docker build -f docker/Dockerfile.embeddings -t tenpennynovels-embeddings .

# Run container
docker run -d \
  --name embeddings \
  --network tenpennynovels-network \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  -e EMBEDDINGS_MODEL=paraphrase-multilingual-MiniLM-L12-v2 \
  tenpennynovels-embeddings
```

## 🔧 Configurazione MongoDB Atlas (se usi Atlas)

MongoDB Atlas supporta vector search nativo:

```bash
# 1. Vai su MongoDB Atlas Console
# 2. Seleziona il tuo cluster
# 3. Vai su "Search" → "Create Search Index"
# 4. Seleziona collection "documents"
# 5. Usa questa configurazione JSON:
```

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "contentEmbedding": {
        "type": "knnVector",
        "dimensions": 384,
        "similarity": "cosine"
      },
      "title": {
        "type": "string"
      },
      "type": {
        "type": "string"
      }
    }
  }
}
```

## 🧪 Testing

### Test Locale

```bash
# Genera embeddings per documenti esistenti
npm run embeddings:generate

# Test semantic search
npm run embeddings:search "Come creo un personaggio?"

# Output atteso:
# 🔍 Semantic Search Results:
# 1. Creazione Personaggio (95.2% match)
# 2. Sistema di Base (87.4% match)
# 3. Caratteristiche (82.1% match)
```

### Test CLI Interattivo

```bash
# Avvia CLI Q&A
npm run document:chat

# Prompt interattivo:
# 💬 Document Q&A (digita 'exit' per uscire)
# > Come posso creare un personaggio?
#
# 📄 Trovati 3 documenti rilevanti...
```

## 📊 Monitoraggio Performance

### Metriche da Monitorare

1. **Tempo Generazione Embedding**: ~50-200ms per documento
2. **Memoria Utilizzata**: ~500MB per il modello caricato
3. **Disk Space**: ~118MB per il modello

### Logging

I log sono disponibili in:
```bash
# Development
tail -f logs/embeddings-dev.log

# Production
tail -f /var/log/tenpennynovels/embeddings.log
```

## 🔍 Troubleshooting

### Errore: "ModuleNotFoundError: No module named 'sentence_transformers'"

```bash
# Verifica installazione
pip3 show sentence-transformers

# Re-installa se necessario
pip3 install --upgrade sentence-transformers
```

### Errore: "torch not compiled with CUDA support"

Normale su server senza GPU. Il modello userà CPU (più lento ma funzionale).

```bash
# Per accelerare su CPU, installa versione ottimizzata:
pip3 install torch --index-url https://download.pytorch.org/whl/cpu
```

### Errore: "Out of Memory"

Riduci batch size:
```bash
# Nel .env
EMBEDDINGS_BATCH_SIZE=16  # default: 32
```

### Download Lento del Modello

Pre-download manuale da Hugging Face:
```bash
wget https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/main/pytorch_model.bin
# Sposta in ~/.cache/huggingface/
```

## 🔒 Sicurezza

### Permessi File

```bash
# Imposta permessi corretti per cache directory
chmod 755 ~/.cache/huggingface
chown -R $USER:$USER ~/.cache/huggingface
```

### Firewall (se embeddings service su porta separata)

```bash
# Apri porta 5000 (esempio)
sudo ufw allow 5000/tcp
```

## 📈 Performance Tuning

### Ottimizzazioni CPU

```bash
# Usa tutti i core disponibili
export OMP_NUM_THREADS=$(nproc)
export MKL_NUM_THREADS=$(nproc)
```

### Ottimizzazioni Memoria

```python
# In embeddings service, usa lazy loading
model = SentenceTransformer('model-name', device='cpu')
model.max_seq_length = 256  # Riduce memoria
```

## 🆘 Supporto

### Documentazione Ufficiale
- [Sentence Transformers](https://www.sbert.net/)
- [Hugging Face Models](https://huggingface.co/models)

### Log Utili

```bash
# Check model info
python3 -c "from sentence_transformers import SentenceTransformer; m = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2'); print(m)"

# Check torch version
python3 -c "import torch; print(torch.__version__)"
```

## ✅ Checklist Pre-Produzione

- [ ] Python 3.8+ installato
- [ ] Sentence Transformers installato
- [ ] Modello scaricato (~118MB)
- [ ] Virtual environment configurato
- [ ] MongoDB indice vettoriale creato
- [ ] Environment variables configurate
- [ ] Test generazione embeddings passed
- [ ] Test semantic search passed
- [ ] Systemd service configurato (opzionale)
- [ ] Monitoring setup
- [ ] Backup strategy definita

## 📝 Note Aggiuntive

### Modelli Alternativi

Se hai vincoli di spazio/memoria, puoi usare modelli più leggeri:

```bash
# Modello mini (33MB, 384 dim)
EMBEDDINGS_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Modello multilingual più accurato (500MB, 768 dim)
EMBEDDINGS_MODEL=sentence-transformers/distiluse-base-multilingual-cased-v2
```

### Aggiornamenti

```bash
# Aggiorna sentence-transformers
pip3 install --upgrade sentence-transformers

# Pulisci cache vecchi modelli
rm -rf ~/.cache/huggingface/transformers/*
```

---

**Ultima revisione**: 2025-10-21
**Versione**: 1.0.0
