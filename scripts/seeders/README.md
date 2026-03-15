# TenPennyNovels Seeders System

Complete overhaul of the seeders system with support for both local (Docker) and production (direct MongoDB) environments.

## Overview

Seeders populate the database with initial data. All seeders automatically detect and support both environments:
- **Local**: `mongodb://mongo:27017/tenpennynovels` (Docker)
- **Production**: `mongodb+srv://...` (MongoDB Atlas) or direct connection

## Prerequisites

- Node.js >= 22.13.1 (see `.nvmrc` in project root)
- MongoDB running (locally via Docker or production instance)
- For DocumentSeeder embeddings (optional): `embeddings-service`, `embeddings-worker`, and Redis must be running

## Installation

```bash
cd scripts/seeders
npm install
```

## Configuration

### 1. Setup Environment Files

Copy the example files and fill in your credentials:

```bash
# Local development (Docker)
cp .env.local.example .env.local

# Production
cp .env.production.example .env.production
```

### 2. Edit Environment Files

**`.env.local`** (Local/Docker):
```bash
# MongoDB with Docker auth
MONGO_URI=mongodb://{username}:{password}@mongo:27017/tenpennynovels?authSource=admin
```

**`.env.production`** (Production):
```bash
# MongoDB Atlas
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/tenpennynovels
```

## Quick Start

### Export Documents (One-time Setup)

Before using the DocumentSeeder, export all documents from the database:

```bash
# Development
npm run export:dev:documents

# Production
npm run export:prod:documents
```

This creates:
- `data/documents/{slug}.content` (TipTap Delta JSON)
- `data/documents/{slug}.description` (plain text)
- `data/documents.csv` (remaining fields)

### Seed Individual Collections

#### Development (Local/Docker)

```bash
# Seed users (admin + test accounts)
npm run seed:dev:users

# Seed locations (London map)
npm run seed:dev:locations

# Seed items (equipment, consumables)
npm run seed:dev:items

# Seed skills (Call of Cthulhu skills)
npm run seed:dev:skills

# Seed occupations (Victorian professions)
npm run seed:dev:occupations

# Seed social classes (Victorian class system)
npm run seed:dev:social-classes

# Seed forum (topics, discussions, posts)
npm run seed:dev:forum

# Seed documents (game content)
npm run seed:dev:documents
```

#### Production

```bash
# Same commands, but with :prod instead of :dev
npm run seed:prod:users
npm run seed:prod:locations
npm run seed:prod:items
npm run seed:prod:skills
npm run seed:prod:occupations
npm run seed:prod:social-classes
npm run seed:prod:forum
npm run seed:prod:documents
```

### Seed All Collections

```bash
# Development
npm run seed:dev:all

# Production
npm run seed:prod:all
```

### Test All Seeders

```bash
# Development
npm run test:dev

# Production
npm run test:prod
```

## Flags

### --force

Clear existing data before seeding. **Use with caution!**

```bash
# Development
npm run seed:dev:users -- --force          # Delete Characters FIRST, then Users, then reseed
npm run seed:dev:documents -- --force      # Clear documents + chunks, then reseed
npm run seed:dev:locations -- --force      # Clear locations, then reseed

# Production
npm run seed:prod:users -- --force
npm run seed:prod:documents -- --force
```

### --no-chunks (DocumentSeeder only)

