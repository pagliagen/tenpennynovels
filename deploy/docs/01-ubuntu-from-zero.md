# Ubuntu Server Setup da Zero

**Navigation**: [Deploy Hub](./README.md) > Ubuntu Setup

**Status**: ✅ Production Ready | **Last Updated**: 2026-03-15

Guida completa per configurare un server Ubuntu 22.04+ da zero per ospitare TenPennyNovels in produzione.

---

## Prerequisiti

### Requisiti Hardware Minimi

- **OS**: Ubuntu 22.04 LTS o superiore
- **CPU**: 4 vCPU
- **RAM**: 8 GB
- **Storage**: 100 GB SSD
- **Network**: IP pubblico statico
- **Provider**: OVH, DigitalOcean, AWS EC2, Hetzner, Vultr

### Requisiti di Accesso

- Accesso root via SSH (temporaneo, per setup iniziale)
- Dominio configurato con DNS (tutti i 7 subdomini)

---

## Flusso Setup Completo

```mermaid
flowchart TD
    Start[VPS Ubuntu Fresco] --> User[Crea utente deploy]
    User --> SSH[Setup SSH keys]
    SSH --> FW[Configura firewall]
    FW --> Software[Installa software]
    Software --> DB[Setup MongoDB + Redis]
    DB --> Clone[Clone repo]
    Clone --> Env[Setup .env files]
    Env --> Build[Build all]
    Build --> Nginx[Setup Nginx]
    Nginx --> SSL[Certbot SSL]
    SSL --> PM2[PM2 start]
    PM2 --> Verify[Verifica deployment]
    Verify --> Backup[Setup backup]
    Backup --> Done[Sistema Operativo]
```

---

## Checklist Completa

Usa questa checklist per verificare ogni step:

```markdown
- [ ] Provision VPS Ubuntu 22.04+
- [ ] Login come root
- [ ] Aggiorna sistema (apt update + upgrade)
- [ ] Crea utente deploy (non root)
- [ ] Aggiungi utente a gruppo sudo
- [ ] Setup SSH key authentication
- [ ] Disable password SSH login
- [ ] Configura firewall (ufw)
- [ ] Installa Node.js 22.13.1 (nvm)
- [ ] Installa PM2 globale
- [ ] Installa Nginx
- [ ] Installa Certbot
- [ ] Installa MongoDB 7.0 + enable auth
- [ ] Installa Redis 7.2 + persistence
- [ ] Installa Qdrant 1.17
- [ ] Installa ElasticSearch 8.11 (opzionale)
- [ ] Installa Python 3.8+ + pip
- [ ] Installa Git
- [ ] Clone repository tenpennynovels
- [ ] Setup .env.production (tutti i servizi)
- [ ] Genera segreti (JWT, AI Gateway)
- [ ] Build frontend (4 app)
- [ ] Build backend (3 servizi)
- [ ] Setup Python venv (embeddings)
- [ ] Setup Nginx configs (7 subdomini)
- [ ] Genera SSL certificates
- [ ] PM2 start ecosystem.config.js
- [ ] PM2 save + startup
- [ ] Test health checks
- [ ] Setup backup automatico
- [ ] Setup monitoring (PM2 Plus / Datadog)
```

---

## STEP 1: Provisioning VPS

### Provider Raccomandati

| Provider | Piano | CPU | RAM | Storage | Prezzo/mese |
|----------|-------|-----|-----|---------|-------------|
| **OVH** | VPS Comfort | 4 vCPU | 8 GB | 160 GB SSD | ~€20 |
| **DigitalOcean** | Droplet 8GB | 4 vCPU | 8 GB | 160 GB SSD | $48 |
| **Hetzner** | CX41 | 4 vCPU | 16 GB | 160 GB SSD | €17 |
| **Vultr** | High Frequency 8GB | 4 vCPU | 8 GB | 180 GB SSD | $48 |

### Provision

1. Crea VPS con Ubuntu 22.04 LTS
2. Seleziona datacenter (Europa consigliato per GDPR)
3. Abilita backup automatici (opzionale ma consigliato)
4. Ottieni IP pubblico statico
5. Salva credenziali root iniziali

**Nota**: Riceverai email con IP, username `root`, password temporanea.

---

## STEP 2: Primo Accesso e Aggiornamento Sistema

```bash
# Login come root (usa password temporanea ricevuta via email)
ssh root@<IP_VPS>

# Aggiorna lista pacchetti
apt update

# Aggiorna tutti i pacchetti installati
apt upgrade -y

# Installa pacchetti essenziali
apt install -y curl wget git build-essential software-properties-common
```

---

## STEP 3: Creazione Utente Deploy (Non-Root)

**CRITICO**: Non eseguire mai l'applicazione come root.

