# Environment Variable Templates

Template files per `.env.production` di tutti i servizi e app.

---

## 📋 Files

| Template | Target | Description |
|----------|--------|-------------|
| `landing.env` | `apps/landing/.env.production` | Landing page app |
| `game.env` | `apps/game/.env.production` | Game app (include WS_URL) |
| `documents.env` | `apps/documents/.env.production` | Documents app |
| `management.env` | `apps/management/.env.production` | Management panel (include WS_URL) |
| `api-gateway.env` | `services/api-gateway/.env.production` | API Gateway (cluster x2) |
| `unified-backend.env` | `services/unified-backend/.env.production` | Main backend (fork x1) |
| `embeddings-worker.env` | `services/embeddings-worker/.env.production` | Embeddings worker |

---

## 🛠️ Usage

### Automatic Copy

```bash
cd ~/tenpennynovels
./deploy/scripts/copy-env-files.sh
```

Questo copia tutti i template nelle destinazioni corrette come `.env.production`.

### Manual Copy

```bash
cp deploy/env-templates/unified-backend.env services/unified-backend/.env.production
chmod 600 services/unified-backend/.env.production
```

---

## 🔐 Secrets da Configurare

**IMPORTANTE**: Prima di deploy, genera e configura questi segreti:

### JWT Secrets

```bash
# Generate JWT secrets (128 char hex)
openssl rand -hex 64

# Aggiorna in unified-backend.env:
JWT_SECRET=<output_comando>
JWT_REFRESH_SECRET=<output_comando>
```

### AI Gateway Secrets

```bash
# Generate AI Gateway secrets (64 char hex)
openssl rand -hex 32

# Aggiorna in unified-backend.env:
AI_GATEWAY_API_KEY=<output_comando>
AI_GATEWAY_HMAC_SECRET=<output_comando>
```

### SMTP Password

Aggiorna `SMTP_PASS` in `unified-backend.env` con password reale.

### MongoDB URI

Se MongoDB ha authentication abilitata:
```bash
# In unified-backend.env:
MONGODB_URI=mongodb://username:password@127.0.0.1:27017/tenpennynovels
```

---

## ⚠️ Note Importanti

### Frontend Apps (NEXT_PUBLIC_*)

Le variabili `NEXT_PUBLIC_*` sono **compilate durante il build**.

Modificare `.env.production` richiede **rebuild**:
```bash
cd apps/game
npm run build
pm2 restart tenpennynovels-game
```

### Security

- File `.env.production` devono avere permessi `600`
- NON committare mai `.env.production` nel repository
- `.env.production` sono esclusi da rsync (vedi `.github/rsync-exclude.txt`)

---

## 📖 Documentation

Per dettagli completi: [docs/03-environment-variables.md](../docs/03-environment-variables.md) *(TODO)*
