# Migrazione server — piano e decisioni

> Documento di lavoro, non documentazione di prodotto. Riflette lo stato delle decisioni al 26/07/2026. Il runbook tecnico per il cutover DNS/CDN è un artifact separato (Cloudflare DNS & CDN — Runbook).

## Contesto

Oggi tutto (tenpennynovels.com + gennaropaglia.me + misteryinvestigation.it + thekeeperarchive.it) gira sulla stessa VPS OVH condivisa. Obiettivo: separare in due server dedicati.

L'hosting Serverplan scade il **18 agosto 2026** — è il trigger per chiudere le decisioni sotto.

> ⚠️ **Priorità immediata, separata dal resto**: per `tenpennynovels.com` dominio e hosting su Serverplan sono bundle, viaggiano insieme (confermato). Il 18 agosto non rischiate di perdere solo spazio hosting inutilizzato — rischiate di perdere **la registrazione del dominio stesso**. Questo va gestito a prescindere da come/quando si chiudono le altre decisioni (server 2, Cloudflare Registrar, ecc.). Vedi sequenza consigliata più sotto.
>
> **Downtime del sito accettabile** (non ancora aperto al pubblico) — ma attenzione: downtime e perdita del dominio sono due rischi diversi. Anche con DNS su Cloudflare, se la registrazione scade a Serverplan il dominio smette di essere vostro e il DNS altrove diventa irrilevante. Il limite del 18 agosto resta comunque.
>
> **Deciso**: andare dritti al trasferimento del registrar verso Cloudflare invece di rinnovare a Serverplan — un trasferimento riuscito estende la registrazione di un anno (regola ICANN), quindi se completato in tempo si evita anche il costo del rinnovo Serverplan. Codice di autorizzazione/EPP **già in mano** — nessuna attesa su Serverplan per quello, si parte direttamente dal passo 1 sotto.

---

## Server 1 — tenpennynovels

**Deciso: Kimsufi KS-5.**

| | |
|---|---|
| CPU | Intel Xeon-E3 1270 v6 (Kaby Lake, desktop-class) — 4c/8t, 3.8/4.2GHz |
| RAM | 32GB |
| Storage | 2×450GB |
| Banda | 300Mbps pubblica |
| Prezzo | €17.99/mese |

