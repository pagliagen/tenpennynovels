# CDN Service

**Purpose**: Upload, processing e storage di asset statici (immagini) per TenpennyNovels.

## Features

- ✅ **Upload**: Multipart form-data con JWT auth
- ✅ **Processing**: Resize automatico (max 1920px), WebP conversion, thumbnails
- ✅ **Storage**: Filesystem con hash-based naming (content-addressable)
- ✅ **Validation**: MIME type, size limits (10MB), image metadata check
- ✅ **Cleanup**: Soft-delete con purge automatico (7 giorni)
- ✅ **Security**: JWT auth, file type validation, size limits

## Tech Stack

- **Node.js** 22
- **Express** 5
- **Sharp** (image processing)
- **Multer** (file upload)
- **JWT** (auth)

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start dev server (hot-reload)
npm run dev

# Server starts on port 4002
```

### Production

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

### Docker

```bash
# Build image
docker build -t cdn-service .

# Run container
docker run -p 4002:4002 \
  -v cdn-storage:/cdn-storage \
  -e JWT_SECRET=your_secret \
  cdn-service
```

## API Endpoints

### POST /upload

Upload e processa immagine.

**Request** (multipart/form-data):
- `file`: Image file (JPEG, PNG, WebP, GIF)
- `type`: Entity type (`location`, `item`, `character`)
- `entityId`: MongoDB ObjectId (24 hex chars)

**Headers**:
- `Authorization: Bearer {JWT_TOKEN}`

**Response**:
```json
{
  "success": true,
  "urls": {
    "main": "https://cdn.tenpennynovels.com/locations/{id}/location-{hash}.webp",
    "thumbnail": "https://cdn.tenpennynovels.com/locations/{id}/thumb-{hash}.webp"
  },
  "metadata": {
    "hash": "a1b2c3d4e5f6",
    "originalSize": 1234567,
    "processedSize": 345678,
    "thumbnailSize": 12345
  }
}
```

**Errors**:
- `401`: Missing/invalid JWT
- `400`: Invalid file type, size, or parameters
- `413`: File too large (> 10MB)
- `500`: Processing error

### GET /health

Health check.

**Response**:
```json
{
  "success": true,
  "service": "cdn-service",
  "uptime": 123.45
}
```

## Configuration

### Environment Variables

```env
# Server
PORT=4002
CDN_SERVICE_HOST=0.0.0.0
NODE_ENV=development

# Storage
CDN_STORAGE_PATH=/cdn-storage
CDN_BASE_URL=http://localhost:8000/cdn

# Upload limits
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,image/gif

# Image processing
IMAGE_MAX_WIDTH=1920
IMAGE_QUALITY=85
THUMBNAIL_SIZE=300
THUMBNAIL_QUALITY=80

# JWT Auth
JWT_SECRET=dev_jwt_secret_change_in_production

# Cleanup job
CLEANUP_INTERVAL_HOURS=24
CLEANUP_RETENTION_DAYS=7

# CORS
ALLOWED_ORIGINS=http://localhost:4004,http://localhost:4001
```

## Storage Structure

```
/cdn-storage/
├── locations/
│   └── {locationId}/
│       ├── location-{hash}.webp     # Main image (1920px max)
│       └── thumb-{hash}.webp        # Thumbnail (300x300)
├── items/
│   └── {itemId}/
│       ├── image-{hash}.webp
│       └── thumb-{hash}.webp
├── characters/
│   └── {characterId}/
│       ├── avatar-{hash}.webp
│       └── thumb-{hash}.webp
└── .cleanup/                        # Soft-deleted files
    └── {timestamp}-{type}-{entityId}-{filename}
```

## Processing Pipeline

```
1. Upload (Multer)
   ↓
2. Validation (MIME, size, extension)
   ↓
3. Image validation (Sharp metadata)
   ↓
4. Hash generation (SHA256 content)
   ↓
5. Processing (Sharp)
   - Resize max 1920px width (maintain aspect)
   - Convert to WebP (quality 85)
   - Generate thumbnail 300x300 (crop center, quality 80)
   ↓
6. Storage (Atomic write: temp → rename)
   ↓
7. Response (URLs + metadata)
```

## Cleanup Job

**Purpose**: Purge soft-deleted files dopo retention period.

**Schedule**: Automatico ogni 24h (configurabile)

**Manual run**:
```bash
npm run cleanup
```

**Logs**:
```
Scanning 42 files in cleanup directory...
Deleted expired file: 1709251200000-location-abc-banner.webp (123456 bytes)
...
Cleanup summary:
- Scanned: 42 files
- Deleted: 15 files
- Errors: 0
- Freed: 5.23 MB
```

## Security

### Auth Flow
1. Management UI ottiene JWT da unified-backend (login admin)
2. Upload include header `Authorization: Bearer {jwt}`
3. cdn-service verifica JWT con stesso secret di unified-backend
4. Se valido, processa upload

### Validations
- ✅ MIME type whitelist
- ✅ Extension whitelist
- ✅ File size limit (10MB)
- ✅ Image metadata check (Sharp)
- ✅ Dimension limits (min 100px, max 10000px)
- ✅ Hash-based naming (no path traversal)

### Rate Limiting
Non implementato in cdn-service (gestito da api-gateway se necessario).

## Development

### Run Tests
```bash
# TODO: Implement tests
npm test
```

### Lint
```bash
# TODO: Add ESLint
npm run lint
```

### Build
```bash
npm run build
```

## Troubleshooting

### "File too large"
Aumenta `MAX_FILE_SIZE` in `.env`.

### "Invalid file type"
Check `ALLOWED_MIME_TYPES` include il MIME type del file.

### Sharp error "Invalid image"
File corrotto o formato non supportato. Test con altra immagine.

### Permission denied
```bash
# Fix permissions
chmod -R 755 /cdn-storage
```

## Deployment

See [/deploy/CDN_SETUP.md](../../deploy/CDN_SETUP.md) for full deployment guide.

## License

MIT