```bash
# Crea utente deploy
adduser deploy

# Segui il prompt:
# - Scegli password sicura
# - Lascia campi opzionali vuoti (Enter)

# Aggiungi deploy al gruppo sudo
usermod -aG sudo deploy

# Verifica appartenenza ai gruppi
groups deploy
# Output: deploy : deploy sudo

# Testa sudo access (importante!)
su - deploy
sudo ls /root
# Dovresti vedere il contenuto di /root
exit
```

---

## STEP 4: Setup SSH Key Authentication

**CRITICO**: Disabilitare password SSH è fondamentale per sicurezza produzione.

### 4.1 Genera SSH Key sul tuo Computer Locale

```bash
# Sul tuo Mac/Linux locale (NON sul server!)
ssh-keygen -t ed25519 -C "deploy@tenpennynovels" -f ~/.ssh/tenpennynovels_deploy

# Quando chiede passphrase: scegli una sicura (opzionale ma consigliato)
# Genera due file:
#   ~/.ssh/tenpennynovels_deploy       (chiave privata - NEVER SHARE)
#   ~/.ssh/tenpennynovels_deploy.pub   (chiave pubblica)

# Visualizza chiave pubblica (da copiare)
cat ~/.ssh/tenpennynovels_deploy.pub
```

### 4.2 Installa Chiave Pubblica sul Server

```bash
# Sul server, come utente deploy
su - deploy

# Crea directory .ssh (se non esiste)
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Crea file authorized_keys
nano ~/.ssh/authorized_keys

# Incolla la chiave pubblica (output di cat ~/.ssh/tenpennynovels_deploy.pub)
# Salva: Ctrl+O, Enter, Ctrl+X

# Imposta permessi corretti (CRITICO!)
chmod 600 ~/.ssh/authorized_keys

# Verifica ownership
ls -la ~/.ssh
# Owner DEVE essere deploy:deploy
```

### 4.3 Testa SSH Key Login

```bash
# Sul tuo computer locale, apri NUOVO terminale
ssh -i ~/.ssh/tenpennynovels_deploy deploy@<IP_VPS>

# Se chiede passphrase: inserisci quella scelta in ssh-keygen
# Dovresti entrare senza password del server

# Se funziona: ✅ SSH key setup OK
# Se chiede password: ❌ Verifica permessi .ssh (700) e authorized_keys (600)
```

### 4.4 Configura SSH Client Locale (Opzionale ma Comodo)

```bash
# Sul tuo Mac/Linux locale
nano ~/.ssh/config

# Aggiungi:
Host tenpennynovels
    HostName <IP_VPS>
    User deploy
    IdentityFile ~/.ssh/tenpennynovels_deploy
    ServerAliveInterval 60

# Salva: Ctrl+O, Enter, Ctrl+X

# Ora puoi connetterti con:
ssh tenpennynovels
```

---

## STEP 5: Disable Password SSH Login

**CRITICO**: Questo step previene attacchi brute-force.

```bash
# Sul server, come deploy (con sudo)
sudo nano /etc/ssh/sshd_config

# Trova e modifica queste righe:
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes

# Salva: Ctrl+O, Enter, Ctrl+X

# Riavvia SSH service
sudo systemctl restart sshd

# IMPORTANTE: NON chiudere il terminale corrente!
# Apri NUOVO terminale e testa connessione:
ssh tenpennynovels

# Se funziona: ✅ OK, chiudi il vecchio terminale
# Se NON funziona: ❌ Risolvi dal vecchio terminale ancora aperto
```

---

## STEP 6: Configura Firewall (UFW)

```bash
# Abilita UFW (default deny)
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Permetti SSH (CRITICO - fai questo PRIMA di enable!)
sudo ufw allow 22/tcp

# Permetti HTTP e HTTPS (Nginx)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Abilita firewall
sudo ufw enable

# Verifica status
sudo ufw status verbose

# Output atteso:
# Status: active
# To                         Action      From
# --                         ------      ----
# 22/tcp                     ALLOW       Anywhere
# 80/tcp                     ALLOW       Anywhere
# 443/tcp                     ALLOW       Anywhere
```

---

## STEP 7: Installa Node.js via NVM

**IMPORTANTE**: Installare Node.js 22.13.1 (versione esatta da `.nvmrc`)

```bash
# Come utente deploy
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Carica nvm nel terminale corrente
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Verifica installazione nvm
nvm --version
# Output: 0.39.7

# Installa Node.js 22.13.1
nvm install 22.13.1

# Imposta come default
nvm alias default 22.13.1

# Verifica versione
node --version
# Output: v22.13.1

npm --version
# Output: 10.x.x

# Test: chiudi e riapri terminale, node dovrebbe essere ancora disponibile
exit
ssh tenpennynovels
node --version
# Output: v22.13.1
```

