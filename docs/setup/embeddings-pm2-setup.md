# Embeddings Services - PM2 Setup Guide

Guida per configurare gli embeddings services (Flask + Node.js worker) con PM2 su OVH VPS.

---

## 📋 Overview

Gli embeddings services consistono di due componenti:

1. **embeddings-service** - Flask HTTP server (Python)
   - Port: 5001
   - Gestisce richieste di generazione embeddings
   - Model: paraphrase-multilingual-MiniLM-L12-v2

2. **embeddings-worker** - Node.js worker
   - Ascolta eventi Redis pub/sub
   - Processa embeddings in modo asincrono
   - Event-driven architecture

---

## 🚀 Setup Step-by-Step

### 1. Connetti al Server OVH

```bash
ssh ubuntu@misteryinvestigation.it
# Password: Z2pAVdqUbFF7

cd /home/ubuntu/tenpennynovels
```

### 2. Installa Python e Dependencies (Se Necessario)

```bash
# Verifica Python 3
python3 --version
# Should be Python 3.8+

# Installa pip se mancante
sudo apt update
sudo apt install -y python3-pip python3-venv
```

### 3. Setup Embeddings Service (Flask - Python)

```bash
cd services/embeddings-service

# Crea virtual environment
python3 -m venv venv

# Attiva virtual environment
source venv/bin/activate

# Installa dependencies
pip install -r requirements.txt

# Download model (se non già presente)
python3 download_model.py

# Test manuale
python3 embeddings_service.py
# Dovrebbe startare su http://127.0.0.1:5001
# Premi Ctrl+C per terminare il test

# Disattiva virtual environment
deactivate
```

### 4. Setup Embeddings Worker (Node.js)

```bash
cd /home/ubuntu/tenpennynovels/services/embeddings-worker

# Installa dependencies (se non già fatto)
npm install

# Test manuale
npm run dev
# Dovrebbe connettersi a Redis
# Premi Ctrl+C per terminare il test
```

### 5. Crea PM2 Ecosystem Config per Embeddings

Crea o modifica il file PM2 config esistente:

```bash
cd /home/ubuntu/tenpennynovels

# Modifica ecosystem.config.js o crea ecosystem-embeddings.config.js
nano ecosystem.config.js
```

**Aggiungi questi apps all'ecosystem:**

```javascript
module.exports = {
  apps: [
    // ... altri servizi esistenti ...

    // Embeddings Service (Flask/Python)
    {
      name: 'embeddings-service',
      cwd: '/home/ubuntu/tenpennynovels/services/embeddings-service',
      script: 'venv/bin/python3',
      args: 'embeddings_service.py',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
      error_file: '/home/ubuntu/tenpennynovels/logs/embeddings-service-error.log',
      out_file: '/home/ubuntu/tenpennynovels/logs/embeddings-service-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },

    // Embeddings Worker (Node.js)
    {
      name: 'embeddings-worker',
      cwd: '/home/ubuntu/tenpennynovels/services/embeddings-worker',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/home/ubuntu/tenpennynovels/logs/embeddings-worker-error.log',
      out_file: '/home/ubuntu/tenpennynovels/logs/embeddings-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
```

### 6. Build Embeddings Worker

```bash
cd /home/ubuntu/tenpennynovels/services/embeddings-worker

# Build TypeScript
npm run build

# Verifica che dist/index.js esista
ls -la dist/
```

### 7. Start Services con PM2

```bash
cd /home/ubuntu/tenpennynovels

# Start embeddings service
pm2 start ecosystem.config.js --only embeddings-service

# Start embeddings worker
pm2 start ecosystem.config.js --only embeddings-worker

# Verifica status
pm2 status

# Check logs
pm2 logs embeddings-service --lines 20
pm2 logs embeddings-worker --lines 20
```

### 8. Test Funzionalità

```bash
# Test embeddings service HTTP
curl -X POST http://localhost:5001/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "Test embedding generation"}'

# Should return JSON con array di numeri (embedding vector)

# Test embeddings worker (verifica logs)
pm2 logs embeddings-worker --lines 10
# Dovrebbe mostrare "Connected to Redis" o simile
```

