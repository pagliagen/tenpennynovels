# Runbook Server 1 — TenPennyNovels

> Esecutivo, non di analisi: le decisioni e il *perché* sono in [MIGRAZIONE-SERVER.md](./MIGRAZIONE-SERVER.md). Questo documento è la sequenza di comandi per portare il server da "appena creato" a "in produzione", incorporando le correzioni già decise lì (non un lift-and-shift del server condiviso attuale).

## Il server

**So you Start SYS-1** — Intel Xeon-E 2136 (Coffee Lake, 6c/12t, 3.3/4.5GHz) · 32GB DDR4-2666 ECC · 2×512GB · 500Mbps pubblica + 1Gbps privata · €29.99/mese.

> Scelta rivista il 29/07/2026: il Kimsufi KS-5 su cui era caduta la decisione originale è stato **rimosso dal catalogo**. Motivazione completa e alternative valutate in [MIGRAZIONE-SERVER.md § Server 1](./MIGRAZIONE-SERVER.md). Ripiego se il SYS-1 non è disponibile in un DC europeo: **Kimsufi KS-3** (Xeon E3-1245 v5, 4c/8t, 32GB, €18.99) — in quel caso RAM e sizing di questo runbook restano identici, cambiano solo CPU, dischi (SATA anziché NVMe) e banda.

Ospita tutto lo stack TenPennyNovels: 4 app Next.js (landing, game, documents, management), 3 backend (api-gateway, unified-backend, embeddings-worker), MongoDB, Redis, Qdrant, Elasticsearch, Ollama. **Non** ospita botai/character-gen (confermato: non andranno mai in produzione) né i progetti di Server 2.

Prerequisito prima di iniziare: dominio `tenpennynovels.com` con DNS già su Cloudflare (in corso, vedi MIGRAZIONE-SERVER.md § Domini). TTL basso (300s, già impostato) sui 7 record A utili per un cutover rapido a fine runbook.

---

## Fase 1 — Provisioning e accesso base

```bash
ssh root@<IP_SYS1>
apt update && apt upgrade -y
apt install -y curl wget git build-essential software-properties-common
```

Crea l'utente non-root (lo chiamo `deploy` qui; se preferisci mantenere `ubuntu` per coerenza con `ecosystem.config.js`/script esistenti che assumono quel path, rinominalo lì o crea l'utente come `ubuntu`):

```bash
adduser ubuntu
usermod -aG sudo ubuntu
su - ubuntu
sudo ls /root   # verifica sudo
exit
```

Hostname vero, non quello di default del provider (aiuta a non confondersi tra i due server quando sei loggato su entrambi, e compare nei log/MOTD):

```bash
sudo hostnamectl set-hostname tenpennynovels-sys1
```

**Convenzione segreti usata in tutto questo runbook**: mai una password letterale in un comando bash (finisce in `~/.bash_history` in chiaro, leggibile per sempre). Ogni volta che serve generarne una, va in un file dedicato sotto `~/.secrets/`, e viene referenziata con `$(cat ~/.secrets/<nome>)` — mai scritta a mano nei comandi successivi.

```bash
mkdir -p ~/.secrets && chmod 700 ~/.secrets
```

## Fase 2 — SSH: chiudere il buco trovato sul server attuale