---

## STEP 8: Installa PM2 Globale

```bash
# Come deploy
npm install -g pm2

# Verifica installazione
pm2 --version

# Setup PM2 startup script (auto-avvio al boot)
pm2 startup
# Output: un comando "sudo env PATH=..." da eseguire

# Copia e incolla il comando suggerito, esempio:
sudo env PATH=$PATH:/home/deploy/.nvm/versions/node/v22.13.1/bin /home/deploy/.nvm/versions/node/v22.13.1/lib/node_modules/pm2/bin/pm2 startup systemd -u deploy --hp /home/deploy

# Verifica: PM2 deve partire automaticamente al reboot (testeremo dopo)
```

---

## STEP 9: Installa Nginx e Certbot

```bash
# Come deploy
sudo apt install -y nginx certbot python3-certbot-nginx

# Verifica Nginx
nginx -v
# Output: nginx version: nginx/1.18.0 (Ubuntu)

# Verifica Certbot
certbot --version
# Output: certbot 1.21.0

# Avvia Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Test: visita http://<IP_VPS> nel browser
# Dovresti vedere "Welcome to nginx!" default page
```

---

## STEP 10: Installa MongoDB 7.0

**IMPORTANTE**: MongoDB 7.0 richiede repository ufficiale MongoDB.

```bash
# Importa chiave GPG MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Aggiungi repository MongoDB 7.0
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Aggiorna pacchetti
sudo apt update

# Installa MongoDB 7.0
sudo apt install -y mongodb-org

# Avvia MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verifica status
sudo systemctl status mongod
# Deve mostrare: Active: active (running)

# Test connessione
mongosh --eval 'db.runCommand({ connectionStatus: 1 })'
# Output: ok: 1
```

### Configura MongoDB per Produzione

```bash
# Crea utente admin MongoDB
mongosh

# Nel shell MongoDB:
use admin
db.createUser({
  user: "admin",
  pwd: "YOUR_SECURE_PASSWORD_HERE",  // CAMBIA QUESTA PASSWORD!
  roles: [ { role: "userAdminAnyDatabase", db: "admin" }, "readWriteAnyDatabase" ]
})

# Crea utente per database tenpennynovels
use tenpennynovels
db.createUser({
  user: "tenpennynovels",
  pwd: "YOUR_APP_DB_PASSWORD_HERE",  // CAMBIA QUESTA PASSWORD!
  roles: [ { role: "readWrite", db: "tenpennynovels" } ]
})

# Esci dal shell
exit

# Abilita autenticazione MongoDB
sudo nano /etc/mongod.conf

# Trova la sezione security e decommentala/modificala:
security:
  authorization: enabled

# Trova net.bindIp e assicurati sia:
net:
  port: 27017
  bindIp: 127.0.0.1

# Salva: Ctrl+O, Enter, Ctrl+X

# Riavvia MongoDB
sudo systemctl restart mongod

# Test autenticazione
mongosh -u tenpennynovels -p YOUR_APP_DB_PASSWORD_HERE --authenticationDatabase tenpennynovels
# Se entra: ✅ MongoDB configurato correttamente
```

---

## STEP 11: Installa Redis 7.2

```bash
# Installa Redis
sudo apt install -y redis-server

# Verifica versione
redis-server --version
# Output: Redis server v=7.0.x o superiore

# Configura Redis per produzione
sudo nano /etc/redis/redis.conf

# Modifica queste righe:

# 1. Bind solo localhost (sicurezza)
bind 127.0.0.1 ::1

# 2. Abilita persistenza RDB
save 900 1        # Salva dopo 900 sec se almeno 1 chiave cambiata
save 300 10       # Salva dopo 300 sec se almeno 10 chiavi cambiate
save 60 10000     # Salva dopo 60 sec se almeno 10000 chiavi cambiate

# 3. Abilita persistenza AOF (append-only file)
appendonly yes
appendfsync everysec

# 4. Maxmemory policy (evita OOM)
maxmemory 2gb
maxmemory-policy allkeys-lru

# Salva: Ctrl+O, Enter, Ctrl+X

# Riavvia Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Test connessione
redis-cli ping
# Output: PONG
```

---

## STEP 12: Installa Qdrant 1.17

**Opzione A: Docker (Raccomandato)**

```bash
# Installa Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Aggiungi deploy al gruppo docker
sudo usermod -aG docker deploy

# Ricarica gruppi (o logout/login)
newgrp docker

# Verifica Docker
docker --version

# Avvia Qdrant container
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  --restart unless-stopped \
  qdrant/qdrant:v1.17.0

# Test healthcheck
curl http://127.0.0.1:6333/healthz
# Output: OK

# Configura Docker auto-start
sudo systemctl enable docker
```

