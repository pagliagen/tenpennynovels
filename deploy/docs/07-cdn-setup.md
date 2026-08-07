# CDN Service - Setup & Deployment

> **Aggiornato 01/08/2026**: rimossa la sync FTP verso Serverplan (`FTPSyncService`, dipendenza `basic-ftp`, `CDN_FTP_*`). Le immagini vengono servite direttamente dalla VPS OVH — vedi "Architettura" e "Setup produzione" sotto. Il server OVH attuale è in corso di migrazione verso un nuovo host (in attesa di risposta OVH): la sezione "Setup produzione" descrive la configurazione **target**, da applicare quando il nuovo server viene provisionato/riconfigurato, non lo stato del vecchio server condiviso.

## Architettura

L'upload delle immagini e gestito dall'**unified-backend** tramite il modulo CDN integrato (`CDNService`, `CDNController`).

Le immagini vengono salvate nel formato originale (JPEG, PNG, WebP, GIF) senza alcun processing server-side.
Il naming usa un hash SHA256 del contenuto (12 caratteri) per content-addressable storage.

### Sviluppo locale (Docker Compose)

```
Management UI (:4003)
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

### Produzione (OVH VPS, serving diretto)

```
Management UI (gestione.tenpennynovels.com)
    |
    | POST /admin/cdn/upload
    v
unified-backend (OVH VPS :3001)
    |
    | Salvataggio locale
    v
/var/www/cdn-cache/ (storage reale, non piu' "cache")
    |
    | nginx serve /var/www/cdn-cache/ come document root
    v
https://cdn.tenpennynovels.com/locations/{id}/{hash}.png
    |
    | proxy Cloudflare (orange cloud) davanti a cdn.*
    v
edge cache Cloudflare (contenuto immutabile/content-addressed: candidato ideale per "cache everything")
```

- OVH salva i file localmente in `/var/www/cdn-cache/` ed e' l'unica copia (nessuna sync verso Serverplan)
- `cdn.tenpennynovels.com` e' servito direttamente da nginx sulla stessa VPS OVH dell'app
- Consigliato: `cdn.tenpennynovels.com` dietro proxy Cloudflare (orange cloud), a differenza degli altri sottodomini che restano DNS-only finche' non si completa il rollout (vedi `MIGRAZIONE-SERVER.md`) — riduce il traffico verso l'origin quasi a zero dopo il warm-up
- Backup: coperto dal backup automatico della VPS OVH, stesso meccanismo usato per MongoDB — nessuna copia ridondante dedicata

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
- Variabili `CDN_STORAGE_PATH=/cdn-storage`, `CDN_BASE_URL=http://localhost:8000/cdn`
- api-gateway serve `/cdn/*` tramite `express.static`
- CORS CDN limitato a `GAME_URL` e `MANAGEMENT_URL`

## Setup produzione (target — da applicare sul nuovo server OVH quando provisionato)

> Il server OVH attuale sta per essere sostituito da OVH con uno nuovo (migrazione in corso, in attesa di conferma). Questi passi vanno eseguiti da zero sul server nuovo, non sono ancora applicati oggi.

### 1. Directory di storage

```bash
sudo mkdir -p /var/www/cdn-cache/{locations,items,characters,occupations}
sudo chown -R ubuntu:ubuntu /var/www/cdn-cache
```

### 2. Variabili d'ambiente (file `.env` unified-backend)

```bash
CDN_STORAGE_PATH=/var/www/cdn-cache
CDN_BASE_URL=https://cdn.tenpennynovels.com
```

Nessuna variabile `CDN_FTP_*`: rimossa insieme al codice il 01/08/2026 (era la sync verso Serverplan, non più in uso).

### 3. Configurazione nginx — nuovo `server{}` block per `cdn.tenpennynovels.com`

Equivalente delle regole che erano nell'`.htaccess` Serverplan (CORS scoped a game/gestione, cache immutabile, niente directory listing):

```nginx
server {
    listen 443 ssl;
    server_name cdn.tenpennynovels.com;

    root /var/www/cdn-cache;
    autoindex off;

    # SSL gestito da certbot (vedi 40-workflow.md per il rinnovo dietro proxy Cloudflare)

    location ~ \.(webp|jpg|jpeg|png|gif)$ {
        # NIENTE "always" su Cache-Control: marchierebbe immutabile-1-anno
        # anche un 404 (file non ancora esistente/cancellato), e Cloudflare
        # lo terrebbe in cache per un anno — bug reale trovato il 07/08/2026
        # nel vhost live, vedi RUNBOOK_SERVER1.md Fase 13.
        add_header Cache-Control "public, immutable, max-age=31536000";
        add_header X-Content-Type-Options "nosniff" always;

        set $cors_origin "";
        if ($http_origin ~* ^https://(game|gestione)\.tenpennynovels\.com$) {
            set $cors_origin $http_origin;
        }
        add_header Access-Control-Allow-Origin $cors_origin always;
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;
        add_header Vary "Origin" always;

        try_files $uri =404;
    }

    location / {
        return 404;
    }
}
```

### 4. DNS

A record `cdn` -> IP del nuovo server OVH (sostituisce il vecchio puntamento a Serverplan). Consigliato attivare da subito il proxy Cloudflare (orange cloud) solo su questo sottodominio — contenuto content-addressed/immutabile, candidato ideale per l'edge cache (vedi `MIGRAZIONE-SERVER.md`, punto 13 del riepilogo).

### 5. Test end-to-end

```bash
# Upload
curl -X POST https://api.tenpennynovels.com/admin/cdn/upload \
  -H "Cookie: auth_token=YOUR_TOKEN" \
  -F "file=@test.jpg" \
  -F "type=locations" \
  -F "entityId=507f1f77bcf86cd799439011"

# Verifica servita da nginx sulla stessa VPS
curl -I https://cdn.tenpennynovels.com/locations/507f.../HASH.jpg

# Verifica file locale
ls -la /var/www/cdn-cache/locations/507f.../
```

## File del progetto

| File | Descrizione |
|------|-------------|
| `services/unified-backend/src/modules/admin/services/CDNService.ts` | Storage locale, hash naming, validazione MIME |
| `services/unified-backend/src/modules/admin/controllers/CDNController.ts` | Endpoint REST upload/delete/list |
| `services/unified-backend/src/modules/admin/routes/cdnRoutes.ts` | Route con permessi admin |
| `apps/management/src/components/shared/ImageUploader.tsx` | Componente drag-and-drop upload |
| `apps/management/src/lib/api/cdn.ts` | Client API per upload/delete/list |

## Variabili d'ambiente

| Variabile | Dove | Dev | Prod |
|-----------|------|-----|------|
| `CDN_STORAGE_PATH` | unified-backend, api-gateway | `/cdn-storage` | `/var/www/cdn-cache` |
| `CDN_BASE_URL` | unified-backend | `http://localhost:8000/cdn` | `https://cdn.tenpennynovels.com` |

## Troubleshooting

**Upload fallisce con "File too large"**: aumentare `MAX_FILE_SIZE` in `CDNController.ts` e `client_max_body_size` in Nginx (prod).

**Immagine non visibile**: verificare che il volume `cdn_storage` sia montato correttamente su api-gateway (locale) o che nginx punti alla root corretta e abbia i permessi su `/var/www/cdn-cache` (prod).

**CORS errore in dev**: verificare che `GAME_URL` e `MANAGEMENT_URL` siano configurati correttamente in `docker-compose.yml` per l'api-gateway. Le origin CDN sono prese da queste variabili.