### 9. Save PM2 Configuration

```bash
# Salva configurazione PM2
pm2 save

# Verifica startup script
pm2 startup
# Esegui il comando suggerito se necessario
```

---

## 🔍 Verifica e Troubleshooting

### Check Services Status

```bash
# PM2 status
pm2 status

# Logs in real-time
pm2 logs

# Logs specifici
pm2 logs embeddings-service
pm2 logs embeddings-worker

# Memory/CPU usage
pm2 monit
```

### Common Issues

#### 1. Embeddings Service non parte

```bash
# Check Python virtual environment
cd /home/ubuntu/tenpennynovels/services/embeddings-service
source venv/bin/activate
python3 embeddings_service.py
# Guarda errori

# Check dependencies
pip list

# Reinstall se necessario
pip install -r requirements.txt
```

#### 2. Model non trovato

```bash
cd /home/ubuntu/tenpennynovels/services/embeddings-service
source venv/bin/activate
python3 download_model.py

# Verifica download
ls -lh models/
```

#### 3. Worker non si connette a Redis

```bash
# Check Redis
redis-cli ping
# Should return: PONG

# Check Redis configuration in .env.production
cat /home/ubuntu/tenpennynovels/.env.production | grep REDIS

# Check worker logs
pm2 logs embeddings-worker --lines 50
```

#### 4. Port 5001 già in uso

```bash
# Check cosa usa port 5001
sudo netstat -tulpn | grep 5001

# Kill processo se necessario
sudo kill <PID>

# Restart embeddings service
pm2 restart embeddings-service
```

---

## 🔄 Deployment Integration

Con questa configurazione, il deployment automatico farà:

```bash
# Durante npm run deploy:
pm2 restart embeddings-service  # ✅ Restart Flask service
pm2 restart embeddings-worker    # ✅ Restart Node.js worker
pm2 status                       # ✅ Verifica tutti i servizi
```

Configurazione in `.env.deploy`:
```bash
DEPLOY_EMBEDDINGS=true
EMBEDDINGS_USE_DOCKER=false
PM2_EMBEDDINGS_SERVICE=embeddings-service
PM2_EMBEDDINGS_WORKER=embeddings-worker
```

---

## 📊 Services Architecture

```
┌─────────────────────────────────────────┐
│         Frontend Applications            │
│   (Create/Update Documents/Actions)     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│          Backend Services                │
│  (Publish Redis events on changes)      │
└──────────────┬──────────────────────────┘
               │
               ▼ Redis Pub/Sub
┌──────────────────────────┐
│   Embeddings Worker       │ ◄─── PM2 Managed
│   (Node.js)              │
│   - Listen Redis events  │
│   - Send HTTP requests   │
└────────────┬─────────────┘
             │
             ▼ HTTP POST
┌──────────────────────────┐
│   Embeddings Service      │ ◄─── PM2 Managed
│   (Flask/Python)         │
│   - Generate embeddings  │
│   - Return vectors       │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   MongoDB                 │
│   (Store embeddings)     │
└──────────────────────────┘
```

---

## 🎯 Next Steps

Dopo il setup:

1. ✅ Verifica che entrambi i servizi siano online: `pm2 status`
2. ✅ Test HTTP endpoint: `curl localhost:5001/health`
3. ✅ Crea un documento o location action e verifica che l'embedding venga generato
4. ✅ Monitora logs per errori: `pm2 logs`

---

## 📝 Notes

- **Python Virtual Environment**: Il Flask service usa `venv/bin/python3` per isolare dependencies
- **Memory Limits**: 500MB per service, 300MB per worker (configurabile in ecosystem.config.js)
- **Auto-restart**: PM2 restart automatico in caso di crash
- **Logs**: Tutti i logs in `/home/ubuntu/tenpennynovels/logs/`
- **Model Size**: ~400MB (paraphrase-multilingual-MiniLM-L12-v2)

---

**Setup completato!** Gli embeddings services sono ora gestiti con PM2 come tutti gli altri servizi backend. 🚀