**Opzione B: Binary (Alternativa)**

```bash
# Download Qdrant binary
wget https://github.com/qdrant/qdrant/releases/download/v1.17.0/qdrant-x86_64-unknown-linux-musl.tar.gz

# Estrai
tar -xzf qdrant-x86_64-unknown-linux-musl.tar.gz

# Sposta in /usr/local/bin
sudo mv qdrant /usr/local/bin/

# Crea directory storage
mkdir -p ~/qdrant_storage

# Avvia Qdrant (test)
qdrant --storage-path ~/qdrant_storage

# Setup systemd service (TODO: aggiungere unit file)
```

---

## STEP 13: Installa ElasticSearch 8.11 (Opzionale)

**NOTA**: ElasticSearch è opzionale. Il sistema funziona solo con Qdrant per semantic search.

```bash
# Import Elasticsearch GPG key
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo gpg --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg

# Add Elasticsearch repository
echo "deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list

# Install Elasticsearch
sudo apt update
sudo apt install -y elasticsearch

# Configure Elasticsearch (bind localhost only)
sudo nano /etc/elasticsearch/elasticsearch.yml

# Modifica:
network.host: 127.0.0.1
http.port: 9200
xpack.security.enabled: false  # Disabilita auth per development

# Salva: Ctrl+O, Enter, Ctrl+X

# Start Elasticsearch
sudo systemctl start elasticsearch
sudo systemctl enable elasticsearch

# Test (può richiedere 30-60 secondi per avviarsi)
sleep 30
curl http://127.0.0.1:9200/
# Output: JSON con cluster info
```

---

## STEP 14: Installa Python 3.8+ e Pip

```bash
# Ubuntu 22.04 ha Python 3.10 di default
python3 --version
# Output: Python 3.10.x

# Installa pip e venv
sudo apt install -y python3-pip python3-venv

# Verifica pip
pip3 --version
```

---

## STEP 15: Clone Repository TenPennyNovels

```bash
# Come deploy, nella home directory
cd ~
git clone https://github.com/YOUR_USERNAME/tenpennynovels.git
cd tenpennynovels

# Verifica branch
git branch
# Dovresti essere su master

# Verifica .nvmrc
cat .nvmrc
# Output: 22.13.1

# Setup Node version dal .nvmrc
nvm use
# Output: Now using node v22.13.1
```

---

## STEP 16: Installa Dipendenze

**IMPORTANTE**: Usa lo script ufficiale per installare tutte le dipendenze.

```bash
# Dalla root del progetto
cd ~/tenpennynovels

# Esegui script di installazione
./deploy/scripts/install-all.sh

# Questo script installa:
# - Root dependencies
# - Apps dependencies (landing, game, documents, management)
# - Services dependencies (api-gateway, unified-backend, embeddings-worker)

# Verifica (dovrebbe completare senza errori)
# Tempo stimato: 5-10 minuti
```

---

## STEP 17: Setup Environment Variables

**CRITICO**: I file `.env.production` NON sono nel repository (esclusi da `.gitignore`).

### 17.1 Copia Templates

```bash
cd ~/tenpennynovels

# Esegui script di copia templates
./deploy/primo-rilascio-manuale/copy-env-files.sh

# Questo crea .env.production in tutte le app/services da templates
```

### 17.2 Genera Segreti

```bash
# JWT secrets (128 char hex)
openssl rand -hex 64
# Output: <copia questo valore per JWT_SECRET>

openssl rand -hex 64
# Output: <copia questo valore per JWT_REFRESH_SECRET>

# AI Gateway secrets (64 char hex)
openssl rand -hex 32
# Output: <copia questo valore per AI_GATEWAY_API_KEY>

openssl rand -hex 32
# Output: <copia questo valore per AI_GATEWAY_HMAC_SECRET>
```

### 17.3 Configura Unified Backend