**Perché questo e non altri:**
- **KS-1** (Xeon-D 1520, Broadwell-DE, 2.2/2.6GHz) scartato: è un chip da microserver/NAS a bassa potenza, non da calcolo. Stessa categoria della CPU Haswell che oggi impiega 3+ minuti per una risposta Ollama a modello caldo — non avrebbe risolto il problema che ci ha portato a questa analisi.
- **KS-2** (Xeon-D 1540, 8c/16t) scartato per lo stesso motivo: più core, ma della stessa famiglia debole. L'inferenza scala poco oltre 4 thread su un modello 4B, quindi il vantaggio di più core non compensa.
- **KS-GAME** (i7-7700K, 4.2/4.5GHz, €36.99) scartato: CPU migliore in assoluto ma il doppio del prezzo per ~10% di clock in più. Rendimento marginale decrescente.
- **64GB RAM** (+€8/mese) scartata: botai/character-gen (gli altri due servizi AI del progetto) **non andranno mai in produzione** — confermato esplicitamente. Senza quel carico, 32GB lasciano ~15-17GB di margine reale anche con Ollama attivo (`qwen3:4b`, scelto anch'esso per adattarsi alle risorse disponibili).

**Da verificare prima dell'acquisto:**
- [ ] Backup Agent Kimsufi è gratuito, si paga solo l'Object Storage OVHcloud usato — dimensionarlo guardando i backup attuali (~300-600MB oggi, verosimilmente marginale)
- [ ] Stimare il picco di banda reale (asset statici, upload documenti) contro il limite di 300Mbps — mitigato comunque dal CDN, vedi sotto

**Non ancora fatto:** acquisto, setup OS, migrazione app, test di inferenza Ollama a modello caldo su hardware reale (l'unico test fatto finora, su Haswell, è stato inconcludente — interrotto per lentezza eccessiva).

---

## Server 2 — gennaropaglia.me / misteryinvestigation.it / thekeeperarchive.it

**Deciso: niente trasferimento dei domini attuali.** Sono progetti personali, non vale la pena rincorrere il trasferimento (comunque impossibile per i due `.it` su Cloudflare Registrar, vedi sezione sotto). Si registrano **nuovi domini `.com`** per ciascuno, direttamente su Cloudflare da subito. I vecchi domini restano dove sono e scadranno naturalmente, senza rinnovarli.

Da controllare prima di lasciarli scadere (non bloccante, ma da non dimenticare):
- [ ] Email attive su uno dei tre domini? Se sì, verificare che nessun account/servizio le usi per recupero password prima di perderle
- [ ] `thekeeperarchive.it`: ha servizi reali dietro (`keeper-bot`, `keeper-server`) — se ancora in uso, il cambio dominio richiede anche l'aggiornamento di eventuali webhook/callback/riferimenti hardcoded nel bot stesso, non solo il redirect del sito

### Ricognizione fatta il 26/07/2026 (SSH sulla VPS condivisa attuale)

Quanto segue è verificato sul server reale, non dedotto. Diversi punti correggono assunzioni fatte in questo documento prima di oggi.

**Risorse totali del box condiviso attuale**: 4 vCPU, 7.6GB RAM (in uso ~3.9GB, 3.6GB "available" via cache), swap 8GB (389MB usati). Questo è il carico di **tutti e 4** i progetti insieme — utile come riferimento per dimensionare sia server 1 che server 2.

**gennaropaglia.me** — confermato: **solo file statici** (`index.html`, `styles.css`, CV in pdf), nessun processo, nessun backend. La tua descrizione ("c'è discord-bot e server") si riferisce in realtà a `thekeeperarchive.it`, non a questo dominio — vedi sotto.

**thekeeperarchive.it**:
- Sito statico sul dominio principale (marketing page, ~44KB)
- `keeper-bot` (Discord bot, PM2, 41MB RAM, Node richiesto `>=22.13.0` per `engines` — **ma gira in produzione su v18.20.8**, violazione del proprio vincolo)
- `keeper-server` (riceve webhook dal bot, diario + audio-RAG, PM2, 26MB RAM, gira correttamente su v22.23.1)
- Due sottodomini nginx aggiuntivi: `bot.thekeeperarchive.it` (altro sito statico) e `poc.thekeeperarchive.it` (non ispezionato in dettaglio — verificare a cosa serve prima di migrarlo)
- Totale disco: ~420MB (perlopiù `node_modules`/dipendenze del bot e del server)
- Nessun Qdrant "dedicato" trovato: l'unica istanza Qdrant sul box è quella di TenPenny (collections `documents`, `document_chunks`, `forum_posts`, `location_actions`, `chats`, `chat_messages` — tutte con naming TenPenny). Se `keeper-server` usa un vector store, non è questo — verificare nel suo `.env`/codice prima di assumere che vada replicato su server 2.

**misteryinvestigation.it** — questo è realmente il più complesso, confermato:
- Backend Node **non gestito da PM2** ma da un unit systemd dedicato (`misteryinvestigation.service`), porta 3101, Node di sistema (non nvm-pinned)
- ⚠️ **Il file unit contiene segreti in chiaro** (`JWT_SECRET`, `DATABASE_PASSWORD`, `EMAIL_PASS`) dentro `/etc/systemd/system/misteryinvestigation.service` invece che in un `.env` caricato a runtime — da correggere in migrazione, non da replicare
- Database MongoDB dedicato (nome `misteryinvestigation`) sulla **stessa istanza mongod condivisa** con TenPenny — **484.5MB**, dati reali (non cruft)
- ⚠️ **MongoDB non ha autenticazione attiva** (`security.authorization` commentato in `mongod.conf`), la connection string è `mongodb://127.0.0.1:27017/...` senza credenziali — su un server pulito va abilitata, il che richiede creare l'utente Mongo e aggiornare la connection string in entrambi i progetti che condividono l'istanza (TenPenny e MysteryInvestigation), non è un flag gratis
- Frontend: build statica React da **1023MB** in `/var/www/misteryinvestigation.it/` — il grosso è `character_images/` e `audios/` (asset generati/caricati dagli utenti, non codice)
- File legacy nella cartella del progetto: `backupovh.sql` (290KB) e `importFromMySql.js` — tracce di una migrazione MySQL→Mongo già avvenuta in passato. Probabilmente morti, ma **da confermare con te** prima di deciderlo unilateralmente: se sono morti non vanno portati sul nuovo server
- Cron job dedicato: `0 6 * * * /home/ubuntu/rebootCharacterSheet.js` (reset giornaliero schede personaggio) — va migrato nel crontab del nuovo server 2
- Nginx: due `server{}` — uno per il sito (statico + `location /rm` con `autoindex on`, da rivedere: espone il filesystem) e uno per `server.misteryinvestigation.it` che fa da reverse proxy verso `localhost:3101` con supporto WebSocket

**Trovato ma non nella tua lista — `susannaantonelli.me`** (verificato: esiste solo `.me`, non `.it`): sito statico (~1.8MB, CV+portfolio PDF di terzi), certificato Let's Encrypt attivo, nginx configurato. **Deciso: si abbandona**, non va su nessuno dei due nuovi server.

**Cruft trovato sul box attuale — deciso: resta tutto indietro, non si migra nulla di questo**:
- `/home/ubuntu/chatgpt/myenv/`: virtualenv Python da **5GB**, non referenziato da nessun servizio/cron/nginx trovato — esperimento abbandonato
- Due container Docker Mongo mai avviati (`mongodb-container`, `my-mongodb`, creati 2 anni fa, stato "Created") — MongoDB reale gira nativo (`mongod.service`), questi due sono relitti
- Due systemd unit PM2 attivi in parallelo (`pm2-root.service` e `pm2-ubuntu.service`): il primo non ha nemmeno un processo registrato — cruft da un setup passato
- `backupovh.sql` e `importFromMySql.js` dentro il progetto MysteryInvestigation — relitti di una migrazione MySQL→Mongo già conclusa, non vanno portati sul server nuovo

### Dimensionamento server 2 — deciso: **VPS-1** (2 vCPU / 4GB RAM / 40GB NVMe, €4.65/mese)

Verificato oggi contro il listino ufficiale OVHcloud (VPS 2027): VPS-1 è il piano più piccolo disponibile.

**Perché basta, con numeri reali**: tolto tutto ciò che è di TenPenny (Next.js ×4, gateway, unified-backend, embeddings-worker, Qdrant, Elasticsearch, Redis — tutti carichi che restano su server 1), quello che deve girare su server 2 è: `mongod` (183MB RSS oggi, ma con **solo** il db `misteryinvestigation` a bordo sarà più leggero), il backend Node di MysteryInvestigation (64MB RSS), `keeper-bot` (41MB) + `keeper-server` (26MB), nginx (~50MB tra i worker) e i siti statici. Somma abbondante oggi: **< 400MB**. 4GB di RAM lasciano margine ampio anche per backup automatici, build occasionali e crescita del DB. Storage: il footprint attuale delle 3 cose insieme (misteryinvestigation ~2.3GB inclusi asset, thekeeperarchive ~420MB, gennaropaglia e susannaantonelli irrisori) sta comodo nei 40GB NVMe.

**Da verificare prima dell'acquisto**: VPS-1 include "backup automatico giornaliero" secondo il listino — bene, ma verificare cosa copre esattamente (intera VM o solo alcuni path) prima di considerarlo sufficiente come unica strategia di backup per il DB di MysteryInvestigation.

---

## Piano di migrazione — server 2

Ordine consigliato: prima le cose semplici (basso rischio, validano il nuovo server), poi MysteryInvestigation per ultimo (unico con downtime/dati reali in gioco).

### 1. gennaropaglia.me e susannaantonelli.me (se confermato che restano)

Copia file statici + config nginx + certificato Let's Encrypt nuovo (il certificato attuale non è trasferibile, va riemesso sul nuovo dominio/IP). Nessun processo, nessun rollback complesso: se qualcosa non torna, il vecchio server resta lì finché non si spegne il DNS.

### 2. thekeeperarchive.it

**Nota su un possibile equivoco**: `keeper-bot` non è un processo duplicato rispetto a `discord-bot` — è lo stesso identico servizio. `keeper-bot` è solo il *nome* con cui PM2 lo registra; la cartella sorgente è `poc/discord-bot`. `keeper-server` gira da `poc/server`. Un bot solo, due nomi diversi (PM2 vs filesystem) — confusione cosmetica ma reale, da eliminare nel rifacimento pulito rinominando il processo PM2 in modo che corrisponda alla cartella (es. `keeper-discord-bot`).

- [ ] Chiarire prima cosa serve `poc.thekeeperarchive.it` (non ispezionato) — potrebbe non dover essere migrato
- [ ] Rinominare il processo PM2 `keeper-bot` → qualcosa coerente con `poc/discord-bot`, per chiudere l'ambiguità nome-processo/nome-cartella
- [ ] Node **v24.18.0** per entrambi (vedi decisione unificata sotto: stessa versione su tutti e due i server nuovi) — installarla via nvm e pinnarla esplicitamente in PM2, non lasciarla alla versione di default della shell
- [ ] Copiare `.env` di entrambi (token Discord, eventuali chiavi LLM/API, URL webhook) — **rigenerare** i secret che è ragionevole rigenerare invece di riusare quelli vecchi, specie se il bot Discord ha un token esposto in qualche log
- [ ] Verificare cosa usa `keeper-server` come vector store/RAG (il documento precedente assumeva "Qdrant dedicato": non trovato sul box attuale, verificare nel codice prima di provisionare qualcosa che potrebbe non servire)
- [ ] DNS + certificati per `thekeeperarchive.it` e i suoi sottodomini

### 3. misteryinvestigation.it — l'unica migrazione con dati reali e downtime da pianificare

**Ordine consigliato (minimizza il tempo di stop):**

**Deciso: lavoro pulito, non un lift-and-shift.** Si porta il codice e i dati reali (DB, asset utente), non gli artefatti operativi del vecchio setup (secret in chiaro nel file unit, `no-auth` su Mongo, relitti di migrazioni passate).

1. Provisionare il nuovo server 2, installare Node **v24.18.0** via nvm (stessa versione unificata di tutto il resto, vedi sotto — soddisfa comunque qualsiasi vincolo `engines` più basso), MongoDB nuovo con **autenticazione attiva da subito** (non replicare il "no auth" attuale)
2. Deploy del codice (`backend/`, build del `frontend/`) e degli asset statici via `rsync` (`character_images/`, `audios/` — ~1GB, farlo **prima** del cutover finale così il grosso del trasferimento non è nella finestra di downtime)
3. Dump a caldo del DB (`mongodump --db misteryinvestigation`) senza fermare nulla, restore sul nuovo Mongo con utente/password dedicati, verifica dei conteggi documenti per collection contro l'originale
4. Riscrivere il servizio come systemd unit **con un `.env` separato** (permessi `600`) invece dei secret in chiaro nel file `.service` — parte del "lavoro pulito", non opzionale
5. **Non portare** `backupovh.sql` / `importFromMySql.js` — deciso: sono relitti di una migrazione già conclusa
6. Rivedere `location /rm { autoindex on; }` in nginx — espone il filesystem, verificare se è voluto o un residuo di debug prima di riportarlo tale e quale
7. Migrare il cron `rebootCharacterSheet.js` (giornaliero, 06:00) sul nuovo crontab
8. **Finestra di downtime reale**: fermare il vecchio servizio, fare un secondo `mongodump`/`mongorestore` incrementale (solo il delta da quando è partito il primo dump) o direttamente lo stop-and-copy se il DB è abbastanza piccolo da farlo in pochi minuti (484MB → probabilmente sotto i 2-3 minuti con `mongodump`/`mongorestore` in locale), poi switch DNS
9. Tenere il vecchio server accendibile per qualche giorno come rete di sicurezza prima di spegnerlo definitivamente

**Non bloccante ma da non perdere di vista**: email `info@misteryinvestigation.it` (usata come `EMAIL_USER` nel backend) — verificare come viene inviata oggi (SMTP di chi?) prima di assumere che funzioni automaticamente sul nuovo IP (molti provider SMTP fanno whitelisting per IP).

---

## Server 1 — ricostruzione pulita di TenPenny

### Cosa emerge dalla ricognizione di oggi (26/07/2026) da correggere nel rifacimento, non da replicare

- ✅ **Elasticsearch confermato: uso reale, non un residuo.** Verificato nel codice (non solo nel `package.json`): `embedding-worker.ts` ed `EmbeddingsHttpServer.ts` scrivono ogni chunk/messaggio/post moderato su **MongoDB + Qdrant + Elasticsearch** in parallelo (`elasticsearch.index(...)` su `document_chunks`, `forum_posts`, `chat_messages`), e `EmbeddingsHttpServer.ts` fa query di `.search()` su quegli stessi indici per servire ricerca full-text/keyword in complemento alla ricerca semantica di Qdrant. È un'architettura di ricerca ibrida vera e propria, semplicemente **non documentata**. Decisione: **va provisionato su server 1**, non abbandonato. Azione collegata (fuori da questo documento): aggiornare `20-backend.md`/`30-ai-services.md` per documentarlo — è esattamente il tipo di gap che le rules del progetto chiedono di colmare quando scoperto.
- ✅ **Node: deciso, v24.18.0 ovunque.** `.nvmrc` dichiara v24.18.0 come source of truth ma PM2 oggi esegue tutte le app TenPenny su v22.13.1 (verificato via `pm2 jlist`) — drift reale, esattamente il tipo che la regola 6 di `00-critical.md` esiste per prevenire. Sul rifacimento si chiude il drift installando **un'unica versione, v24.18.0, su entrambi i server nuovi** (server 1 per TenPenny, server 2 anche per keeper-bot/keeper-server che richiedono solo `>=22.13.0` — v24 lo soddisfa, un'unica versione da mantenere invece di due).
- ✅ **MongoDB: autenticazione obbligatoria, non rimandabile.** `mongod.conf` ha `security.authorization` commentato, connection string senza credenziali, su **entrambi** i database (TenPenny e MysteryInvestigation). Va abilitata da subito in fase di setup su entrambi i server nuovi.
- Cruft operativo da non riportare (deciso: resta tutto sul vecchio server): doppio unit systemd PM2 (`pm2-root` orfano oltre a `pm2-ubuntu`), due container Docker Mongo mai avviati, una virtualenv Python da 5GB non referenziata da nulla.

### Gestore di processi: PM2 confermato, con correzioni — non serve cambiarlo

Hai chiesto se una configurazione diversa da PM2 sia più adatta al carico a coda di un server dedicato. Risposta diretta: **no evidenza che serva cambiare**, e i problemi reali trovati oggi non sono causati da PM2 — sono causati da come viene operato.

- **botai e character-gen non sono in produzione** (confermato: non compaiono nella `pm2 list` attuale, coerente con la nota già presente in questo documento che non andranno mai in produzione). Quindi la "coda" che conta operativamente oggi è quella di Bull dentro `embeddings-worker` (I/O-bound: chiamate a Qdrant/Mongo/subprocess Python, concorrenza 5) — non è un carico che PM2 gestisce direttamente, PM2 supervisiona solo il processo Node che la contiene.
- **Ollama non è e non sarà un processo PM2**: va installato con il proprio installer, che crea un systemd unit dedicato (`ollama.service`). Questo resta vero a prescindere dalla scelta fatta per i 7 servizi Node — non è in competizione con PM2.
- **systemd puro** perderebbe la cluster mode di `api-gateway` (×2 istanze) e il modulo `pm2-logrotate` già in uso, per un guadagno che sul carico osservato (nessun servizio è mai sopra pochi punti percentuale di CPU nella ricognizione di oggi) non si materializza.
- **Docker Compose per tutti i servizi Node** risolverebbe strutturalmente il problema del version drift (l'immagine pinna la versione di Node, indipendentemente da quale nvm sia attivo sulla shell di chi deploya) ma è un cambio di architettura di deploy più grande di quanto la migrazione richieda — oggi solo Qdrant/Redis/AI sono containerizzati, i servizi Node si buildano ed eseguono sull'host. Vale la pena **solo se** si decide comunque di rivedere la pipeline di deploy; non introdurlo come effetto collaterale della sola migrazione di server.

**Correzioni concrete da applicare sul server pulito, mantenendo PM2:**
- [ ] Installare **una sola** versione Node via nvm (quella scelta come reale, aggiornando `.nvmrc` se si conferma v22 o correggendo il deploy se si conferma v24 — va deciso quale dei due è quello "giusto", oggi divergono)
- [ ] Pinnare la versione nell'`ecosystem.config.js` con `interpreter: '/home/ubuntu/.nvm/versions/node/vX.Y.Z/bin/node'` esplicito invece di affidarsi al `PATH` al momento del deploy — è la causa diretta del drift trovato oggi
- [ ] `pm2 startup` una sola volta per l'utente `ubuntu`, verificare che non esista un secondo unit systemd PM2 duplicato
- [ ] Redis e MongoDB restano servizi nativi (systemd), coerente con l'uso attuale; Qdrant resta in Docker

### Logging, rotazione e alerting — setup "a bomba", da fare sul server nuovo

Verificato lo stato reale sul box condiviso attuale (26/07/2026) prima di proporre qualcosa, perché alcune cose sono già a posto e non vanno reinventate.

**Rotazione — stato attuale e cosa replicare/correggere:**

| Log | Stato oggi | Azione sul server nuovo |
|---|---|---|
| PM2 (`pm2-logrotate`) | OK: 10MB/file, retain 7, compresso, rotazione giornaliera | Replicare la stessa config |
| nginx | OK: `logrotate.d`, retain 14, compresso | Replicare |
| MongoDB | ❌ **Nessuna rotazione**, log già a 107MB e in crescita senza limite | Aggiungere stanza `logrotate.d` con `copytruncate` o (meglio) `postrotate` che invia `SIGUSR1` a `mongod` per il reopen del file — verificare `systemLog.logRotate` in `mongod.conf` |
| Elasticsearch | Non verificato (config log4j2 non trovata in questa ricognizione) | Da controllare esplicitamente in fase di setup, non assumere che il pacchetto la gestisca da solo |

**Alerting via email sugli errori — è possibile, ma non va replicato lo script attuale.** Esiste già un prototipo (`log-monitoring.sh`, cron ogni minuto, solo per MysteryInvestigation): grep di `LOGGER_ERROR`, hash per rilevare novità, invio con `mail` se cambia. Funziona ma è fragile — confronto di date con string comparison, nessun rate-limit reale (un bug che produce errori leggermente diversi tra loro in loop manda un'email per ciascuno). Non copre nessun servizio TenPenny (che usano Winston).

**Deciso come direzione, da implementare al momento del setup**: per gli errori applicativi TenPenny, usare un error tracker vero (Sentry, o GlitchTip self-hosted/gratuito, compatibile con l'SDK Sentry) invece di grep-su-file — raggruppa automaticamente occorrenze identiche in un solo alert (risolve da solo il problema dello spam da loop di errori) e manda l'email solo alla prima occorrenza di un errore nuovo. Integrazione: pochi punti di aggancio su Winston/error handler per servizio.

**⚠️ Dipendenza da verificare prima di dare per scontato che l'alerting funzioni**: l'invio email sul box attuale passa da un relay SMTP esterno (`mail.misteryinvestigation.it` in `postconf`), non invio diretto. Molti hosting bloccano di default la porta 25 in uscita su IP dedicati nuovi per anti-spam — **da chiedere esplicitamente a OVH se il KS-5 nuovo (e il VPS-1 di server 2) avranno la 25 sbloccata**, altrimenti l'alerting non parte silenziosamente. In alternativa, usare un provider transazionale (Postmark/SES/Mailgun) invece di Postfix diretto — più affidabile e non dipende da un dominio (`misteryinvestigation.it`) che con questa stessa migrazione è destinato ad essere abbandonato.

### Hardening — verificato sul server attuale il 26/07/2026, da correggere sui server nuovi

Non un elenco teorico: sono problemi reali trovati sul box condiviso oggi. Vale per **entrambi** i server nuovi, non solo per server 1.

**Da correggere (trovati attivi/insufficienti oggi):**
- 🔴 **Confermato, non ipotetico: SSH accetta login via password.** `sshd_config.d/50-cloud-init.conf` ha `PasswordAuthentication yes`, `60-cloudimg-settings.conf` ha `no` — file in conflitto, e la verifica con `sshd -T | grep passwordauthentication` conferma che vince il primo: **`passwordauthentication yes` è la config effettiva in produzione oggi**. Combinato col punto sotto (fail2ban spento), il server è realmente esposto a brute-force SSH in questo momento. Priorità massima sul server nuovo: un solo file di config autorevole, `PasswordAuthentication no`, solo chiavi.
- 🔴 **fail2ban installato ma non in esecuzione** — zero protezione brute-force su SSH oggi nonostante il pacchetto sia presente. Da abilitare e configurare (jail sshd come minimo) — ancora più urgente visto il punto sopra.
- ⚠️ **Qdrant pubblicato su `0.0.0.0:6333/6334`** via docker-proxy, non su `127.0.0.1`. `ufw` è attivo e in teoria lascia passare solo 22/80/443, ma Docker è noto per bypassare ufw inserendo le proprie regole iptables nella catena `DOCKER` prima che ufw le processi, per le porte pubblicate dai container — non dare per scontato che il firewall stia davvero proteggendo questa porta. Verificare dall'esterno con un test reale; fix robusta indipendente dal firewall: pubblicare i container solo su `127.0.0.1:PORT:PORT`, mai su tutte le interfacce, per Qdrant/Redis/Elasticsearch/Mongo. **Stesso controllo da fare su Ollama quando verrà installato sul KS-5**: il suo installer di default lega l'API a `127.0.0.1:11434`, ma va verificato esplicitamente e non assunto — è lo stesso tipo di errore.
- ⚠️ **Redis senza password** (`requirepass` non impostato in `redis.conf`) — è su localhost quindi il rischio reale è limitato a chi ha già accesso alla macchina, ma contiene dati di sessione: aggiungerla è a costo zero, difesa in profondità.
- ⚠️ **vsftpd attivo** — se non è realmente usato per qualcosa di specifico, va eliminato (SFTP via SSH copre lo stesso bisogno, cifrato, senza un servizio in più da mantenere)
- ⚠️ **Pannello di gestione (`gestione.tenpennynovels.com`) senza restrizione di rete**: nessuna allowlist IP, nessun basic auth a livello nginx — solo l'auth applicativa (JWT + `isGestore`, già presente). Non è un buco (l'auth applicativa c'è), ma per uno strumento admin un secondo strato (allowlist IP o VPN) è prassi normale e qui manca del tutto — valutare sul server nuovo.
- Certbot rinnova **due volte**: systemd timer moderno (funziona, verificato) + una vecchia riga in crontab (`0 0 * * * certbot renew --quiet`) rimasta da un setup precedente — innocuo ma ridondante, sul server nuovo tenere solo il timer.
- `server_tokens off;` commentato in nginx — banale, versione nginx esposta in header/pagine di errore

**Già a posto oggi — da replicare identici, non da reinventare:**
- `unattended-upgrades` configurato e attivo
- `ulimit` di mongod già a 64000 file descriptor
- swapfile presente (8GB sul box attuale; su KS-5 con 32GB RAM ne basta uno più piccolo, 4-8GB, come rete di sicurezza OOM)

**Da pianificare, non verificabile sul box attuale:**
- [ ] MongoDB: quando si abilita l'auth (deciso sopra), usare un **utente applicativo con ruolo `readWrite` scoped al proprio DB**, non un utente admin/superuser nella connection string
- [ ] Backup applicativo reale oltre allo snapshot del Backup Agent: `mongodump` schedulato verso storage separato, con **almeno un restore testato** — un backup mai ripristinato non è verificato
- [x] ~~Monitoraggio esterno di uptime~~ — **deciso**: dato che i due server sono fisicamente indipendenti, il monitor va su **server 2 (VPS-1)** e controlla server 1 dall'esterno (mai il contrario: un monitor sullo stesso server che deve sorvegliare è inutile proprio quando serve di più). Strumento: **Uptime Kuma** (self-hosted, un container Docker su VPS-1) — fa da monitor *e* da status page pubblica in un solo tool: pinga `api.tenpennynovels.com/health`, `ws.tenpennynovels.com/health` ecc., espone `status.tenpennynovels.com` (DNS + certificato propri su server 2, indipendenti da server 1), notifica via email/webhook sui fallimenti. Copre il caso "server 1 irraggiungibile", che un error tracker applicativo come Sentry/GlitchTip non vede. Limite onesto: se cade server 2, cade anche il monitor — nessun sistema monitora sé stesso; per eliminare pure questo punto cieco servirebbe un check esterno terzo (es. UptimeRobot free tier su entrambi gli endpoint), opzionale, costo zero se si vuole aggiungere
- [ ] Alert su spazio disco basso — motivato direttamente dal log Mongo trovato senza rotazione: se ricapita e il disco si riempie, tutto si blocca silenziosamente
- [ ] Scrivere il provisioning come **script versionato nel repo** (anche solo bash, non serve Ansible) invece di rifare tutto a mano via SSH — è l'unico modo per garantire che i due server nuovi abbiano davvero la stessa postura di sicurezza, ed è documentazione vivente invece che conoscenza tribale

### Riepilogo infrastruttura server 1 dopo il rifacimento

| Componente | Come gira | Note |
|---|---|---|
| 4 app Next.js + api-gateway + unified-backend + embeddings-worker | PM2 (fork/cluster come oggi), Node pinnato esplicitamente | vedi correzioni sopra |
| MongoDB | systemd nativo | **auth attiva da subito** |
| Redis | systemd nativo | come oggi |
| Qdrant | Docker | come oggi |
| Elasticsearch | **da provisionare** (nativo o Docker, da scegliere in fase di setup) | confermato uso reale in dual-write con Qdrant, vedi sopra — non è un residuo |
| Ollama | systemd nativo (installer ufficiale) | non è mai stato un processo PM2 |

---

## Domini — registrazione e DNS

### Stato attuale confermato

Tutti e 4 i domini risolvono già verso l'IP della VPS OVH attuale (`51.83.47.109`) — nessuno è realmente servito da Serverplan oggi.

| Dominio | Registrazione | Hosting | Nameserver attuali |
|---|---|---|---|
| tenpennynovels.com | Serverplan | Serverplan (piano "hosting condiviso", **inutilizzato** — il sito gira su OVH) | ns1/ns2.cmshigh.com |
| misteryinvestigation.it | Serverplan | — (tutto su OVH) | ns1-3.dns4userver.com |
| thekeeperarchive.it | Serverplan | — (tutto su OVH) | ns1/ns2.register.it |
| gennaropaglia.me | Serverplan | — (tutto su OVH) | ns1/ns2.register.it |

### Checklist prima del 18 agosto

- [ ] Verificare se `privacy@tenpennynovels.com` (o altre caselle sul dominio) sono ospitate sull'hosting Serverplan — se sì, migrarle (Workspace/Zoho/forwarding) **prima** di toccare il piano
- [ ] Esportare/fotografare la zona DNS attuale di tenpennynovels.com su Serverplan (record A, MX, TXT) come backup
- [x] ~~Confermare se il 18 agosto è la scadenza solo dell'hosting o anche della registrazione del dominio~~ — **confermato: sono bundle, viaggiano insieme**
- [ ] Aggiungere tenpennynovels.com a Cloudflare, cambiare nameserver
- [ ] Avviare transfer-in della registrazione su Cloudflare Registrar (codice EPP già disponibile)
- [ ] Checkpoint 8-10 agosto: se il transfer non è concluso, rinnovo/declassamento di sicurezza a Serverplan
- [ ] Declassare anche gli altri 3 domini a "solo registrazione" su Serverplan (nessun hosting reale in uso lì, meno urgente perché lì hosting e dominio non erano bundle)

### La domanda di oggi: spostare la registrazione su Cloudflare Registrar?

Verificato ora contro la lista ufficiale dei TLD supportati (cloudflare.com/tld-policies):

| TLD | Supportato da Cloudflare Registrar? |
|---|---|
| `.com` (tenpennynovels.com) | ✅ Sì |
| `.me` (gennaropaglia.me) | ✅ Sì |
| `.it` (misteryinvestigation.it, thekeeperarchive.it) | ❌ **No** — non è nella lista TLD di Cloudflare |

**Quindi:** i due `.it` restano dove sono per forza (Serverplan o altro registrar che supporti `.it` — es. Register.it, che già gestisce i nameserver di due di questi domini). Non è una scelta, è un limite del servizio.

`gennaropaglia.me` non è più rilevante per questa tabella: si abbandona insieme a misteryinvestigation.it e thekeeperarchive.it, sostituito da un nuovo `.com` (vedi sezione Server 2 sopra). Resta solo `tenpennynovels.com`, per cui il trasferimento a Cloudflare Registrar è tecnicamente possibile. **Vale la pena farlo?**

**Pro:**
- Prezzo "at cost" (nessun markup, a differenza della maggior parte dei registrar) — niente trappole tipo primo anno scontato poi rinnovo caro
- Privacy WHOIS inclusa di default, gratis
- Un solo pannello per DNS + registrazione, se comunque si sposta lì il DNS di tenpennynovels.com per il CDN (vedi runbook separato)

**Contro / attenzioni:**
- Il trasferimento richiede che il dominio sia **già** su Cloudflare DNS prima di poter avviare il transfer-in della registrazione (sequenza: prima DNS, poi registrar — non il contrario)
- Tempi tipici di trasferimento: 5-7 giorni lavorativi, a volte di più se il registrar cedente rallenta o serve recuperare il codice EPP/auth
- Se il dominio è stato trasferito o rinnovato negli ultimi 60 giorni, ICANN blocca un nuovo trasferimento — da controllare caso per caso

**Sequenza decisa** (codice EPP/auth già disponibile, quindi si salta l'attesa su Serverplan):

1. **Ora**: aggiungere tenpennynovels.com a Cloudflare, cambiare i nameserver lì (stesso passo già necessario per il CDN — vedi runbook)
2. **Appena il DNS risulta attivo su Cloudflare** (in genere ore): avviare il transfer-in della registrazione con il codice EPP già in mano
3. **Checkpoint di sicurezza all'8-10 agosto**: se il trasferimento non si è ancora concluso, rinnovo/declassamento veloce a Serverplan come rete di sicurezza — resta comunque una settimana di margine prima della scadenza reale

**Stato (26/07)**: dominio aggiunto a Cloudflare, record DNS verificati e completati (aggiunti `documenti` e `gestione`, mancanti dallo scan automatico), tenuto tutto "DNS only" di proposito. Cambio nameserver richiesto via ticket Serverplan (non self-service per domini con hosting bundle) — in attesa di conferma.

`gennaropaglia.me` e i due `.it` restano fuori dal runbook CDN (girano/gireranno su "server 2", non hanno bisogno del trattamento riservato a tenpennynovels.com).

---

## Riepilogo decisioni aperte

1. **Urgente**: conferma cambio nameserver da Serverplan (ticket aperto) → transfer-in registrar appena "Active" su Cloudflare (EPP già in mano) → checkpoint 8-10 agosto con rinnovo Serverplan come rete di sicurezza se serve
2. Verificare mailbox `@tenpennynovels.com` su Serverplan prima di lasciare andare l'hosting lì (confermato attivo: MX, SPF, DKIM, CalDAV/CardDAV)
3. Verificare email/dipendenze su misteryinvestigation.it, thekeeperarchive.it, gennaropaglia.me prima di lasciarli scadere
4. thekeeperarchive.it: se il bot è ancora in uso, aggiornare webhook/callback prima del cambio dominio
5. ~~Server 2: dimensionamento~~ — **deciso: VPS-1** (2 vCPU/4GB/40GB, €4.65/mese), vedi sezione dedicata con i numeri della ricognizione del 26/07
6. ~~`susannaantonelli.me` trovato sul server condiviso~~ — **deciso: si abbandona**, non esiste una `.it` corrispondente (verificato)
7. ~~Elasticsearch, dual-write con Qdrant~~ — **deciso: uso reale confermato nel codice, va provisionato su server 1** e documentato in `20-backend.md`/`30-ai-services.md` (gap da chiudere, non feature da eliminare)
8. ~~Node: v22.13.1 in produzione vs v24.18.0 in `.nvmrc`~~ — **deciso: v24.18.0 ovunque**, su entrambi i server nuovi (soddisfa anche il vincolo `>=22.13.0` di keeper-bot/keeper-server)
9. ~~`backupovh.sql`/`importFromMySql.js`~~ — **deciso: non si portano**, relitti di una migrazione conclusa
10. ~~MongoDB senza autenticazione~~ — **deciso: auth obbligatoria su entrambi i database/server nuovi**, non rimandabile
11. **Ancora aperto**: rinominare il processo PM2 `keeper-bot` per farlo coincidere con la cartella sorgente `poc/discord-bot` (non è un duplicato, solo un nome disallineato — chiarito il 26/07)
12. **Ancora aperto**: cosa serve `poc.thekeeperarchive.it` — non ancora ispezionato, verificare prima di decidere se migrarlo
