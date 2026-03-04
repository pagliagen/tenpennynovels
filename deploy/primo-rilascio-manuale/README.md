# Primo Rilascio Manuale - Setup Iniziale

Questa cartella contiene tutti i file e script necessari per il **setup iniziale** del server OVH VPS prima di attivare il deploy automatico GitHub Actions.

## 📋 Quando Usare Questi File

**Solo alla prima installazione** o quando si configura un nuovo server da zero.

---

## 🔑 Step 1: SSH Keys Setup

**File**: [DEPLOYMENT_SETUP.md](./DEPLOYMENT_SETUP.md)

Guida completa per:
- Generare chiavi SSH deploy
- Configurare authorized_keys su OVH
- Configurare GitHub Secrets (environment production)
- Test connessione e troubleshooting

**Eseguire prima di tutto!**

---

## 🌐 Step 2: Nginx Setup

**File**: `setup-nginx.sh`

Configura Nginx come reverse proxy per:
- Landing app (tenpennynovels.com)
- Game app (game.tenpennynovels.com)
- Documents app (documenti.tenpennynovels.com)
- Management app (gestione.tenpennynovels.com)
- API Gateway (api.tenpennynovels.com)
- WebSocket Server (ws.tenpennynovels.com)

**Nginx configs**: [nginx-configs/](./nginx-configs/)

```bash
# Sul server OVH
cd ~/tenpennynovels/deploy/primo-rilascio-manuale
./setup-nginx.sh
```

---

## 🔄 Step 3: PM2 Setup

**File**: `setup-pm2.sh`

Configura PM2 per gestire i processi Node.js:
- Frontend apps (4)
- Backend services (4)
- Auto-restart on crash
- Startup on boot

```bash
# Sul server OVH
cd ~/tenpennynovels/deploy/primo-rilascio-manuale
./setup-pm2.sh
```

---

## 🔐 Step 4: Environment Variables

**File**: `setup-env.sh`

Copia template env files e aiuta a configurare:
- JWT secrets
- MongoDB URI
- Redis config
- Frontend URLs
- CORS origins
- API keys

**Templates**: [env-templates/](./env-templates/)

```bash
# Sul server OVH
cd ~/tenpennynovels/deploy/primo-rilascio-manuale
./setup-env.sh
```

**IMPORTANTE**: Edita manualmente i file `.env.production` con i valori corretti!

---

## ✅ Checklist Setup Completo

Dopo aver completato tutti gli step sopra:

- [ ] SSH keys configurate (GitHub Secrets + authorized_keys)
- [ ] Nginx configurato e running
- [ ] PM2 configurato e services online
- [ ] Environment variables corretti
- [ ] MongoDB/Redis/Qdrant running
- [ ] SSL certificates installati (Certbot)
- [ ] GitHub Actions workflow testato con "Run workflow"

---

## 🚀 Dopo il Setup

Una volta completato il setup iniziale:
1. Il deploy sarà **completamente automatico**
2. Ogni push a `master` deploya in produzione
3. Gli script in [../scripts/](../scripts/) vengono usati automaticamente dal workflow

**Non serve più toccare questi file** a meno che:
- Setup nuovo server
- Major configuration changes
- Disaster recovery

---

## 📚 File di Riferimento

- **DEPLOYMENT_SETUP.md**: Guida SSH keys e GitHub Actions
- **setup-nginx.sh**: Script installazione Nginx
- **setup-pm2.sh**: Script configurazione PM2
- **setup-env.sh**: Script setup environment variables
- **env-templates/**: Template file .env per tutti i servizi
- **nginx-configs/**: Configurazioni Nginx per tutti i subdomain

---

**Setup fatto? Passa a [../scripts/](../scripts/) per gli script di deploy automatico!**