```bash
nano ~/tenpennynovels/services/unified-backend/.env.production

# Modifica i seguenti valori:

NODE_ENV=production
PORT=3001

# MongoDB (usa password scelta in STEP 10)
MONGODB_URI=mongodb://tenpennynovels:YOUR_APP_DB_PASSWORD_HERE@127.0.0.1:27017/tenpennynovels

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_URL=redis://127.0.0.1:6379

# Qdrant
QDRANT_URL=http://127.0.0.1:6333

# Embeddings Service
EMBEDDINGS_SERVICE_URL=http://127.0.0.1:5001

# Frontend URLs (IMPORTANTE: domini reali)
FRONTEND_URL=https://game.tenpennynovels.com
LANDING_URL=https://tenpennynovels.com
GAME_URL=https://game.tenpennynovels.com
DOCUMENTS_URL=https://documenti.tenpennynovels.com
MANAGEMENT_URL=https://gestione.tenpennynovels.com

# CORS
ALLOWED_ORIGINS=https://tenpennynovels.com,https://game.tenpennynovels.com,https://documenti.tenpennynovels.com,https://gestione.tenpennynovels.com

# JWT (usa i segreti generati sopra!)
JWT_SECRET=<inserisci_jwt_secret_64_char>
JWT_REFRESH_SECRET=<inserisci_jwt_refresh_secret_64_char>

# AI Gateway (se usi local-ai)
AI_GATEWAY_URL=https://YOUR_NGROK_URL.ngrok.io  # Cambia con URL ngrok reale
AI_GATEWAY_CLIENT_ID=tpn-prod
AI_GATEWAY_API_KEY=<inserisci_ai_gateway_api_key_32_char>
AI_GATEWAY_HMAC_SECRET=<inserisci_ai_gateway_hmac_secret_32_char>

# Email SMTP (configura con provider reale)
SMTP_HOST=mail.tenpennynovels.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@tenpennynovels.com
SMTP_PASS=YOUR_SMTP_PASSWORD_HERE

# CDN
CDN_STORAGE_PATH=/var/www/cdn-cache
CDN_BASE_URL=https://cdn.tenpennynovels.com

# Salva: Ctrl+O, Enter, Ctrl+X
```

### 17.4 Configura API Gateway

```bash
nano ~/tenpennynovels/services/api-gateway/.env.production

NODE_ENV=production
PORT=8000
UNIFIED_BACKEND_URL=http://127.0.0.1:3001
TRUST_PROXY=true
CDN_STORAGE_PATH=/var/www/cdn-cache

# Frontend URLs per CORS
LANDING_URL=https://tenpennynovels.com
GAME_URL=https://game.tenpennynovels.com
DOCUMENTS_URL=https://documenti.tenpennynovels.com
MANAGEMENT_URL=https://gestione.tenpennynovels.com

# Salva: Ctrl+O, Enter, Ctrl+X
```

### 17.5 Configura Frontend Apps

**IMPORTANTE**: Le variabili `NEXT_PUBLIC_*` sono compilate durante il build.

```bash
# Landing
nano ~/tenpennynovels/apps/landing/.env.production

NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.tenpennynovels.com
NEXT_PUBLIC_LANDING_URL=https://tenpennynovels.com
NEXT_PUBLIC_GAME_URL=https://game.tenpennynovels.com
NEXT_PUBLIC_DOCUMENTS_URL=https://documenti.tenpennynovels.com
NEXT_PUBLIC_MANAGEMENT_URL=https://gestione.tenpennynovels.com

# Salva: Ctrl+O, Enter, Ctrl+X

# Ripeti per game, documents, management (stessi valori)
# Game e Management aggiungono anche:
NEXT_PUBLIC_WS_URL=https://ws.tenpennynovels.com
```

### 17.6 Configura Embeddings Worker

```bash
nano ~/tenpennynovels/services/embeddings-worker/.env.production

NODE_ENV=production
HTTP_PORT=5001
PYTHON_PATH=python3

MONGODB_URI=mongodb://tenpennynovels:YOUR_APP_DB_PASSWORD_HERE@127.0.0.1:27017/tenpennynovels
REDIS_URL=redis://127.0.0.1:6379
QDRANT_URL=http://127.0.0.1:6333

# ElasticSearch (se installato)
ELASTICSEARCH_URL=http://127.0.0.1:9200
ELASTICSEARCH_INDEX_PREFIX=tenpennynovels

# Salva: Ctrl+O, Enter, Ctrl+X
```

### 17.7 Crea Directory CDN

```bash
sudo mkdir -p /var/www/cdn-cache
sudo chown deploy:deploy /var/www/cdn-cache
sudo chmod 755 /var/www/cdn-cache
```

---

## STEP 18: Build Frontend Apps

**IMPORTANTE**: Build può richiedere 10-15 minuti.

```bash
cd ~/tenpennynovels

# Build tutte le app frontend
npm run build:frontend:all

# Questo esegue:
# - cd apps/landing && npm run build
# - cd apps/game && npm run build
# - cd apps/documents && npm run build
# - cd apps/management && npm run build

# Verifica build completato
ls -lh apps/landing/.next
ls -lh apps/game/.next
ls -lh apps/documents/.next
ls -lh apps/management/.next

# Dovresti vedere directory .next con dimensione >10MB per ciascuna
```

---

## STEP 19: Build Backend Services