Skip chunk generation (faster, but documents won't be searchable):

```bash
npm run seed:dev:documents -- --no-chunks
npm run seed:prod:documents -- --no-chunks
```

### --no-wait (DocumentSeeder only)

Don't wait for embeddings to complete (faster, but may leave incomplete embeddings):

```bash
npm run seed:dev:documents -- --no-wait
npm run seed:prod:documents -- --no-wait
```

## Environment Variables

All environment variables are configured in `.env.local` and `.env.production` files. The npm scripts automatically load the correct file.

### Available Variables

**MONGO_URI** - MongoDB connection string
- Local: `mongodb://admin:password@mongo:27017/tenpennynovels?authSource=admin`
- Production: `mongodb+srv://user:pass@cluster.mongodb.net/tenpennynovels`

### Manual Override (if needed)

You can still override variables manually:

```bash
MONGO_URI="mongodb://custom:27017/db" npm run seed:dev:users
```

## Seeders Reference

### UserSeeder

**Creates**: Admin users + test account

**Features**:
- ✅ Cascade deletion: Deletes Characters FIRST when using `--force`
- ✅ Prevents orphaned Character records
- ✅ Creates 4 admin users + 1 test user

**Usage**:
```bash
# Development
npm run seed:dev:users              # Normal (skip if exists)
npm run seed:dev:users -- --force   # Delete Characters + Users, reseed

# Production
npm run seed:prod:users
npm run seed:prod:users -- --force
```

**Created users**:
- `admin` / `admin123` (System Administrator)
- `tibbi` / `tibbi` (Tibbi)
- `susi` / `susi` (Susanna)
- `linda` / `linda` (Linda)
- `testuser` / `test123` (Test User)

### DocumentSeeder

**Creates**: Game documents (lore, rules, guides)

**Features**:
- ✅ Reads from CSV + individual files (`{slug}.content`, `{slug}.description`)
- ✅ Two-phase insert (root documents → children)
- ✅ Generates chunks directly using TipTap Delta parser (no backend API dependency)
- ✅ Optionally waits for embeddings to complete
- ✅ Supports both local and production environments

**Requirements**:
- `data/documents.csv` (generated by `npm run export:documents`)
- `data/documents/{slug}.content` files
- `data/documents/{slug}.description` files
- `embeddings-service` + `embeddings-worker` + Redis (optional, for embeddings only)

**Usage**:
```bash
# Development
npm run seed:dev:documents                          # Normal
npm run seed:dev:documents -- --force               # Clear + reseed + chunks
npm run seed:dev:documents -- --force --no-chunks   # Clear + reseed (no chunks)
npm run seed:dev:documents -- --no-wait             # Don't wait for embeddings

# Production
npm run seed:prod:documents
npm run seed:prod:documents -- --force
```

**Note**: Chunk generation can take 5-10 minutes for 42 documents (with embeddings wait).

### LocationSeeder

**Creates**: London locations (map system)

**Source**: `data/locations.csv`

**Usage**:
```bash
# Development
npm run seed:dev:locations
npm run seed:dev:locations -- --force

# Production
npm run seed:prod:locations
```

### ItemSeeder

**Creates**: Equipment, consumables, and items

**Source**: `data/items.csv`

**Usage**:
```bash
npm run seed:dev:items
npm run seed:prod:items
```

### SkillSeeder

**Creates**: Call of Cthulhu base skills

**Source**: `data/skills.csv`

**Usage**:
```bash
npm run seed:dev:skills
npm run seed:prod:skills
```

### OccupationSeeder

**Creates**: Victorian professions and occupations

**Source**: `data/occupations.csv`

**Usage**:
```bash
npm run seed:dev:occupations
npm run seed:prod:occupations
```

### SocialClassConfigSeeder

**Creates**: Victorian social class system

**Source**: `data/social-class-configs.csv`

**Usage**:
```bash
npm run seed:dev:social-classes
npm run seed:prod:social-classes
```

### ForumSeeder

**Creates**: Forum topics, discussions, and posts

**Source**: Inline data in `ForumSeeder.ts`

**Usage**:
```bash
npm run seed:dev:forum
npm run seed:prod:forum
```

## Chunk Generation + Embeddings

DocumentSeeder automatically triggers the complete flow:

1. **Insert Document** → MongoDB `documents` collection
2. **Generate Chunks** → Parse TipTap Delta directly into H2/H3 sections → `document_chunks` collection
3. **Generate Embeddings** (optional) → EmbeddingWorker (Bull queue) picks up chunks → Flask service (384D vectors)
4. **Save Embeddings** → MongoDB `contentEmbedding` field + Qdrant vector DB
5. **Wait for Completion** → Poll until all chunks have embeddings (if `--no-wait` not used)

**Required Services for embeddings (optional)**:
```bash
# Start embedding services (Docker Compose)
docker-compose up embeddings-service embeddings-worker redis qdrant mongo
```

**Note**: Chunks are generated directly by the seeder without backend API dependency. Embeddings are optional and will be generated asynchronously by the embeddings-worker if those services are running.

## Example Workflow

### First Time Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment files
cp .env.local.example .env.local
# Edit .env.local with your MongoDB credentials

# 3. Export existing documents (if any)
npm run export:dev:documents

# 4. Seed all collections
npm run seed:dev:all
```

### Daily Usage

```bash
# Seed users with force (development)
npm run seed:dev:users -- --force

# Seed documents without waiting for embeddings (faster)
npm run seed:dev:documents -- --no-wait

# Test all seeders
npm run test:dev
```

### Production Deployment

```bash
# 1. Configure production environment
cp .env.production.example .env.production
# Edit .env.production with production credentials

# 2. Export documents from production DB
npm run export:prod:documents

# 3. Seed production (careful!)
npm run seed:prod:users
npm run seed:prod:documents
```

## Troubleshooting

### "Timeout waiting for embeddings"

**Cause**: Embeddings worker or Redis not running.

**Solution**:
```bash
# Check embeddings-worker logs
docker-compose logs embeddings-worker

# Check Redis logs
docker-compose logs redis

# Or skip waiting
npm run seed:documents -- --no-wait
```

### "Connection refused" or "Authentication failed"

**Cause**: MongoDB not running, wrong credentials, or misconfigured `.env` file.

**Solution**:
```bash
# Check MongoDB is running
docker-compose ps mongo

# Check your .env.local file
cat .env.local

# Test connection with mongo shell
mongosh "mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin"

# Or run with debug
npm run seed:dev:users -- --force
```

### ".env file not found"

**Cause**: You haven't created the `.env.local` or `.env.production` files.

**Solution**:
```bash
# Copy the examples
cp .env.local.example .env.local
cp .env.production.example .env.production

# Edit with your credentials
nano .env.local
```

## Architecture

### Connection Utility

All seeders use `utils/connection.ts` for consistent MongoDB connection:

```typescript
import { getConnection } from '../utils/connection.js';

const { client, db } = await getConnection();
```

**Features**:
- Auto-detects environment (local vs production)
- Logs connection mode
- Hides credentials in logs
- Returns connected client + database

### Document Export/Import Flow

```
Production DB
     ↓
export-documents.ts
     ↓
data/documents/
  ├── {slug}.content (TipTap Delta JSON)
  ├── {slug}.description (plain text)
  └── documents.csv (remaining fields)
     ↓
DocumentSeeder.ts
     ↓
MongoDB + Chunks + Embeddings
```

## Development

### Adding a New Seeder

1. Create `seeders/MySeeder.ts`:
   ```typescript
   import { getConnection } from '../utils/connection.js';

   export class MySeeder {
     async seed(force: boolean = false): Promise<void> {
       const { client, db } = await getConnection();

       try {
         // ... seeding logic ...
       } finally {
         await client.close();
       }
     }
   }
   ```

2. Add script to `package.json`:
   ```json
   "seed:my-collection": "tsx seeders/MySeeder.ts"
   ```

3. Add to `seed:all` chain:
   ```json
   "seed:all": "... && npm run seed:my-collection"
   ```

4. Add to `test-all.sh`.

### Standards

✅ **Use getConnection()**: All seeders use shared connection utility
✅ **Try-finally**: Always close connections in finally block
✅ **Logging**: Clear console output with emojis and progress indicators
✅ **Force flag**: Support `--force` for re-seeding
✅ **Error handling**: Graceful error messages, non-zero exit codes on failure
✅ **Environment agnostic**: Work in both local (Docker) and production

## Migration from Old System

### Changes

- ❌ **Removed**: Hardcoded MongoDB connection strings in each seeder
- ❌ **Removed**: Duplicate connection logic
- ✅ **Added**: Shared `getConnection()` utility
- ✅ **Added**: Character cascade deletion in UserSeeder
- ✅ **Added**: Document export script
- ✅ **Added**: Chunk generation + embeddings in DocumentSeeder
- ✅ **Added**: Environment auto-detection

### Breaking Changes

None! All seeders maintain backward compatibility while adding new features.

## License

Proprietary - TenPennyNovels
