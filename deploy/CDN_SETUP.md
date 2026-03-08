# CDN Service - Setup & Deployment

## Architettura

L'upload delle immagini e gestito dall'**unified-backend** tramite il modulo CDN integrato (`CDNService`, `FTPSyncService`, `CDNController`).

Le immagini vengono salvate nel formato originale (JPEG, PNG, WebP, GIF) senza alcun processing server-side.
Il naming usa un hash SHA256 del contenuto (12 caratteri) per content-addressable storage.

### Sviluppo locale (Docker Compose)

```
Management UI (:4004)
    |
    | POST /admin/cdn/upload (multipart)
    v
API Gateway (:8000)
    |
    | proxy -> unified-backend:3001
    v
unified-backend (:3001)
    |
    | Salvataggio file originale
    v
/cdn-storage/ (Docker volume condiviso)
    |
    | express.static (api-gateway)
    v
GET http://localhost:8000/cdn/locations/{id}/{hash}.png
```

- Volume `cdn_storage` montato su unified-backend (RW) e api-gateway (RO)
- `CDN_FTP_ENABLED=false` - nessun FTP in locale
- Le immagini sono servite da api-gateway su `/cdn/*`

### Produzione (OVH VPS + Serverplan)

```
Management UI (gestione.tenpennynovels.com)
    |
    | POST /admin/cdn/upload
    v
unified-backend (OVH VPS :3001)
    |
    | Salvataggio locale + FTP sync
    v
/var/www/cdn-cache/ (cache locale OVH)
    |
    | FTP sync (basic-ftp con retry)
    v
Serverplan (hosting condiviso)
    |
    | Apache serve i file
    v
https://cdn.tenpennynovels.com/locations/{id}/{hash}.png
```

- OVH salva i file localmente come cache e li sincronizza via FTP su Serverplan
- `cdn.tenpennynovels.com` e servito da Serverplan (Apache)

## Struttura cartelle

```
/cdn-storage/ (locale) o /var/www/cdn-cache/ (OVH)
  locations/{locationId}/
    {hash}.png
    {hash}.jpg
    {hash}.webp
  items/{itemId}/
    {hash}.png
  characters/{characterId}/
    {hash}.jpg
```

Hash generato da SHA256 del contenuto file (12 char). Estensione originale preservata.

## Endpoint API

| Metodo | URL | Descrizione | Permesso |
|--------|-----|-------------|----------|
| POST | `/admin/cdn/upload` | Upload immagine (multipart: file + type + entityId) | `locations.update` |
| DELETE | `/admin/cdn/:type/:entityId/:filename` | Cancella immagine | `locations.update` |
| GET | `/admin/cdn/:type/:entityId` | Lista immagini per entita | `locations.read` |

### Upload - Request

```bash
curl -X POST https://api.tenpennynovels.com/admin/cdn/upload \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  -F "file=@image.png" \
  -F "type=locations" \
  -F "entityId=507f1f77bcf86cd799439011"
```

### Upload - Response

```json
{
  "result": true,
  "data": {
    "url": "https://cdn.tenpennynovels.com/locations/507f.../a1b2c3d4e5f6.png",
    "hash": "a1b2c3d4e5f6",
    "size": 933666
  },
  "message": "Immagine caricata con successo"
}
```

## Setup locale

Il setup locale funziona automaticamente con `docker compose up`. Il `docker-compose.yml` configura:

- Volume `cdn_storage` condiviso
- Variabili `CDN_STORAGE_PATH=/cdn-storage`, `CDN_BASE_URL=http://localhost:8000/cdn`, `CDN_FTP_ENABLED=false`
- api-gateway serve `/cdn/*` tramite `express.static`
- CORS CDN limitato a `GAME_URL` e `MANAGEMENT_URL`

## Setup produzione

### 1. Configurazione Serverplan

1. **Crea sottodominio `cdn.tenpennynovels.com`**:
   - Pannello Serverplan -> Domini -> Sottodomini
   - Punta a una directory dedicata (es. `/httpdocs/cdn/` o `/subdomains/cdn/`)
   - Annota il path root (serve per `CDN_FTP_BASE_PATH`)

2. **Abilita SSL**:
   - Pannello Serverplan -> SSL -> Let's Encrypt
   - Attiva per `cdn.tenpennynovels.com`

3. **Configura `.htaccess`** nella root del sottodominio:

```apache
<IfModule mod_headers.c>
    # CORS: solo game e gestionale possono caricare le immagini
    SetEnvIf Origin "https://game\.tenpennynovels\.com$" CORS_ORIGIN=$0
    SetEnvIf Origin "https://gestione\.tenpennynovels\.com$" CORS_ORIGIN=$0

    Header set Access-Control-Allow-Origin "%{CORS_ORIGIN}e" env=CORS_ORIGIN
    Header set Access-Control-Allow-Methods "GET, HEAD, OPTIONS" env=CORS_ORIGIN
    Header set Vary "Origin"

    Header set X-Content-Type-Options "nosniff"

    <FilesMatch "\.(webp|jpg|jpeg|png|gif)$">
        Header set Cache-Control "public, immutable, max-age=31536000"
    </FilesMatch>
</IfModule>

<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule /\. - [F,L]
</IfModule>

Options -Indexes
AddType image/webp .webp
```