```bash
cd ~/tenpennynovels

# Build tutti i backend services
npm run build:backend:all

# Questo esegue:
# - cd services/api-gateway && npm run build
# - cd services/unified-backend && npm run build
# - cd services/embeddings-worker && npm run build

# Verifica build completato
ls -lh services/api-gateway/dist
ls -lh services/unified-backend/dist
ls -lh services/embeddings-worker/dist

# Dovresti vedere directory dist/ con file .js
```

---

## STEP 20: Setup Python Virtual Environment (Embeddings)

```bash
cd ~/tenpennynovels/services/embeddings-worker/python

# Crea virtual environment
python3 -m venv venv

# Attiva venv
source venv/bin/activate

# Aggiorna pip
pip install --upgrade pip

# Installa dipendenze
pip install -r requirements.txt

# Tempo stimato: 5-10 minuti (download modelli HuggingFace)

# Pre-download modelli (opzionale ma raccomandato)
python3 setup-models.py

# Disattiva venv
deactivate

# Verifica
ls -lh venv/lib/python3.10/site-packages
# Dovresti vedere torch, sentence-transformers, flask, ecc.
```

---

## STEP 21: Setup Nginx Configurations

### 21.1 Copia Configurazioni

```bash
# Copia le config Nginx dal repository
sudo cp ~/tenpennynovels/deploy/primo-rilascio-manuale/nginx-configs/*.conf /etc/nginx/sites-available/

# Crea symlink in sites-enabled
sudo ln -sf /etc/nginx/sites-available/tenpennynovels.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/game.tenpennynovels.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/documenti.tenpennynovels.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/gestione.tenpennynovels.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/api.tenpennynovels.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/ws.tenpennynovels.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/cdn.tenpennynovels.conf /etc/nginx/sites-enabled/

# Rimuovi default site
sudo rm /etc/nginx/sites-enabled/default

# Test configurazione Nginx
sudo nginx -t
# Output: syntax is ok, test is successful

# Ricarica Nginx
sudo systemctl reload nginx
```

**NOTA**: Le configurazioni Nginx puntano a HTTP (port 4000-4003, 8000, 3001) ma usano SSL. Certbot modificherà automaticamente le config per aggiungere SSL (prossimo step).

---

## STEP 22: Genera SSL Certificates (Certbot)

**IMPORTANTE**: Prima di eseguire questo step, configura DNS per tutti i 7 subdomini che puntino all'IP del VPS.

```bash
# Verifica che i domini puntino al VPS
nslookup tenpennynovels.com
nslookup game.tenpennynovels.com
nslookup documenti.tenpennynovels.com
nslookup gestione.tenpennynovels.com
nslookup api.tenpennynovels.com
nslookup ws.tenpennynovels.com
nslookup cdn.tenpennynovels.com

# Tutti DEVONO restituire IP del VPS

# Genera certificati SSL per tutti i domini
sudo certbot --nginx \
  -d tenpennynovels.com \
  -d game.tenpennynovels.com \
  -d documenti.tenpennynovels.com \
  -d gestione.tenpennynovels.com \
  -d api.tenpennynovels.com \
  -d ws.tenpennynovels.com \
  -d cdn.tenpennynovels.com

# Segui il prompt:
# - Email: inserisci email valida
# - Terms of Service: A (agree)
# - Share email with EFF: Y o N (opzionale)
# - Redirect HTTP to HTTPS: 2 (redirect - consigliato)

# Certbot modificherà automaticamente le config Nginx per aggiungere SSL
# Tempo stimato: 2-3 minuti

# Verifica auto-renewal
sudo certbot renew --dry-run
# Output: Congratulations, all renewals succeeded

# Setup auto-renewal systemd timer (dovrebbe essere già attivo)
sudo systemctl status certbot.timer
# Deve mostrare: Active: active (waiting)
```

---

## STEP 23: Avvia PM2 Processes

```bash
cd ~/tenpennynovels

# Avvia tutti i processi PM2 usando ecosystem.config.js
pm2 startOrRestart ecosystem.config.js --env production

# Tempo stimato: 30-60 secondi

# Verifica status
pm2 status

# Output atteso: 7 processi online
# ┌─────┬───────────────────────────────────┬─────────────┬─────────┬─────────┬──────────┐
# │ id  │ name                              │ mode        │ ↺      │ status  │ cpu      │
# ├─────┼───────────────────────────────────┼─────────────┼─────────┼─────────┼──────────┤
# │ 0   │ tenpennynovels-landing            │ fork        │ 0      │ online  │ 0%       │
# │ 1   │ tenpennynovels-game               │ fork        │ 0      │ online  │ 0%       │
# │ 2   │ tenpennynovels-documenti          │ fork        │ 0      │ online  │ 0%       │
# │ 3   │ tenpennynovels-gestione           │ fork        │ 0      │ online  │ 0%       │
# │ 4   │ tenpennynovels-api-gateway        │ cluster     │ 0      │ online  │ 0%       │
# │ 5   │ tenpennynovels-unified-backend    │ fork        │ 0      │ online  │ 0%       │
# │ 6   │ tenpennynovels-embeddings-worker  │ fork        │ 0      │ online  │ 0%       │
# └─────┴───────────────────────────────────┴─────────────┴─────────┴─────────┴──────────┘

# Se qualche processo è "errored", controlla i log:
pm2 logs tenpennynovels-<nome> --lines 50

# Salva processo list PM2 (per auto-restart al reboot)
pm2 save
```

