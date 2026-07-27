# Runbook Server 2 — MysteryInvestigation / TheKeeperArchive / siti minori

> Esecutivo, non di analisi: le decisioni sono in [MIGRAZIONE-SERVER.md](./MIGRAZIONE-SERVER.md). Niente pannello di gestione (cPanel scartato: costo sproporzionato al server, overhead che si mangia il margine RAM calcolato, paradigma Apache/PHP che confligge con nginx+PM2 già in uso — vedi discussione in conversazione). Al suo posto: setup diretto + uno script minimo per agganciare velocemente un sito nuovo in futuro. **Stessi tool su Server 1 e Server 2, senza eccezioni**: nginx per tutto ciò che è web-facing, PM2 per ogni processo Node — mai systemd per un'app applicativa, mai due modi diversi di fare la stessa cosa tra i due server.

## Il server

**OVH VPS-1** — 2 vCPU · 4GB RAM · 40GB NVMe · €4.65/mese.

Ospita, dopo la migrazione: MongoDB dedicato (solo db `misteryinvestigation`), backend Node di MysteryInvestigation + `keeper-discord-bot` + `keeper-server` di TheKeeperArchive — **tutti e tre su PM2**, stesso process manager di Server 1, un solo tool da conoscere su entrambe le macchine (vedi Fase 5) — 2-3 siti statici (gennaropaglia, thekeeperarchive marketing, bot.thekeeperarchive), Uptime Kuma (monitora Server 1 dall'esterno + status page pubblica). Footprint reale oggi: <400MB — il margine su 4GB è ampio anche con build occasionali e crescita del DB.

**Nota sui domini**: si abbandonano i vecchi `misteryinvestigation.it` / `thekeeperarchive.it` / il vecchio `gennaropaglia.me`, sostituiti da nuovi domini `.com` registrati direttamente su Cloudflare (deciso in MIGRAZIONE-SERVER.md). In questo runbook uso placeholder `<mystery-domain>`, `<keeper-domain>`, `<gennaro-domain>` — sostituisci con i nomi `.com` effettivamente registrati. `susannaantonelli.me` **non** si migra (deciso: si abbandona).

---

## Fase 1 — Provisioning, utente, SSH, firewall

Identico a Server 1 (vedi RUNBOOK_SERVER1.md, fasi 1-3) — stesso hardening, stesso motivo (il server condiviso attuale ha `PasswordAuthentication yes` effettivo nonostante l'intento contrario, e `fail2ban` installato ma spento). Riassunto:

```bash
ssh root@<IP_VPS1>
apt update && apt upgrade -y
apt install -y curl wget git build-essential software-properties-common

adduser ubuntu
usermod -aG sudo ubuntu
sudo hostnamectl set-hostname tenpennynovels-vps1
# chiave SSH da locale, disabilitare password auth, verificare con `sshd -T`

mkdir -p ~/.secrets && chmod 700 ~/.secrets   # stessa convenzione di Server 1: mai una password letterale in un comando

sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
sudo tee /etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled = true
EOF
sudo systemctl restart fail2ban

sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw limit 22/tcp   # limit, non allow: throttla i tentativi ripetuti, complementare a fail2ban
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw logging on
sudo ufw enable

sudo aa-status | head -5   # AppArmor deve risultare caricato e con profili in enforce
```

## Fase 2 — Node.js unico

Stessa decisione di Server 1: **v24.18.0** ovunque, anche qui — soddisfa il vincolo `>=22.13.0` di `keeper-bot`/`keeper-server` (che oggi girano su v18.20.8 in produzione, violando il proprio `engines`), un'unica versione da mantenere sui due server invece di due.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 24.18.0
nvm alias default 24.18.0

npm install -g pm2
```

## Fase 3 — MongoDB dedicato, auth da subito

Server 2 ha un **Mongo proprio**, separato da quello di Server 1 (non condiviso come sul box attuale). Solo il db `misteryinvestigation` ci va — niente `tenpennynovels`.

```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
```

Password generate in file prima di toccare `mongosh`, mai scritte a mano nel prompt (stessa convenzione di Server 1):

```bash
openssl rand -hex 32 > ~/.secrets/mongo_admin_pw && chmod 600 ~/.secrets/mongo_admin_pw
openssl rand -hex 32 > ~/.secrets/mongo_app_pw && chmod 600 ~/.secrets/mongo_app_pw
```

```bash
mongosh --eval "
db.getSiblingDB('admin').createUser({
  user: 'admin',
  pwd: '$(cat ~/.secrets/mongo_admin_pw)',
  roles: [ { role: 'userAdminAnyDatabase', db: 'admin' }, 'readWriteAnyDatabase' ]
});
db.getSiblingDB('misteryinvestigation').createUser({
  user: 'mystery_app',
  pwd: '$(cat ~/.secrets/mongo_app_pw)',
  roles: [ { role: 'readWrite', db: 'misteryinvestigation' } ]
});
"
rm -f ~/.dbshell   # mongosh salva la history dei comandi eseguiti — ripulisci dopo aver creato gli utenti
```

```bash
sudo nano /etc/mongod.conf
# security:
#   authorization: enabled
# net:
#   bindIp: 127.0.0.1
sudo systemctl restart mongod
```

`ulimit` a 64000 file descriptor — stesso fix già applicato su Server 1, dimenticato qui alla prima stesura:

```bash
sudo systemctl edit mongod
# [Service]
# LimitNOFILE=64000
sudo systemctl daemon-reload && sudo systemctl restart mongod
```

Sul server attuale il log Mongo non ha rotazione (già visto su Server 1, stesso fix qui):

```bash
sudo tee /etc/logrotate.d/mongodb <<'EOF'
/var/log/mongodb/mongod.log {
    daily
    rotate 14
    compress
    dateext
    missingok
    notifempty
    sharedscripts
    postrotate
        /usr/bin/pkill -SIGUSR1 mongod
    endscript
}
EOF
```

## Fase 4 — Nginx + Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx
sudo rm -f /etc/nginx/sites-enabled/default

# server_tokens off — stesso fix di Server 1, sul server condiviso è commentato
sudo sed -i 's/# server_tokens off;/server_tokens off;/' /etc/nginx/nginx.conf 2>/dev/null || \
  sudo sed -i '/http {/a \    server_tokens off;' /etc/nginx/nginx.conf
```

Header di sicurezza condivisi da tutti i vhost (stesso snippet di Server 1, incluso in ogni `server{}` creato nelle fasi successive e da `new-site.sh`):

```bash
sudo tee /etc/nginx/snippets/security-headers.conf <<'EOF'
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
# Strict-Transport-Security va aggiunto SOLO dopo SSL confermato stabile (fase 10)
EOF
```

fail2ban copre solo SSH da Fase 1 — ora che nginx esiste, aggiungi il jail per gli scanner più comuni:

```bash
sudo tee -a /etc/fail2ban/jail.local <<'EOF'

[nginx-botsearch]
enabled = true
EOF
sudo systemctl restart fail2ban
```

## Fase 5 — PM2: un solo process manager, per tutto

Sul server condiviso attuale MysteryInvestigation gira su un unit systemd dedicato — non lo replichiamo. **Stessa filosofia di Server 1**: un solo tool per log/restart/monitoring su entrambe le macchine, niente da context-switchare tra `pm2 logs` e `systemctl status` a seconda del progetto. Nessun vantaggio reale nel tenere systemd qui: l'unico argomento a favore (avvio ordinato dopo Mongo) lo risolve `autorestart: true`, esattamente come già fa `unified-backend` su Server 1.

```bash
pm2 --version   # già installato in Fase 2

pm2 startup     # UNA SOLA VOLTA: esegui il comando sudo che stampa, per l'utente ubuntu
```

Un `ecosystem.config.js` unico in home, con l'interprete Node pinnato esplicitamente (stesso motivo del pinning su Server 1: evita il drift di versione trovato sul server condiviso attuale, dove PM2 girava su v22.13.1 nonostante `.nvmrc`/l'intento dichiarasse v24):

```bash
nano ~/ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: 'mystery-backend',
      cwd: '/home/ubuntu/misteryinvestigation/backend',
      script: 'index.js',   // adatta all'entry point reale; se non carica già dotenv in cima, aggiungi require('dotenv').config() prima di ogni altro import (stesso pattern di bootstrap.js già in uso su Server 1)
      interpreter: '/home/ubuntu/.nvm/versions/node/v24.18.0/bin/node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3101,
      },
    },
    {
      name: 'keeper-discord-bot',   // nome coerente con la cartella sorgente poc/discord-bot, non più "keeper-bot"
      cwd: '/home/ubuntu/keeper/poc/discord-bot',
      script: 'index.js',   // adatta all'entry point reale
      interpreter: '/home/ubuntu/.nvm/versions/node/v24.18.0/bin/node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
    },
    {
      name: 'keeper-server',
      cwd: '/home/ubuntu/keeper/poc/server',
      script: 'index.js',   // adatta all'entry point reale
      interpreter: '/home/ubuntu/.nvm/versions/node/v24.18.0/bin/node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
    },
  ],
};
```

I secret (JWT, token Discord, password Mongo) **non** stanno in questo file — restano nei rispettivi `.env` con permessi `600` in ciascuna `cwd`, caricati a runtime da dotenv dentro l'app (vedi Fase 6 e 7). `ecosystem.config.js` porta solo `NODE_ENV`/`PORT`, niente di sensibile.

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
```

Le app vere e proprie si avviano in Fase 6/7 una volta che codice e `.env` sono a posto — qui è solo il tool pronto.

## Fase 6 — MysteryInvestigation (l'unica migrazione con dati reali)

Segue esattamente la sequenza già decisa in MIGRAZIONE-SERVER.md § 3 — qui tradotta in comandi. **Lavoro pulito**: si portano codice e dati reali, non gli artefatti operativi del vecchio setup (secret in chiaro nel file unit, Mongo senza auth, relitti `backupovh.sql`/`importFromMySql.js`).

### 6.1 Deploy codice e asset (prima del cutover, mentre il vecchio server è ancora vivo)

```bash
mkdir -p ~/misteryinvestigation
# adatta ai comandi reali del progetto (git clone o rsync dal vecchio server)
rsync -avz --progress ubuntu@<VECCHIO_IP_OVH>:~/misteryinvestigation/backend ~/misteryinvestigation/
rsync -avz --progress ubuntu@<VECCHIO_IP_OVH>:~/misteryinvestigation/frontend ~/misteryinvestigation/

# asset pesanti (character_images/, audios/, ~1GB) — farlo per primo, non nella finestra di downtime
rsync -avz --progress ubuntu@<VECCHIO_IP_OVH>:/var/www/misteryinvestigation.it/character_images/ ~/misteryinvestigation/frontend/build/character_images/
rsync -avz --progress ubuntu@<VECCHIO_IP_OVH>:/var/www/misteryinvestigation.it/audios/ ~/misteryinvestigation/frontend/build/audios/
```

**Non portare** `backupovh.sql` e `importFromMySql.js` — relitti di una migrazione MySQL→Mongo già conclusa (deciso).

```bash
cd ~/misteryinvestigation/backend
nvm use 24.18.0
npm install --production
```

### 6.2 Dump a caldo del DB (mentre il vecchio server serve ancora traffico)

```bash
# sul vecchio server
mongodump --db misteryinvestigation --gzip --out ~/mystery-dump-$(date +%Y%m%d)
rsync -avz ~/mystery-dump-*/misteryinvestigation ubuntu@<IP_VPS1>:~/mystery-dump/

# sul nuovo server (VPS-1)
mongorestore --uri="mongodb://mystery_app:$(cat ~/.secrets/mongo_app_pw)@127.0.0.1:27017/misteryinvestigation" \
  --gzip ~/mystery-dump/misteryinvestigation

# verifica conteggi documenti per collection contro l'originale
mongosh "mongodb://mystery_app:$(cat ~/.secrets/mongo_app_pw)@127.0.0.1:27017/misteryinvestigation" --eval "db.getCollectionNames().forEach(c => print(c + ': ' + db[c].countDocuments()))"
```

### 6.3 `.env` separato — non secret in chiaro, avvio via PM2

Sul server attuale `JWT_SECRET`/`DATABASE_PASSWORD`/`EMAIL_PASS` sono in chiaro dentro `/etc/systemd/system/misteryinvestigation.service`. Qui: `.env` con permessi `600`, caricato a runtime da dotenv nell'app — lo stesso principio, applicato a PM2 invece che a un unit systemd (vedi Fase 5 sul perché).

```bash
mkdir -p ~/misteryinvestigation/backend
nano ~/misteryinvestigation/backend/.env
# DATABASE_URL=mongodb://mystery_app:<password>@127.0.0.1:27017/misteryinvestigation
# JWT_SECRET=<rigenerato con openssl rand -hex 64 — non riusare quello vecchio>
# EMAIL_USER=info@<mystery-domain>
# EMAIL_PASS=<da verificare come viene inviata oggi, vedi nota SMTP sotto>
# PORT=3101
chmod 600 ~/misteryinvestigation/backend/.env
```

Verifica che l'entry point (`index.js` o quello reale) carichi il `.env` con `require('dotenv').config()` come prima riga eseguita, prima di ogni altro import — altrimenti le variabili non sono ancora in `process.env` quando il resto del codice le legge. Se manca, aggiungila (`npm install dotenv` se non è già una dipendenza).

```bash
cd ~
pm2 startOrRestart ecosystem.config.js --only mystery-backend --env production
pm2 save
```

(adatta `script` in `ecosystem.config.js`, Fase 5, all'entry point reale del backend se diverso da `index.js`)

### 6.4 Frontend statico + nginx

```bash
cd ~/misteryinvestigation/frontend
npm install
npm run build   # adatta allo script reale del progetto

sudo mkdir -p /var/www/<mystery-domain>
sudo cp -r build/* /var/www/<mystery-domain>/
sudo chown -R ubuntu:ubuntu /var/www/<mystery-domain>
```

nginx: due `server{}` come sul vecchio setup — sito statico e reverse proxy verso il backend. **Da rivedere in migrazione, non da copiare tale e quale**: `location /rm { autoindex on; }` sul vecchio server espone il filesystem — verifica se è voluto (debug dimenticato acceso?) prima di riportarlo.

```bash
sudo tee /etc/nginx/sites-available/<mystery-domain>.conf <<EOF
server {
    listen 80;
    server_name <mystery-domain> www.<mystery-domain>;
    root /var/www/<mystery-domain>;
    index index.html;
    include snippets/security-headers.conf;
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    # location /rm { autoindex on; }   # NON riabilitare senza aver verificato che serva davvero
}

server {
    listen 80;
    server_name server.<mystery-domain>;
    include snippets/security-headers.conf;
    location / {
        proxy_pass http://127.0.0.1:3101;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/<mystery-domain>.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6.5 Cron

```bash
crontab -e
# 0 6 * * * /home/ubuntu/.nvm/versions/node/v24.18.0/bin/node /home/ubuntu/misteryinvestigation/backend/rebootCharacterSheet.js
```

### 6.6 Finestra di downtime (cutover finale)

```bash
# sul vecchio server: ferma il servizio (lì è ancora systemd, non lo tocchiamo — muore con lo spegnimento del vecchio box)
sudo systemctl stop misteryinvestigation

# dump incrementale (solo il delta) o dump completo se il DB è piccolo (484MB → sotto i 2-3 min)
mongodump --db misteryinvestigation --gzip --out ~/mystery-dump-final

rsync -avz ~/mystery-dump-final/misteryinvestigation ubuntu@<IP_VPS1>:~/mystery-dump-final/
# sul nuovo server
mongorestore --uri="mongodb://mystery_app:$(cat ~/.secrets/mongo_app_pw)@127.0.0.1:27017/misteryinvestigation" \
  --gzip --drop ~/mystery-dump-final/misteryinvestigation

pm2 restart mystery-backend
curl http://127.0.0.1:3101/health   # o l'endpoint reale, se esiste
```

Poi switch DNS (fase 9) e SSL (fase 10). Tieni il vecchio server acceso qualche giorno come rete di sicurezza (fase 11).

**Email**: `info@misteryinvestigation.it` era usata come `EMAIL_USER`. Verifica come viene inviata oggi (quale relay SMTP) prima di assumere che funzioni sul nuovo IP — molti provider SMTP fanno whitelisting per IP, e comunque il dominio cambia (`.it` → `.com`), serve comunque una casella nuova o un forward.

## Fase 7 — TheKeeperArchive (keeper-discord-bot + keeper-server)

**Prima di migrare**: chiarire cosa serve `poc.thekeeperarchive.it` (non ispezionato nella ricognizione) — se è un esperimento morto non portarlo, se serve va capito prima di riprodurre il sottodominio.

`keeper-bot` (nome PM2 sul vecchio server) e la cartella sorgente `poc/discord-bot` sono lo stesso servizio Discord con nomi diversi — nell'`ecosystem.config.js` di Fase 5 il processo è già ridefinito come `keeper-discord-bot`, coerente con la cartella.

```bash
mkdir -p ~/keeper
rsync -avz --progress ubuntu@<VECCHIO_IP_OVH>:~/poc/ ~/keeper/poc/

cd ~/keeper/poc/discord-bot
nvm use 24.18.0
npm install --production
nano .env   # token Discord, chiavi LLM/API — RIGENERA quelli ragionevoli da rigenerare
chmod 600 .env

cd ~/keeper/poc/server
npm install --production
nano .env   # verifica cosa usa come vector store/RAG prima di assumere serva Qdrant dedicato — non trovato sul vecchio server
chmod 600 .env
```

Verifica anche qui, come per Mystery, che ogni entry point carichi il proprio `.env` con `require('dotenv').config()` prima di ogni altro import.

```bash
cd ~
pm2 startOrRestart ecosystem.config.js --only keeper-discord-bot,keeper-server --env production
pm2 save
```

Sito statico marketing su `<keeper-domain>` + eventuale `bot.<keeper-domain>`:

```bash
sudo mkdir -p /var/www/<keeper-domain>
sudo chown -R ubuntu:ubuntu /var/www/<keeper-domain>
# copia i file statici (rsync dal vecchio server)
```

```bash
sudo tee /etc/nginx/sites-available/<keeper-domain>.conf <<EOF
server {
    listen 80;
    server_name <keeper-domain> www.<keeper-domain>;
    root /var/www/<keeper-domain>;
    index index.html;
    include snippets/security-headers.conf;
}
EOF
sudo ln -sf /etc/nginx/sites-available/<keeper-domain>.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Il webhook che `keeper-server` riceve da `keeper-bot` (o viceversa) va aggiornato se referenzia hardcoded l'URL del vecchio dominio `.it` — controlla nel codice prima del cutover.

## Fase 8 — gennaropaglia (statico)

Solo file statici (`index.html`, `styles.css`, CV pdf), nessun processo:

```bash
sudo mkdir -p /var/www/<gennaro-domain>
sudo chown -R ubuntu:ubuntu /var/www/<gennaro-domain>
# copia i file (rsync dal vecchio server)
sudo tee /etc/nginx/sites-available/<gennaro-domain>.conf <<EOF
server {
    listen 80;
    server_name <gennaro-domain> www.<gennaro-domain>;
    root /var/www/<gennaro-domain>;
    index index.html;
    include snippets/security-headers.conf;
}
EOF
sudo ln -sf /etc/nginx/sites-available/<gennaro-domain>.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Fase 9 — DNS

Registra i nuovi domini `.com` su Cloudflare (stesso account già usato per `tenpennynovels.com`), punta i record A al nuovo IP VPS-1. `.it` vecchi restano dove sono e scadono naturalmente — **non rinnovarli**, ma prima verifica caselle email attive su di essi (checklist finale sotto).

## Fase 10 — SSL

```bash
sudo certbot --nginx -d <mystery-domain> -d www.<mystery-domain> -d server.<mystery-domain>
sudo certbot --nginx -d <keeper-domain> -d www.<keeper-domain> -d bot.<keeper-domain>
sudo certbot --nginx -d <gennaro-domain> -d www.<gennaro-domain>
sudo certbot renew --dry-run
```

Un solo meccanismo di rinnovo — il timer systemd, non aggiungerlo anche in crontab (stesso errore ridondante trovato sul server condiviso attuale).

Solo ora, con SSL confermato stabile su tutti i domini, aggiungi l'HSTS allo snippet header di Fase 4:

```bash
echo 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;' | \
  sudo tee -a /etc/nginx/snippets/security-headers.conf
sudo nginx -t && sudo systemctl reload nginx
```

## Fase 11 — Uptime Kuma (monitoraggio esterno di Server 1 + status page)

Deciso in MIGRAZIONE-SERVER.md: il monitor vive qui, mai sullo stesso server che deve sorvegliare.

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
newgrp docker

docker run -d \
  --name uptime-kuma \
  --restart unless-stopped \
  -p 127.0.0.1:3001:3001 \
  -v uptime-kuma-data:/app/data \
  louislam/uptime-kuma:1
```

```bash
sudo tee /etc/nginx/sites-available/status.tenpennynovels.com.conf <<'EOF'
server {
    listen 80;
    server_name status.tenpennynovels.com;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/status.tenpennynovels.com.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d status.tenpennynovels.com
```

Aggiungi `status.tenpennynovels.com` come record A su Cloudflare puntato a **questo** IP (VPS-1), non a Server 1.

Nell'interfaccia Uptime Kuma (`https://status.tenpennynovels.com`, setup al primo accesso), aggiungi i monitor:
- `https://api.tenpennynovels.com/health`
- `https://ws.tenpennynovels.com/health`
- `https://tenpennynovels.com`, `game.`, `documenti.`, `gestione.`
- `https://<mystery-domain>`, `https://<keeper-domain>` una volta live

Limite onesto (già segnalato in MIGRAZIONE-SERVER.md): se cade Server 2, cade anche il monitor — nessun sistema monitora sé stesso. Se vuoi coprire pure questo, aggiungi UptimeRobot free tier come controllo esterno terzo su entrambi gli endpoint principali — costo zero, non bloccante.

## Fase 12 — Hardening comune

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
sudo tee -a /etc/apt/apt.conf.d/50unattended-upgrades <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
EOF

# swap più piccolo di Server 1, coerente con 4GB totali
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

`journald` senza tetto — stesso rischio "disco pieno silenzioso" già visto per i log Mongo, per i log di sistema:

```bash
sudo mkdir -p /etc/systemd/journald.conf.d
sudo tee /etc/systemd/journald.conf.d/size-limit.conf <<'EOF'
[Journal]
SystemMaxUse=500M
EOF
sudo systemctl restart systemd-journald
```

**Immagine Docker di Uptime Kuma** — `unattended-upgrades` non la tocca. Stesso principio di Server 1: nessuna automazione (non è un servizio critico quanto Qdrant/ES, ma comunque tiene lo storico dei monitor), promemoria manuale ogni 3 mesi circa:

```bash
docker inspect --format '{{.Config.Image}}' uptime-kuma
# confronta con l'ultimo tag su hub.docker.com/r/louislam/uptime-kuma/tags

docker pull louislam/uptime-kuma:1
docker stop uptime-kuma && docker rm uptime-kuma
# ri-lancia il comando `docker run` della fase 11
```

Backup: verifica cosa copre esattamente il "backup automatico giornaliero" incluso nel piano VPS-1 (intera VM o solo alcuni path) prima di considerarlo l'unica strategia per il DB di MysteryInvestigation. Aggiungi comunque un `mongodump` schedulato come su Server 1 — password letta da file, script leggibile solo dal proprietario, dump **cifrato** prima di lasciare la macchina (stesso motivo di Server 1: niente LUKS, troppo per questa scala e in conflitto col riavvio automatico delle patch — ma il backup che esce dal server sì, a costo quasi zero):

```bash
sudo apt install -y gnupg
openssl rand -hex 32 > ~/.secrets/backup_encryption_pw && chmod 600 ~/.secrets/backup_encryption_pw
```

⚠️ Copia anche questa passphrase fuori dal server (password manager) — persa insieme al server, i backup cifrati diventano illeggibili per sempre.

```bash
mkdir -p ~/backups
cat > ~/backup-mongodb.sh <<'EOF'
#!/bin/bash
set -e
DATE=$(date +%Y%m%d_%H%M%S)
MONGO_PW=$(cat "$HOME/.secrets/mongo_app_pw")
mongodump \
  --uri="mongodb://mystery_app:${MONGO_PW}@127.0.0.1:27017/misteryinvestigation" \
  --out="$HOME/backups/mongodb_$DATE" \
  --gzip

tar -czf "$HOME/backups/mongodb_$DATE.tar.gz" -C "$HOME/backups" "mongodb_$DATE"
rm -rf "$HOME/backups/mongodb_$DATE"

gpg --batch --yes --symmetric --cipher-algo AES256 \
  --passphrase-file "$HOME/.secrets/backup_encryption_pw" \
  "$HOME/backups/mongodb_$DATE.tar.gz"
rm -f "$HOME/backups/mongodb_$DATE.tar.gz"

find "$HOME/backups" -name "mongodb_*.tar.gz.gpg" -mtime +7 -exec rm -f {} \;
EOF
chmod 700 ~/backup-mongodb.sh
~/backup-mongodb.sh   # test manuale

crontab -e
# 0 3 * * * /home/ubuntu/backup-mongodb.sh >> /home/ubuntu/backups/backup.log 2>&1
```

**Testa il restore** — un backup mai ripristinato non è verificato (stesso principio applicato su Server 1, dimenticato qui alla prima stesura). Decifra, spacchetta, poi ripristina:

```bash
gpg --batch --yes --decrypt --passphrase-file ~/.secrets/backup_encryption_pw \
  ~/backups/mongodb_<data>.tar.gz.gpg > /tmp/mongodb_restoretest.tar.gz
tar -xzf /tmp/mongodb_restoretest.tar.gz -C /tmp

mongorestore --uri="mongodb://mystery_app:$(cat ~/.secrets/mongo_app_pw)@127.0.0.1:27017/misteryinvestigation_restoretest" \
  --gzip --nsFrom="misteryinvestigation.*" --nsTo="misteryinvestigation_restoretest.*" \
  /tmp/mongodb_<data>/misteryinvestigation

rm -rf /tmp/mongodb_restoretest.tar.gz /tmp/mongodb_<data>
```

## Fase 13 — Verifica finale, incluso il test di reboot

```bash
curl -I https://<mystery-domain>
curl http://127.0.0.1:3101/health
curl -I https://<keeper-domain>
curl -I https://<gennaro-domain>
curl -I https://status.tenpennynovels.com
pm2 status   # mystery-backend, keeper-discord-bot, keeper-server: tutti online
```

**Test di reboot — non rimandarlo.** Stesso principio di Server 1: un setup "funziona" il giorno del deploy, il vero test è se regge a un riavvio reale.

```bash
sudo reboot
# aspetta 1-2 minuti, poi riconnetti
ssh <alias-vps1>

systemctl is-active mongod nginx docker
docker ps   # uptime-kuma deve essere Up
pm2 status  # tutti i processi online
```

## Fase 14 — Utente admin separato, `ubuntu` senza sudo

Stesso fix di Server 1, stesso motivo: `ubuntu` non ha bisogno di sudo per l'uso quotidiano (PM2, cron, gestione dell'app) — solo il setup iniziale ne aveva bisogno, ed è già fatto.

Qui non c'è ancora una pipeline CI/CD automatica (i deploy di MysteryInvestigation/TheKeeperArchive sono manuali via rsync, fasi 6-7) — il beneficio immediato è comunque reale: se in futuro aggiungi CI anche per questi progetti (coerente con "vita facile"), la separazione dei privilegi è già pronta invece di essere un refactor da fare in corsa.

```bash
sudo adduser <tuo-nome>
sudo usermod -aG sudo <tuo-nome>

sudo mkdir -p /home/<tuo-nome>/.ssh
sudo cp ~/.ssh/authorized_keys /home/<tuo-nome>/.ssh/authorized_keys
sudo chown -R <tuo-nome>:<tuo-nome> /home/<tuo-nome>/.ssh
sudo chmod 700 /home/<tuo-nome>/.ssh
sudo chmod 600 /home/<tuo-nome>/.ssh/authorized_keys
```

Testa il login **in un nuovo terminale** prima di continuare:

```bash
ssh <tuo-nome>@<IP_VPS1>
sudo ls /root   # verifica sudo
```

Solo ora, confermato che `<tuo-nome>` funziona:

```bash
sudo deluser ubuntu sudo
```

Da qui in avanti: lavoro di sistema (nginx, mongo, docker, ufw, apt) come `<tuo-nome>`; ispezione/gestione dell'app (`pm2 status`, `pm2 logs`, `.env`, deploy manuali) come `ubuntu` — `sudo su - ubuntu` da `<tuo-nome>` quando serve.

**Stesso limite onesto di Server 1**: protegge dalla persistenza a livello root, non da un accesso già ottenuto come `ubuntu` (che vede comunque tutti i secret applicativi e può modificare l'app in esecuzione).

---

## Vita facile: agganciare un sito nuovo in futuro

Niente pannello — uno script minimo che genera il blocco nginx e ti ricorda il comando certbot. Crealo una volta:

```bash
mkdir -p ~/scripts
nano ~/scripts/new-site.sh
```

```bash
#!/bin/bash
# Uso:
#   new-site.sh static <dominio>          -> sito statico, file in /var/www/<dominio>
#   new-site.sh proxy  <dominio> <porta>  -> reverse proxy verso 127.0.0.1:<porta>
set -e

MODE="$1"
DOMAIN="$2"
PORT="$3"

if [ -z "$MODE" ] || [ -z "$DOMAIN" ]; then
  echo "Uso: $0 static <dominio>"
  echo "     $0 proxy  <dominio> <porta>"
  exit 1
fi

CONF="/etc/nginx/sites-available/${DOMAIN}.conf"

if [ "$MODE" = "static" ]; then
  sudo mkdir -p "/var/www/${DOMAIN}"
  sudo chown -R "$USER:$USER" "/var/www/${DOMAIN}"
  sudo tee "$CONF" > /dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    root /var/www/${DOMAIN};
    index index.html;
    include snippets/security-headers.conf;
    location / {
        try_files \$uri \$uri/ =404;
    }
}
EOF
  echo "Ora copia i file statici in /var/www/${DOMAIN}/"

elif [ "$MODE" = "proxy" ]; then
  if [ -z "$PORT" ]; then
    echo "Serve la porta per la modalità proxy"
    exit 1
  fi
  sudo tee "$CONF" > /dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    include snippets/security-headers.conf;
    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
else
  echo "Modalità sconosciuta: $MODE (usa 'static' o 'proxy')"
  exit 1
fi

sudo ln -sf "$CONF" "/etc/nginx/sites-enabled/${DOMAIN}.conf"
sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "Nginx pronto per ${DOMAIN}. Verifica che il DNS punti già a questo IP (dig +short A ${DOMAIN}), poi:"
echo "  sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
```

```bash
chmod +x ~/scripts/new-site.sh
```

Uso pratico da quel momento in poi:

```bash
# sito statico
~/scripts/new-site.sh static nuovosito.com
# copi i file in /var/www/nuovosito.com/, poi:
sudo certbot --nginx -d nuovosito.com -d www.nuovosito.com

# app con backend proprio (Node/Python/qualsiasi cosa in ascolto su una porta locale)
~/scripts/new-site.sh proxy app.nuovosito.com 4500
sudo certbot --nginx -d app.nuovosito.com
```

Se il backend serve un processo persistente, avvialo con PM2 — stesso tool usato per tutto il resto su entrambi i server, non introdurre systemd per un'app Node nuova solo perché è comodo in quel momento. In pratica: aggiungi la voce in `~/ecosystem.config.js` (stesso file di Fase 5, stesso pattern con `interpreter` pinnato) e `pm2 startOrRestart ecosystem.config.js --only nuovosito --env production`. Lo script `new-site.sh` gestisce solo la parte nginx/SSL, non il processo applicativo — quella non si generalizza bene in uno script, ma il *tool* da usare non è in discussione: sempre PM2.

**Limite dello script, dichiarato**: non gestisce DNS (va fatto su Cloudflare a mano), non valida che la porta indicata sia davvero in ascolto, non fa backup della config precedente se il dominio esiste già. Per 2-3 siti l'anno va benissimo; se il ritmo salisse a "un sito a settimana" varrebbe la pena rivedere la scelta del pannello.

---

## Checklist prima di lasciar scadere i vecchi domini `.it`/`.me`

- [ ] Email attive su uno dei tre domini vecchi? Verifica che nessun account/servizio le usi per recupero password prima di perderle
- [ ] `thekeeperarchive.it`: webhook/callback del bot aggiornati al nuovo dominio, non solo il sito
- [ ] `misteryinvestigation.it`: `EMAIL_USER`/relay SMTP verificato sul nuovo IP e nuovo dominio
- [ ] Conferma definitiva su `poc.thekeeperarchive.it` prima di deciderne il destino

## Non incluso qui, deliberatamente

- **Alert su spazio disco** — rimandato qui da RUNBOOK_SERVER1.md ma non implementato: Uptime Kuma non monitora nativamente lo spazio disco dell'host senza un push-monitor dedicato. Se serve, uno script cron con `curl` verso l'URL push di un monitor Uptime Kuma "Push" è la via più semplice, da aggiungere quando il resto è stabile.
- **HestiaCP o altro pannello leggero** — scartato per lo stesso motivo di cPanel (overhead, conflitto con nginx/PM2 già in uso), ma se in futuro i siti statici/piccoli diventano molti, è l'opzione da rivalutare per primo (gratuito, meno pesante di cPanel) — non ora.