4. **Crea credenziali FTP dedicate**:
   - Pannello Serverplan -> FTP -> Crea utente FTP
   - Utente: `cdn_upload`, path root: directory del sottodominio cdn
   - Password sicura (minimo 24 caratteri)

5. **Crea struttura cartelle iniziale** (via FTP o pannello):

```
mkdir locations
mkdir items
mkdir characters
```

### 2. Configurazione OVH VPS

1. **Variabili d'ambiente** (file `.env` unified-backend):

```bash
CDN_STORAGE_PATH=/var/www/cdn-cache
CDN_BASE_URL=https://cdn.tenpennynovels.com
CDN_FTP_ENABLED=true
CDN_FTP_HOST=ftp.tenpennynovels.com
CDN_FTP_PORT=21
CDN_FTP_USER=cdn_upload
CDN_FTP_PASSWORD=xxx
CDN_FTP_BASE_PATH=/
CDN_FTP_SECURE=true
```

2. **Crea directory cache locale**:

```bash
sudo mkdir -p /var/www/cdn-cache
sudo chown -R ubuntu:ubuntu /var/www/cdn-cache
```

3. **Variabili api-gateway** (file `.env` api-gateway):

```bash
# Percorso locale per servire file CDN come fallback
CDN_STORAGE_PATH=/var/www/cdn-cache
```

4. **Script di re-sync** (cron su OVH, ogni ora):

```bash
# /opt/scripts/cdn-resync.sh
lftp -u cdn_upload,PASSWORD ftp://ftp.tenpennynovels.com -e "
  mirror --reverse --only-newer /var/www/cdn-cache /
  exit
"
```

```bash
# Crontab
0 * * * * /opt/scripts/cdn-resync.sh >> /var/log/cdn-resync.log 2>&1
```

### 3. Test end-to-end

```bash
# Upload
curl -X POST https://api.tenpennynovels.com/admin/cdn/upload \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  -F "file=@test.jpg" \
  -F "type=locations" \
  -F "entityId=507f1f77bcf86cd799439011"

# Verifica su Serverplan
curl -I https://cdn.tenpennynovels.com/locations/507f.../HASH.jpg

# Verifica cache locale OVH
ls -la /var/www/cdn-cache/locations/507f.../
```

## File del progetto

| File | Descrizione |
|------|-------------|
| `services/unified-backend/src/modules/admin/services/CDNService.ts` | Storage locale, hash naming, validazione MIME |
| `services/unified-backend/src/modules/admin/services/FTPSyncService.ts` | Sync FTP condizionale verso Serverplan |
| `services/unified-backend/src/modules/admin/controllers/CDNController.ts` | Endpoint REST upload/delete/list |
| `services/unified-backend/src/modules/admin/routes/cdnRoutes.ts` | Route con permessi admin |
| `apps/management/src/components/shared/ImageUploader.tsx` | Componente drag-and-drop upload |
| `apps/management/src/lib/api/cdn.ts` | Client API per upload/delete/list |

## Variabili d'ambiente

| Variabile | Dove | Dev | Prod |
|-----------|------|-----|------|
| `CDN_STORAGE_PATH` | unified-backend, api-gateway | `/cdn-storage` | `/var/www/cdn-cache` |
| `CDN_BASE_URL` | unified-backend | `http://localhost:8000/cdn` | `https://cdn.tenpennynovels.com` |
| `CDN_FTP_ENABLED` | unified-backend | `false` | `true` |
| `CDN_FTP_HOST` | unified-backend | - | `ftp.tenpennynovels.com` |
| `CDN_FTP_PORT` | unified-backend | - | `21` |
| `CDN_FTP_USER` | unified-backend | - | `cdn_upload` |
| `CDN_FTP_PASSWORD` | unified-backend | - | `xxx` |
| `CDN_FTP_BASE_PATH` | unified-backend | - | `/` |
| `CDN_FTP_SECURE` | unified-backend | - | `true` |

## Troubleshooting

**Upload fallisce con "File too large"**: aumentare `MAX_FILE_SIZE` in `CDNController.ts` e `client_max_body_size` in Nginx (prod).

**FTP fallisce**: i file restano nella cache locale OVH. Lo script di re-sync (cron) ritenta automaticamente. Controllare i log: `tail -f /var/log/cdn-resync.log`.

**Immagine non visibile**: verificare che il volume `cdn_storage` sia montato correttamente su api-gateway (locale) o che l'FTP abbia caricato il file su Serverplan (prod).

**CORS errore in dev**: verificare che `GAME_URL` e `MANAGEMENT_URL` siano configurati correttamente in `docker-compose.yml` per l'api-gateway. Le origin CDN sono prese da queste variabili.