---

## STEP 24: Verifica Deployment

### 24.1 Health Checks

```bash
# Test API Gateway
curl https://api.tenpennynovels.com/health
# Output: {"status":"ok"}

# Test Unified Backend (WebSocket)
curl https://ws.tenpennynovels.com/health
# Output: {"status":"ok"}

# Test Landing App
curl -I https://tenpennynovels.com
# Output: HTTP/2 200

# Test Game App
curl -I https://game.tenpennynovels.com
# Output: HTTP/2 200

# Test Documents App
curl -I https://documenti.tenpennynovels.com
# Output: HTTP/2 200

# Test Management App
curl -I https://gestione.tenpennynovels.com
# Output: HTTP/2 200
```

### 24.2 Browser Testing

Visita nel browser:

1. **https://tenpennynovels.com** → Landing page
2. **https://game.tenpennynovels.com** → Game app
3. **https://documenti.tenpennynovels.com** → Documents app
4. **https://gestione.tenpennynovels.com** → Management panel
5. **https://api.tenpennynovels.com/health** → Health check JSON

### 24.3 WebSocket Testing

```bash
# Apri browser console su game.tenpennynovels.com
# Controlla Network tab → WS
# Dovresti vedere connessione WebSocket a wss://ws.tenpennynovels.com/socket.io/

# Se WebSocket NON si connette:
# 1. Controlla CSP in apps/game/next.config.js
# 2. Controlla Nginx config per ws.tenpennynovels.com (proxy_read_timeout)
# 3. Controlla PM2 logs: pm2 logs tenpennynovels-unified-backend
```

---

## STEP 25: Setup Backup Automatico

```bash
# Crea directory backup
mkdir -p ~/backups

# Crea script backup MongoDB
nano ~/backup-mongodb.sh

# Contenuto:
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/backups
mongodump \
  --uri="mongodb://tenpennynovels:YOUR_APP_DB_PASSWORD_HERE@127.0.0.1:27017/tenpennynovels" \
  --out="$BACKUP_DIR/mongodb_$DATE" \
  --gzip
find "$BACKUP_DIR" -type d -name "mongodb_*" -mtime +7 -exec rm -rf {} \;

# Salva: Ctrl+O, Enter, Ctrl+X

# Rendi eseguibile
chmod +x ~/backup-mongodb.sh

# Test manuale
~/backup-mongodb.sh

# Verifica backup
ls -lh ~/backups/

# Setup cron per backup automatico (ogni giorno alle 3:00 AM)
crontab -e

# Aggiungi:
0 3 * * * /home/deploy/backup-mongodb.sh >> /home/deploy/backups/backup.log 2>&1

# Salva e esci
```

---

## STEP 26: Setup Monitoring (Opzionale)

### Opzione A: PM2 Plus (Monitoring Ufficiale)

```bash
# Registrati su https://app.pm2.io
# Ottieni chiave di licenza

pm2 link <secret_key> <public_key>

# Ora puoi monitorare il server su https://app.pm2.io
```

### Opzione B: Monitoring Manuale

```bash
# Crea script monitoring
nano ~/monitor.sh

# Contenuto:
#!/bin/bash
echo "=== PM2 Status ==="
pm2 status

echo ""
echo "=== Disk Usage ==="
df -h

echo ""
echo "=== Memory Usage ==="
free -h

echo ""
echo "=== MongoDB Status ==="
systemctl status mongod | grep Active

echo ""
echo "=== Redis Status ==="
systemctl status redis-server | grep Active

echo ""
echo "=== Nginx Status ==="
systemctl status nginx | grep Active

# Salva: Ctrl+O, Enter, Ctrl+X

chmod +x ~/monitor.sh

# Esegui quando necessario
~/monitor.sh
```

---

## Troubleshooting

### PM2 Process "Errored"

```bash
# Visualizza log del processo
pm2 logs tenpennynovels-<nome> --lines 100

# Cause comuni:
# 1. .env.production mancante → Verifica file esiste
# 2. Porta occupata → sudo netstat -tulpn | grep <porta>
# 3. Dipendenza mancante → cd service && npm install
# 4. MongoDB connection failed → Verifica MONGODB_URI e password
```