MIGRAZIONE-SERVER.md ha verificato che sul box condiviso attuale `PasswordAuthentication yes` è **effettivamente attivo** (file di config in conflitto, uno vince sull'altro) nonostante l'intento fosse disabilitarlo. Sul server nuovo: **un solo file autorevole**, non due che si contraddicono.

```bash
# Sul tuo Mac (non sul server)
ssh-keygen -t ed25519 -C "deploy@tenpennynovels" -f ~/.ssh/tenpennynovels_sys1
cat ~/.ssh/tenpennynovels_sys1.pub
```

```bash
# Sul server, come ubuntu
mkdir -p ~/.ssh && chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys   # incolla la chiave pubblica
chmod 600 ~/.ssh/authorized_keys
```

Testa il login via chiave **in un nuovo terminale** prima di toccare altro:

```bash
ssh -i ~/.ssh/tenpennynovels_sys1 ubuntu@<IP_SYS1>
```

Poi disabilita la password — verificando che non resti un secondo file a fare override, come successo sul server attuale:

```bash
grep -rl "PasswordAuthentication" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/
# Se compare più di un file, consolida in uno solo

sudo nano /etc/ssh/sshd_config
# PasswordAuthentication no
# PermitRootLogin no
# PubkeyAuthentication yes

sudo sshd -T | grep -i passwordauthentication   # deve dire "no", non fidarsi a occhio
sudo systemctl restart sshd
```

Non chiudere il terminale corrente finché non hai verificato il login da uno nuovo.

**fail2ban** — sul server attuale è installato ma spento, zero protezione. Qui va abilitato da subito:

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
sudo tee /etc/fail2ban/jail.local <<'EOF'
[sshd]
enabled = true
EOF
sudo systemctl restart fail2ban
sudo fail2ban-client status sshd
```

**Non installare vsftpd** su questo server — sul box attuale è un servizio attivo ma non necessario (SFTP via SSH copre lo stesso bisogno). Nota: il CDN in Fase 10 usa FTP verso *Serverplan*, non verso questo server — questa raccomandazione riguarda solo Server 1 stesso.

## Fase 3 — Firewall

`ufw limit` invece di `ufw allow` su SSH: throttla i tentativi ripetuti a livello firewall (oltre 6 connessioni in 30s dallo stesso IP vengono bloccate), complementare a fail2ban (Fase 2) — non ridondante, agiscono a due livelli diversi.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw limit 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw logging on
sudo ufw enable
sudo ufw status verbose
```

Verifica che AppArmor sia attivo (Ubuntu lo abilita di default, ma "di default" non è "verificato" — specialmente con Docker in mezzo, che a volte necessita di profili dedicati per i container):

```bash
sudo aa-status | head -5
# deve dire "apparmor module is loaded" e mostrare profili in enforce
```

`server_tokens off;` in nginx (fase 13) — sul server attuale è commentato, versione nginx esposta inutilmente.

## Fase 4 — Node.js: una sola versione, pinnata

Decisione chiusa in MIGRAZIONE-SERVER.md: `v24.18.0` ovunque (oggi in produzione gira v22.13.1 nonostante `.nvmrc` dichiari v24.18.0 — è il drift che questa fase chiude).

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm install 24.18.0
nvm alias default 24.18.0
node --version   # v24.18.0
```

L'`ecosystem.config.js` del repo ha già l'`interpreter` pinnato esplicitamente su `/home/ubuntu/.nvm/versions/node/v24.18.0/bin/node` per ogni processo — è la causa diretta del drift trovato sul server attuale (PATH al momento del deploy, non versione esplicita), già corretta nel codice. Se l'utente non si chiama `ubuntu`, aggiorna quei path prima del primo `pm2 start`.

```bash
npm install -g pm2
pm2 --version
```

## Fase 5 — MongoDB: auth obbligatoria da subito

Decisione chiusa: sul server attuale `security.authorization` è commentato e la connection string non ha credenziali, su **entrambi** i DB (TenPenny e MysteryInvestigation, quest'ultimo non riguarda Server 1). Qui va abilitata da subito, non come step successivo.

```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
```

Crea **un utente applicativo scoped**, non un admin/superuser nella connection string di produzione (esplicitamente deciso: `readWrite` sul proprio DB soltanto). Genera le password *prima*, in file, non a mano nel prompt:

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
db.getSiblingDB('tenpennynovels').createUser({
  user: 'tenpennynovels_app',
  pwd: '$(cat ~/.secrets/mongo_app_pw)',
  roles: [ { role: 'readWrite', db: 'tenpennynovels' } ]
});
"
```

`mongosh` salva la history dei comandi eseguiti in `~/.dbshell` — anche passando per `--eval` da bash, verifica cosa ci finisce e ripulisci per sicurezza:

```bash
rm -f ~/.dbshell
```

```bash
sudo nano /etc/mongod.conf
# security:
#   authorization: enabled
# net:
#   bindIp: 127.0.0.1

sudo systemctl restart mongod
mongosh -u tenpennynovels_app -p --authenticationDatabase tenpennynovels
# alla richiesta password, incolla il contenuto di ~/.secrets/mongo_app_pw (mai come argomento -p)
```

`ulimit` a 64000 file descriptor — già a posto sul server attuale, replicalo:

```bash
sudo systemctl edit mongod
# [Service]
# LimitNOFILE=64000
sudo systemctl daemon-reload && sudo systemctl restart mongod
```

**Log rotation** — sul server attuale il log Mongo è a 107MB e cresce senza limite, nessuna rotazione. Qui va aggiunta subito:

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

## Fase 6 — Redis

```bash
openssl rand -hex 32 > ~/.secrets/redis_pw && chmod 600 ~/.secrets/redis_pw

sudo apt install -y redis-server
sudo nano /etc/redis/redis.conf
# bind 127.0.0.1 ::1
# appendonly yes
# appendfsync everysec
# maxmemory 4gb
# maxmemory-policy allkeys-lru
# requirepass <incolla qui il contenuto di ~/.secrets/redis_pw>   # difesa in profondità, a costo zero, mancava sul server attuale
sudo systemctl enable --now redis-server
```

`-a` sulla riga di comando finisce nella history **e** redis-cli stesso avvisa che è insicuro — usa la variabile d'ambiente dedicata:

```bash
REDISCLI_AUTH="$(cat ~/.secrets/redis_pw)" redis-cli ping
```

## Fase 7 — Qdrant (Docker, bind solo localhost)

Sul server attuale Qdrant è pubblicato su `0.0.0.0:6333/6334` via docker-proxy: `ufw` in teoria lo protegge, ma Docker inserisce le proprie regole iptables nella catena `DOCKER` prima che `ufw` le processi — non fidarsi del firewall per le porte pubblicate da container. Fix: pubblicare **solo** su `127.0.0.1`.

`127.0.0.1` da solo riduce il rischio a "chiunque abbia già shell sulla macchina" — stessa soglia per cui in Fase 6 ho messo una password a Redis. Stesso ragionamento qui: aggiungi anche una API key, a costo zero.

```bash
openssl rand -hex 32 > ~/.secrets/qdrant_api_key && chmod 600 ~/.secrets/qdrant_api_key

curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
newgrp docker

docker run -d \
  --name qdrant \
  -p 127.0.0.1:6333:6333 \
  -p 127.0.0.1:6334:6334 \
  -e QDRANT__SERVICE__API_KEY="$(cat ~/.secrets/qdrant_api_key)" \
  -v ~/qdrant_storage:/qdrant/storage \
  --restart unless-stopped \
  qdrant/qdrant:v1.17.0

curl -H "api-key: $(cat ~/.secrets/qdrant_api_key)" http://127.0.0.1:6333/healthz
sudo systemctl enable docker
```

`QDRANT_API_KEY` va poi in `services/embeddings-worker/.env.production` (Fase 10) — il client Node ora la legge (`services/embeddings-worker/src/config/index.ts` aggiornato per passarla al costruttore di `QdrantClient`, altrimenti l'app avrebbe iniziato a ricevere 401 su ogni chiamata dal momento in cui questa API key viene attivata).

**Non usare il `docker-compose.yml` in root del repo per la produzione** — è lo stack di sviluppo locale (build da `Dockerfile.dev`, password Mongo/Redis di default, porte esposte senza bind locale). In produzione Mongo/Redis girano nativi (fasi 5-6) e Qdrant/Elasticsearch sono container standalone lanciati a mano, come sopra.

## Fase 8 — Elasticsearch: da provisionare, non da saltare

MIGRAZIONE-SERVER.md ha verificato **nel codice** (non solo nel `package.json`) che `embedding-worker.ts`/`EmbeddingsHttpServer.ts` scrivono e interrogano Elasticsearch in parallelo a Qdrant per `document_chunks`, `forum_posts`, `chat_messages` — è ricerca ibrida reale, non un residuo. Va installato.

Nativo o Docker è ancora aperto nel documento di analisi. **Raccomandazione**: Docker, per coerenza con Qdrant (stesso pattern di gestione, stesso comando `stop`+`up -d` per gli aggiornamenti, nessun repo apt aggiuntivo da mantenere).

`xpack.security.enabled=false` (come impostato di default in dev) lascia Elasticsearch senza alcuna autenticazione — stessa incoerenza di Qdrant senza API key vista sopra. Fix: sicurezza attiva ma **TLS sull'HTTP disattivato esplicitamente** (siamo su loopback, l'obiettivo è l'autenticazione non la cifratura verso sé stessi — abilitare anche TLS qui aprirebbe una gestione certificati non necessaria a questo scopo):

```bash
openssl rand -hex 32 > ~/.secrets/elastic_pw && chmod 600 ~/.secrets/elastic_pw

docker run -d \
  --name elasticsearch \
  -p 127.0.0.1:9200:9200 \
  -e discovery.type=single-node \
  -e xpack.security.enabled=true \
  -e xpack.security.http.ssl.enabled=false \
  -e ELASTIC_PASSWORD="$(cat ~/.secrets/elastic_pw)" \
  -e "ES_JAVA_OPTS=-Xms512m -Xmx512m" \
  -v ~/elasticsearch_data:/usr/share/elasticsearch/data \
  --restart unless-stopped \
  elasticsearch:8.11.0

sleep 30 && curl -u "elastic:$(cat ~/.secrets/elastic_pw)" http://127.0.0.1:9200/
```

`ELASTICSEARCH_USERNAME=elastic` / `ELASTICSEARCH_PASSWORD` vanno poi in `services/embeddings-worker/.env.production` (Fase 10) — stesso motivo di Qdrant sopra: il client Node ora li legge (`EmbeddingsHttpServer.ts`/`embedding-worker.ts` aggiornati), altrimenti l'app avrebbe smesso di raggiungere Elasticsearch dal momento in cui l'auth viene attivata. Usare il superuser `elastic` direttamente è una semplificazione accettabile a questa scala (un solo servizio, un solo consumer, non esposto oltre `127.0.0.1`) — con più consumer varrebbe la pena creare un utente applicativo scoped, come già fatto per Mongo.

Log rotation Elasticsearch: non verificato sul server attuale (config log4j2 non trovata nella ricognizione). Non assumere che il pacchetto la gestisca da solo — controlla `/usr/share/elasticsearch/config/log4j2.properties` (o l'equivalente path nel volume) dopo l'avvio e aggiungi `logrotate.d` se manca rotazione per età/dimensione.

Aggiorna `20-backend.md`/`30-ai-services.md` con questa scelta (nativo vs Docker) una volta decisa — è il gap di documentazione che MIGRAZIONE-SERVER.md ha già segnalato come da colmare.

## Fase 9 — Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl status ollama
```

**Non dare per scontato il bind**, verificalo esplicitamente (stesso tipo di errore trovato su Qdrant):

```bash
sudo ss -tlnp | grep 11434
# deve mostrare 127.0.0.1:11434, non 0.0.0.0:11434
```

```bash
ollama pull qwen3:8b   # modello RAG "Bibliotecario", vedi embeddings-worker.env
```

Ollama **non è e non sarà un processo PM2** — resta systemd nativo, gestito dal proprio installer.

## Fase 10 — Clone, dipendenze, variabili d'ambiente

```bash
cd ~
git clone <URL_REPO> tenpennynovels
cd tenpennynovels
nvm use   # legge .nvmrc, deve dare v24.18.0

./deploy/scripts/install-all.sh
./deploy/scripts/copy-env-files.sh   # crea .env.production da deploy/env-templates/ in ogni app/service
```

Per ciascun `.env.production` creato (`apps/{landing,game,documents,management}`, `services/{api-gateway,unified-backend,embeddings-worker}`): sostituisci i placeholder `CHANGE_ME` con segreti **generati ora**, non riusati dal vecchio server (JWT_SECRET/JWT_REFRESH_SECRET con `openssl rand -hex 64`, AI_GATEWAY_* con `openssl rand -hex 32`), e le connection string con le credenziali scoped create in fase 5-6. In `services/embeddings-worker/.env.production` aggiungi anche `QDRANT_API_KEY` (da `~/.secrets/qdrant_api_key`, fase 7) e `ELASTICSEARCH_USERNAME=elastic` + `ELASTICSEARCH_PASSWORD` (da `~/.secrets/elastic_pw`, fase 8) — assenti nel template prima di questa revisione, il codice ora li supporta.

```bash
chmod 600 apps/*/.env.production services/*/.env.production
```

**CDN — aggiornato 01/08/2026, cambia rispetto al vecchio server**: niente più sync FTP verso Serverplan (`FTPSyncService`/`basic-ftp`/`CDN_FTP_*` rimossi dal codice). `unified-backend.env` ha solo `CDN_STORAGE_PATH`/`CDN_BASE_URL`. Le immagini vanno servite direttamente da questo server via nginx — aggiungi il `server{}` block per `cdn.tenpennynovels.com` documentato in `deploy/docs/07-cdn-setup.md` (nuova sezione "Setup produzione") e punta il DNS `cdn` al nuovo IP invece che a Serverplan.

```bash
sudo mkdir -p /var/www/cdn-cache/{locations,items,characters,occupations}
sudo chown -R ubuntu:ubuntu /var/www/cdn-cache
```

## Fase 11 — Build

```bash
npm run build:frontend:all   # 10-15 min
npm run build:backend:all

cd services/embeddings-worker/python
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
python3 setup-models.py   # pre-scarica i modelli HuggingFace; se fallisce (rate limit) si scaricano al primo uso
deactivate
```

## Fase 12 — PM2

```bash
cd ~/tenpennynovels
pm2 startOrRestart ecosystem.config.js --env production
pm2 status   # 8 processi online (4 frontend + api-gateway + unified-backend + embeddings-service py + embeddings-worker)
pm2 save
pm2 startup   # esegui UNA SOLA VOLTA il comando sudo che stampa, per l'utente ubuntu
```

Verifica che non resti un secondo unit systemd PM2 duplicato (successo sul server attuale con `pm2-root.service` orfano accanto a `pm2-ubuntu.service`):

```bash
systemctl list-units --type=service | grep pm2
# deve comparirne uno solo
```

`pm2-logrotate` — sul server attuale è già configurato bene (10MB/file, retain 7, compresso, giornaliero), replica identico:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
```

## Fase 13 — Nginx

I file reali sono in `deploy/nginx-configs/`: `tenpennynovels.com.conf`, `game.tenpennynovels.com.conf`, `documenti.tenpennynovels.com.conf`, `gestione.tenpennynovels.com.conf`, `api.tenpennynovels.com.conf`, `ws.tenpennynovels.com.conf`, `cdn.tenpennynovels.com.conf` — 7 file, nomi con `.com` incluso (occhio, non coincidono coi nomi più corti usati in vecchie note di deploy).

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

sudo cp ~/tenpennynovels/deploy/nginx-configs/*.conf /etc/nginx/sites-available/
for f in ~/tenpennynovels/deploy/nginx-configs/*.conf; do
  sudo ln -sf "/etc/nginx/sites-available/$(basename "$f")" /etc/nginx/sites-enabled/
done
sudo rm -f /etc/nginx/sites-enabled/default

sudo nano /etc/nginx/nginx.conf
# server_tokens off;   # commentato sul server attuale, fixalo qui

sudo nginx -t
sudo systemctl enable --now nginx
```

**Header di sicurezza** — nessuno dei 7 vhost ne ha oggi. Vanno messi una volta in uno snippet incluso da tutti, non riscritti sito per sito:

```bash
sudo tee /etc/nginx/snippets/security-headers.conf <<'EOF'
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
# Strict-Transport-Security va aggiunto SOLO dopo aver verificato che SSL è stabile
# su tutti i domini (fase 14) — è un impegno difficile da disfare (preload).
EOF
```

Aggiungi `include snippets/security-headers.conf;` dentro ogni blocco `server{}` in `/etc/nginx/sites-available/*.conf` (dopo `listen`, prima delle `location`).

**fail2ban per nginx** — in Fase 2 fail2ban copre solo SSH. Ora che nginx esiste, aggiungi almeno il jail per gli scanner più comuni (log 404/malformed ripetuti):

```bash
sudo tee -a /etc/fail2ban/jail.local <<'EOF'

[nginx-botsearch]
enabled = true
EOF
sudo systemctl restart fail2ban
```

**`gestione.tenpennynovels.com`** — sul server attuale non ha alcuna restrizione di rete oltre all'auth applicativa (JWT + `isGestore`). Non è un buco (l'auth c'è), ma per un pannello admin vale la pena aggiungere un secondo strato qui, in fase di setup nginx, piuttosto che rimandarlo di nuovo:

```nginx
# dentro il server{} di gestione.tenpennynovels.com, prima del proxy_pass
allow <tuo IP statico>;
deny all;
# oppure, se non hai un IP statico: auth_basic + htpasswd
```

## Fase 14 — SSL

```bash
# Prerequisito: i 7 record A puntano già a questo IP (verifica dopo il cutover DNS, fase 17)
sudo certbot --nginx \
  -d tenpennynovels.com -d www.tenpennynovels.com \
  -d game.tenpennynovels.com \
  -d documenti.tenpennynovels.com \
  -d gestione.tenpennynovels.com \
  -d api.tenpennynovels.com \
  -d ws.tenpennynovels.com \
  -d cdn.tenpennynovels.com

sudo certbot renew --dry-run
```

Sul server attuale certbot rinnova **due volte** (systemd timer + una vecchia riga in crontab rimasta da un setup precedente) — innocuo ma ridondante. Qui tieni solo il timer:

```bash
systemctl status certbot.timer   # deve essere active/waiting
crontab -l | grep certbot        # non deve comparire nulla — non aggiungerlo
```

Solo ora, con SSL confermato stabile su tutti i domini, aggiungi l'HSTS allo snippet di Fase 13 (prima è prematuro: è un impegno che si disfa lentamente, coi browser che ricordano l'header per la durata di `max-age`):

```bash
echo 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;' | \
  sudo tee -a /etc/nginx/snippets/security-headers.conf
sudo nginx -t && sudo systemctl reload nginx
```

## Fase 15 — Swap

Sul server attuale: 8GB (condiviso tra 4 progetti). Su SYS-1 con 32GB dedicati a un solo progetto, una rete di sicurezza OOM più piccola basta:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Fase 16 — Aggiornamenti automatici e igiene log di sistema

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

`unattended-upgrades` installa le patch ma non riavvia da solo: una patch kernel/sicurezza resta inapplicata finché qualcuno non riavvia manualmente, a meno di deciderlo esplicitamente. Scegli consapevolmente, non lasciarlo implicito:

```bash
sudo tee -a /etc/apt/apt.conf.d/50unattended-upgrades <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
EOF
```

**`journald` senza tetto** — stesso identico rischio "disco pieno silenzioso" già visto per i log Mongo (fase 5), ma per i log di sistema. Non toccato finora:

```bash
sudo mkdir -p /etc/systemd/journald.conf.d
sudo tee /etc/systemd/journald.conf.d/size-limit.conf <<'EOF'
[Journal]
SystemMaxUse=500M
EOF
sudo systemctl restart systemd-journald
```

**Immagini Docker: `unattended-upgrades` non le tocca.** Patcha i pacchetti apt, non `qdrant/qdrant:v1.17.0` né `elasticsearch:8.11.0` (fasi 7-8) — versioni pinnate volutamente per stabilità, quindi restano ferme finché non le aggiorni tu a mano. Niente automazione qui (watchtower o simili): sono servizi con dati veri, un bump automatico non revisionato di una versione major potrebbe rompere compatibilità di formato senza preavviso. Promemoria manuale, non tooling — controlla ogni 3 mesi circa:

```bash
docker inspect --format '{{.Config.Image}}' qdrant elasticsearch
# confronta con l'ultimo tag stabile su hub.docker.com/r/qdrant/qdrant/tags
# e hub.docker.com/_/elasticsearch/tags — leggi il changelog PRIMA di bumpare,
# specialmente per Elasticsearch: un salto di major version può richiedere reindex
```

Bump sicuro (nessun `docker compose` qui, sono container standalone — vedi fasi 7-8):

```bash
docker pull qdrant/qdrant:v1.X.Y
docker stop qdrant && docker rm qdrant
# ri-lancia il comando `docker run` della fase 7, con il tag aggiornato
```

## Fase 17 — Backup

Backup Agent Kimsufi è gratuito (paghi solo l'Object Storage OVHcloud usato) — dimensionalo sui backup attuali (~300-600MB oggi, verosimilmente marginale). Attivalo dal pannello Kimsufi.

Non basta come unica strategia: aggiungi `mongodump` schedulato e **testane almeno una volta il restore** — un backup mai ripristinato non è verificato.

Password letta da file a runtime, mai scritta dentro lo script — se lo script viene mai copiato/condiviso per errore, non porta con sé la credenziale. `chmod 700`, non `+x` soltanto: lo script resta leggibile da chiunque abbia accesso alla home altrimenti (`+x` aggiunge l'eseguibilità, non toglie la leggibilità di default).

Il dump esce dalla macchina (Object Storage OVH via Backup Agent, o comunque va copiato altrove per essere un backup vero): va **cifrato prima di lasciare il server**, non in chiaro. Niente LUKS (scartato sopra, vedi discussione) — cifrare solo l'archivio di backup non ha il problema dello sblocco al boot, serve una passphrase solo al momento del restore:

```bash
sudo apt install -y gnupg
openssl rand -hex 32 > ~/.secrets/backup_encryption_pw && chmod 600 ~/.secrets/backup_encryption_pw
```

⚠️ **Copia questa passphrase anche fuori dal server** (password manager) — se il server muore e la porta con sé, i backup cifrati restano illeggibili per sempre, il che vanificherebbe lo scopo stesso di avere un backup.

```bash
mkdir -p ~/backups
cat > ~/backup-mongodb.sh <<'EOF'
#!/bin/bash
set -e
DATE=$(date +%Y%m%d_%H%M%S)
MONGO_PW=$(cat "$HOME/.secrets/mongo_app_pw")
mongodump \
  --uri="mongodb://tenpennynovels_app:${MONGO_PW}@127.0.0.1:27017/tenpennynovels" \
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

Testa il restore su un DB temporaneo prima di considerarlo a posto — decifra, spacchetta, poi ripristina:

```bash
gpg --batch --yes --decrypt --passphrase-file ~/.secrets/backup_encryption_pw \
  ~/backups/mongodb_<data>.tar.gz.gpg > /tmp/mongodb_restoretest.tar.gz
tar -xzf /tmp/mongodb_restoretest.tar.gz -C /tmp

mongorestore --uri="mongodb://tenpennynovels_app:$(cat ~/.secrets/mongo_app_pw)@127.0.0.1:27017/tenpennynovels_restoretest" \
  --gzip --nsFrom="tenpennynovels.*" --nsTo="tenpennynovels_restoretest.*" \
  /tmp/mongodb_<data>/tenpennynovels

rm -rf /tmp/mongodb_restoretest.tar.gz /tmp/mongodb_<data>   # non lasciare il dump decifrato in giro
```

Alert su spazio disco basso — motivato direttamente dal log Mongo trovato senza rotazione sul server attuale: se ricapita e il disco si riempie, tutto si blocca silenziosamente. Semplice, non serve un tool dedicato:

```bash
# crontab -e
# 0 * * * * df -h / | awk 'NR==2{gsub("%","",$5); if ($5+0 > 85) print "Disco al " $5 "%"}' | mail -s "Alert disco SYS-1" <tua-email>
```

(Dipende da un MTA locale funzionante — se preferisci evitarlo, rimanda l'alerting disco al setup di Uptime Kuma su Server 2, vedi RUNBOOK_SERVER2.md.)

## Fase 18 — GitHub Actions: aggiornare i secrets

Il workflow (`.github/workflows/deploy.yml`) fa deploy via rsync+SSH usando 4 secrets che oggi puntano al vecchio IP OVH. Da aggiornare **prima** del primo push su master dopo il cutover:

| Secret | Nuovo valore |
|---|---|
| `SSH_HOST` | IP di SYS-1 |
| `SSH_PORT` | porta SSH (22 se non cambiata in fase 2) |
| `SSH_USERNAME` | `ubuntu` (o l'utente scelto in fase 1) |
| `SSH_PRIVATE_KEY` | chiave privata generata in fase 2 (non quella del vecchio server) |

`HUGGINGFACE_TOKEN` e `DOCUMENTS_BUILD_BYPASS_SECRET` restano gli stessi valori, non serve rigenerarli a meno che tu non voglia ruotarli.

Dopo l'update, un push su `master` (o `workflow_dispatch`) esegue il deploy completo: rsync → install deps (hash-based, salta se invariato) → build frontend → build backend → PM2 `startOrRestart` → health check su `api.` (1 tentativo) e `ws.` (5 tentativi, 5s). Usalo per il primo deploy reale invece di rifare a mano i passi delle fasi 10-12: più vicino a come funzionerà ogni giorno dopo.

## Fase 19 — Cutover DNS

TTL già a 300s sui record Cloudflare (verificato). Sequenza a basso rischio dato che il sito non è ancora live (downtime accettabile, confermato):

```bash
# Su Cloudflare, aggiorna i 7 record A da 51.83.47.109 (vecchio OVH) al nuovo IP SYS-1:
# tenpennynovels.com, www, game, documenti, gestione, api, ws
# (cdn.tenpennynovels.com resta su Serverplan, non tocca — vedi fase 10)
```

Dopo la propagazione (minuti, TTL basso):

```bash
dig +short A tenpennynovels.com @1.1.1.1
dig +short A game.tenpennynovels.com @1.1.1.1
# devono restituire il nuovo IP
```

## Fase 20 — Verifica finale

```bash
curl https://api.tenpennynovels.com/health
curl https://ws.tenpennynovels.com/health
curl -I https://tenpennynovels.com
curl -I https://game.tenpennynovels.com
curl -I https://documenti.tenpennynovels.com
curl -I https://gestione.tenpennynovels.com
curl -I https://cdn.tenpennynovels.com
```

Test browser: WebSocket su `game.tenpennynovels.com` (Network tab → WS → connessione a `wss://ws.tenpennynovels.com/socket.io/`), upload immagine da `gestione.` per validare la sync FTP verso Serverplan, login/gameplay end-to-end.

**Monitoraggio esterno**: deciso che vive su Server 2 (Uptime Kuma, monitora *da fuori*, mai un server che sorveglia sé stesso) — vedi RUNBOOK_SERVER2.md. Qui basta che `/health` su `api.` e `ws.` rispondano, già verificato sopra.

**Test di reboot — non salvatelo per dopo.** Tutto "funziona" il giorno del setup; il vero test è se l'ordine di avvio regge a un riavvio reale, non solo sulla carta. Fallo ora, mentre sei ancora davanti al terminale e puoi intervenire, non tra tre mesi durante un riavvio inatteso:

```bash
sudo reboot
# aspetta 1-2 minuti, poi riconnetti
ssh tenpennynovels

systemctl is-active mongod redis-server nginx docker
docker ps   # qdrant ed elasticsearch devono essere Up
pm2 status  # tutti i processi online, non "errored" o "stopped"
curl https://api.tenpennynovels.com/health
```

Se qualcosa non riparte da solo, è molto meglio scoprirlo adesso che durante un incidente reale.

## Fase 21 — Utente admin separato, `ubuntu` senza sudo

Ripercorrendo `.github/workflows/deploy.yml` passo per passo: la pipeline CI/CD non usa mai `sudo` — rsync, `npm install`/`build`, `pm2 startOrRestart` girano tutti come utente semplice. L'unico comando sudo di PM2 (`pm2 startup`, fase 12) è un bootstrap una tantum già fatto. Quindi da qui in poi `ubuntu` non ha più bisogno di sudo per l'uso quotidiano (CI, cron, PM2) — solo il setup iniziale (già fatto nelle fasi precedenti) ne aveva bisogno.

Crea un utente personale, separato, per il lavoro di amministrazione da qui in avanti:

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
ssh -i ~/.ssh/tenpennynovels_sys1 <tuo-nome>@<IP_SYS1>
sudo ls /root   # verifica sudo
```

Solo ora, confermato che `<tuo-nome>` funziona, rimuovi `ubuntu` dal gruppo sudo:

```bash
sudo deluser ubuntu sudo
```

`SSH_USERNAME` in GitHub Actions resta `ubuntu`, invariato — coincide con tutti i path già pinnati in `ecosystem.config.js`, nessuna modifica al codice. Da qui in poi: lavoro di sistema (nginx, mongo, docker, ufw, apt) come `<tuo-nome>`; ispezione/gestione dell'app (`pm2 status`, `pm2 logs`, controllo `.env`) come `ubuntu` — `sudo su - ubuntu` da `<tuo-nome>` quando serve, o tieni a portata anche la chiave SSH di `ubuntu` per un accesso diretto.

**Limite onesto, non risolto da questo fix**: se la chiave SSH di GitHub Actions trapela, chi la ottiene ha comunque accesso completo ai secret applicativi (`.env`, JWT, credenziali Mongo/FTP) e può sostituire il codice in esecuzione — CI stessa scrive quei file per lavoro legittimo, togliere sudo non cambia questo. Quello che previene è la persistenza a **livello root** (rootkit, modifica di config di sistema, lettura dei certificati privati in `/etc/letsencrypt`): riduce un incidente da "reinstalla il server da zero" a "ruota i secret e ridispiega". Il rischio più ampio — una dipendenza npm compromessa che gira con i privilegi di `ubuntu` durante il build — resta un problema distinto (supply-chain), non coperto qui.

## Fase 22 — Vecchio server: non spegnerlo subito

Tieni il vecchio OVH (`51.83.47.109`) accendibile per qualche giorno come rete di sicurezza prima dello spegnimento definitivo — è la stessa macchina che ospita ancora MysteryInvestigation/TheKeeperArchive finché Server 2 non è pronto (vedi RUNBOOK_SERVER2.md), quindi non va comunque spento fino a quel momento.

---

## Non incluso qui, deliberatamente

- **Error tracking applicativo** (Sentry/GlitchTip) — direzione decisa in MIGRAZIONE-SERVER.md, non ancora un passo eseguibile: va agganciato a Winston/error handler per servizio, richiede prima la scelta del provider.
- **Provisioning come script versionato** — MIGRAZIONE-SERVER.md lo segna come TODO aperto ("script bash nel repo invece di rifare tutto a mano via SSH"). Questo runbook può servire da base per scriverlo, ma resta un documento, non automazione.
- **Alerting SMTP in uscita (porta 25)** — MIGRAZIONE-SERVER.md segnala di chiedere esplicitamente a OVH se SYS-1 ha la porta 25 sbloccata, prima di assumere che l'alerting via email funzioni.