### Nginx 502 Bad Gateway

```bash
# 1. Verifica PM2 process sia online
pm2 status

# 2. Verifica porta in ascolto
sudo netstat -tulpn | grep 3001  # unified-backend
sudo netstat -tulpn | grep 8000  # api-gateway

# 3. Controlla log Nginx
sudo tail -f /var/log/nginx/error.log
```

### SSL Certificate Failed

```bash
# Verifica DNS punta al VPS
nslookup tenpennynovels.com

# Verifica Nginx risponde su port 80
curl -I http://tenpennynovels.com

# Retry Certbot
sudo certbot --nginx -d tenpennynovels.com
```

### WebSocket Non Si Connette

```bash
# 1. Verifica Nginx config ws.tenpennynovels.com ha proxy_read_timeout 7200s
sudo cat /etc/nginx/sites-enabled/ws.tenpennynovels.conf | grep proxy_read_timeout

# 2. Verifica CSP in apps/game/next.config.js include wss://ws.tenpennynovels.com

# 3. Rebuild game app dopo modifica CSP
cd ~/tenpennynovels/apps/game
npm run build
pm2 restart tenpennynovels-game

# 4. Controlla log unified-backend
pm2 logs tenpennynovels-unified-backend --lines 50
```

---

## Performance Tuning

### MongoDB

```bash
# Monitora slow queries
mongosh -u tenpennynovels -p YOUR_APP_DB_PASSWORD_HERE --authenticationDatabase tenpennynovels

use tenpennynovels
db.setProfilingLevel(1, { slowms: 100 })  # Log queries >100ms
db.system.profile.find().sort({ts: -1}).limit(5).pretty()
```

### Redis

```bash
# Monitora comandi
redis-cli monitor

# Info memoria
redis-cli info memory
```

### PM2

```bash
# Monitoring real-time
pm2 monit

# Resource usage
pm2 describe tenpennynovels-unified-backend
```

---

## Security Checklist

- [x] SSH password authentication disabilitata
- [x] Root login disabilitato via SSH
- [x] Firewall configurato (solo porte 22, 80, 443)
- [x] MongoDB authentication abilitata
- [x] MongoDB bind su 127.0.0.1 (non esposta)
- [x] Redis bind su 127.0.0.1
- [x] JWT secrets generati con openssl (non default)
- [x] SMTP password configurata (non placeholder)
- [x] SSL certificati validi per tutti i domini
- [x] Auto-renewal SSL configurato (certbot.timer)
- [x] CORS ALLOWED_ORIGINS contiene solo domini reali
- [x] .env.production files con permessi 600 (chmod 600 *.env*)

---

## Comandi Utili

```bash
# PM2
pm2 status                              # Stato processi
pm2 logs [nome]                         # Visualizza log
pm2 restart [nome]                      # Riavvia servizio
pm2 restart all                         # Riavvia tutto
pm2 monit                               # Monitoring real-time

# Nginx
sudo nginx -t                           # Test configurazione
sudo systemctl reload nginx             # Applica modifiche
sudo tail -f /var/log/nginx/error.log   # Log errori

# Database
mongosh -u tenpennynovels -p PASSWORD --authenticationDatabase tenpennynovels
redis-cli PING
curl http://127.0.0.1:6333/healthz      # Qdrant
curl http://127.0.0.1:9200/_cluster/health  # ElasticSearch

# SSL
sudo certbot certificates               # Stato certificati
sudo certbot renew --dry-run            # Test rinnovo

# System
df -h                                   # Disk usage
free -h                                 # Memory usage
sudo systemctl status mongod            # MongoDB status
sudo systemctl status redis-server      # Redis status
```

---

## Next Steps

Dopo aver completato questo setup:

1. **Configura GitHub Actions Secrets** → Vedi [github-setup.md](./github-setup.md)
2. **Setup CI/CD deployment** → Push to master per automatic deploy
3. **Seed database** → Esegui seeders per dati iniziali
4. **Crea primo utente admin** → Via management panel
5. **Setup monitoring avanzato** → PM2 Plus o Datadog

---

## Related Documentation

- [GitHub Setup](./github-setup.md) - Configurazione GitHub Actions secrets
- [PM2 Configuration](./pm2-guide.md) - Dettagli ecosystem.config.js
- [Nginx Configuration](./nginx-guide.md) - 7 subdomini completi
- [SSL Certificates](./ssl-guide.md) - Certbot troubleshooting
- [VPS Troubleshooting](./vps-deployment-guide.md) - Fix specifici produzione
- [Deployment Guide](../docs/06-operations/deployment-guide.md) - Overview generale
