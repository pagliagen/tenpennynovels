# Seeders - Sistema di Popolamento Database

**Script Node.js per seeding database** - Development e production support

---

## Overview

Il sistema di **seeders** popola il database MongoDB con dati iniziali. Supporta sia ambiente locale (Docker) che production (MongoDB Atlas/VPS).

**Location**: [scripts/seeders/](../../../scripts/seeders/)

**Seeders Disponibili**: 10
- UserSeeder
- LocationSeeder
- ItemSeeder
- SkillSeeder
- OccupationSeeder
- SocialClassConfigSeeder
- ForumSeeder
- DocumentSeeder
- SkillConfrontationSeeder
- SystemConfigSeeder

---

## Prerequisites

| Requisito | Versione | Note |
|-----------|----------|------|
| Node.js | 24.18.0+ | Specificata in `.nvmrc` |
| MongoDB | 7.0+ | Docker (local) o Atlas (prod) |
| embeddings-service | Latest | Solo per DocumentSeeder (opzionale) |
| embeddings-worker | Latest | Solo per DocumentSeeder (opzionale) |
| Redis | 7.2+ | Solo per DocumentSeeder (opzionale) |

---

## Installation

```bash
cd scripts/seeders
nvm use # Switch to Node 24.18.0
npm install
```

---

## Configuration

### Environment Files

**Local (Docker)**:
```bash
# .env.local
MONGO_URI=mongodb://admin:password@mongo:27017/tenpennynovels?authSource=admin
```

**Production (VPS/Atlas)**:
```bash
# .env.production
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/tenpennynovels
```

**Setup**:
```bash
cp .env.local.example .env.local
cp .env.production.example .env.production
# Edit files with your credentials
```

---

## Usage Patterns

### Seed Single Collection

**Development**:
```bash
npm run seed:dev:users
npm run seed:dev:locations
npm run seed:dev:items
npm run seed:dev:skills
npm run seed:dev:occupations
npm run seed:dev:social-classes
npm run seed:dev:forum
npm run seed:dev:documents
```

**Production**:
```bash
npm run seed:prod:users
npm run seed:prod:locations
# etc...
```

---

### Seed All Collections

```bash
# Development
npm run seed:dev:all

# Production
npm run seed:prod:all
```

**Execution Order** (per `seed:all`):
1. SystemConfigSeeder
2. UserSeeder
3. SkillSeeder
4. OccupationSeeder
5. SocialClassConfigSeeder
6. SkillConfrontationSeeder
7. LocationSeeder
8. ItemSeeder
9. ForumSeeder
10. DocumentSeeder

**Why Order Matters**: Dependencies (e.g., Users must exist before Characters)

---

### Force Flag (⚠️ DANGEROUS)

**Purpose**: Clear existing data before seeding

```bash
# Development
npm run seed:dev:users -- --force
npm run seed:dev:documents -- --force

# Production
npm run seed:prod:users -- --force
```

**Behavior**:
- `UserSeeder --force`: Deletes Characters FIRST (dependency), then Users
- `DocumentSeeder --force`: Deletes chunks + documents, clears Qdrant collection
- `LocationSeeder --force`: Deletes all locations

**⚠️ CRITICAL**: NEVER use `--force` in production without backup!

---

## Seeders Deep Dive

### 1. UserSeeder

**Purpose**: Create admin and test user accounts

**File**: [seeders/UserSeeder.ts](../../../scripts/seeders/seeders/UserSeeder.ts)

**Data**:
- **Admin**: `admin` / password from env `ADMIN_PASSWORD`
- **Test Users**: `user1`, `user2`, ..., `user10` (password: `test123`)

**Output**:
```
✓ UserSeeder: Seeded 11 users (1 admin, 10 test users)
```

**With --force**:
```bash
npm run seed:dev:users -- --force

# Execution:
# 1. Delete all Characters (dependency)
# 2. Delete all Users
# 3. Seed new users
```

---

### 2. LocationSeeder

**Purpose**: Create London map hierarchy

**File**: [seeders/LocationSeeder.ts](../../../scripts/seeders/seeders/LocationSeeder.ts)

**Data Source**: [data/locations.json](../../../scripts/seeders/data/locations.json)

**Structure**:
```json
[
  {
    "name": "London",
    "slug": "london",
    "description": "Victorian London capital",
    "type": "city",
    "parentSlug": null,
    "settings": {
      "visible": true,
      "chat": false,
      "shop": false,
      "private": false
    }
  },
  {
    "name": "Westminster",
    "slug": "westminster",
    "description": "District of London",
    "type": "district",
    "parentSlug": "london",
    "settings": {
      "visible": true,
      "chat": false,
      "shop": false,
      "private": false
    }
  },
  {
    "name": "The Whitechapel Tavern",
    "slug": "whitechapel-tavern",
    "description": "Popular tavern in Whitechapel",
    "type": "venue",
    "parentSlug": "whitechapel",
    "settings": {
      "visible": true,
      "chat": true,
      "shop": true,
      "private": false
    }
  }
]
```

**Hierarchy**: City → District → Venue (3 levels)

**Output**:
```
✓ LocationSeeder: Seeded 47 locations (1 city, 12 districts, 34 venues)
```

---

### 3. DocumentSeeder ⭐

**Purpose**: Seed game documentation (ambientazione, regolamento) + generate embeddings

**File**: [seeders/DocumentSeeder.ts](../../../scripts/seeders/seeders/DocumentSeeder.ts)

**Data Source**:
- `data/documents.csv` - Metadata (title, slug, type, level, etc.)
- `data/documents/{slug}.content` - TipTap Delta JSON content
- `data/documents/{slug}.description` - Plain text description

**Process**:
1. Read CSV + content files
2. Create Route hierarchy
3. Create Document records
4. Generate embeddings via embeddings-worker
5. Store embeddings in Qdrant

**Embedding Integration**:
```typescript
// Trigger embedding generation
await fetch('http://localhost:3002/admin/documents/generate-embeddings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ documentIds: [doc._id] })
});
```

**Output**:
```
✓ DocumentSeeder: Seeded 124 documents
  • 78 ambientazione documents
  • 46 regolamento documents
  • 124 embeddings generated
  • 124 Qdrant vectors stored
```

**⚠️ Dependencies**:
- embeddings-service running (port 5001)
- embeddings-worker running (port 3002)
- Redis running (port 6379)
- Qdrant running (port 6333)

**Skip Embeddings** (if services not running):
```bash
SKIP_EMBEDDINGS=true npm run seed:dev:documents
```

---

### 4. SkillSeeder

**Purpose**: Seed Call of Cthulhu skill list

**File**: [seeders/SkillSeeder.ts](../../../scripts/seeders/seeders/SkillSeeder.ts)

**Data Source**: [data/skills.json](../../../scripts/seeders/data/skills.json)

**Skill Structure**:
```json
{
  "name": "Accounting",
  "category": "Mental",
  "baseValue": 5,
  "description": "Understanding financial records, detecting fraud",
  "examples": "Audit books, detect embezzlement, tax evasion"
}
```

**Categories**: Mental, Physical, Combat, Social

**Output**:
```
✓ SkillSeeder: Seeded 90 skills (Call of Cthulhu 7th edition)
```

---

### 5. OccupationSeeder

**Purpose**: Seed Victorian professions

**File**: [seeders/OccupationSeeder.ts](../../../scripts/seeders/seeders/OccupationSeeder.ts)

**Data Source**: [data/occupations.json](../../../scripts/seeders/data/occupations.json)

**Examples**:
- Detective
- Doctor
- Journalist
- Lawyer
- Professor
- Soldier
- Thief
- Artist
- Merchant

**Output**:
```
✓ OccupationSeeder: Seeded 42 occupations
```

---

### 6. ItemSeeder

**Purpose**: Seed equipment, weapons, consumables

**File**: [seeders/ItemSeeder.ts](../../../scripts/seeders/seeders/ItemSeeder.ts)

**Data Source**: [data/items.json](../../../scripts/seeders/data/items.json)

**Item Categories**:
- Weapons (melee, firearms)
- Armor
- Tools
- Consumables (medical supplies, food)
- Misc (books, documents)

**Output**:
```
✓ ItemSeeder: Seeded 156 items
```

---

### 7. ForumSeeder

**Purpose**: Seed forum categories, topics, posts (test data)

**File**: [seeders/ForumSeeder.ts](../../../scripts/seeders/seeders/ForumSeeder.ts)

**Data**:
- 5 categories (General, Rules, Gameplay, Characters, OOC)
- 20 topics
- 50 posts

**Output**:
```
✓ ForumSeeder: Seeded forum (5 categories, 20 topics, 50 posts)
```

---

### 8-10. Other Seeders

| Seeder | Purpose | Data Source |
|--------|---------|-------------|
| SocialClassConfigSeeder | Victorian class system | data/social-classes.json |
| SkillConfrontationSeeder | Skill opposition matrix | data/skill-confrontations.json |
| SystemConfigSeeder | Game configuration | Hardcoded defaults |

---

## Export Commands

### Export Documents

**Purpose**: Before using DocumentSeeder, export existing documents

```bash
# Development
npm run export:dev:documents

# Production
npm run export:prod:documents
```

**Output Files**:
- `data/documents.csv` - Metadata
- `data/documents/{slug}.content` - TipTap Delta JSON
- `data/documents/{slug}.description` - Plain text

**When to Use**: Before major changes, migrations, or seeding fresh DB

---

## Test Commands

### Test All Seeders

**Purpose**: Verify seeders work without actually seeding

```bash
# Development
npm run test:dev

# Production
npm run test:prod
```

**Output**: Dry-run showing what would be seeded

---

## Common Patterns

### Seeder Base Class

All seeders extend `BaseSeeder`:

```typescript
import { BaseSeeder } from '../utils/BaseSeeder';

export class UserSeeder extends BaseSeeder {
  async seed(force: boolean = false): Promise<void> {
    if (force) {
      // Clear existing data
      await this.clearCollection('users');
    }

    // Seed data
    const users = this.loadData('users.json');
    await this.insertMany('users', users);

    this.log('success', `Seeded ${users.length} users`);
  }
}
```

**BaseSeeder Methods**:
- `loadData(filename)` - Load JSON file from `data/`
- `clearCollection(collection)` - Delete all documents
- `insertMany(collection, data)` - Bulk insert
- `log(level, message)` - Colored console output

---

### Data Loading Pattern

```typescript
const data = this.loadData('locations.json');

// Transform if needed
const locations = data.map(loc => ({
  ...loc,
  createdAt: new Date(),
  updatedAt: new Date()
}));

await this.insertMany('locations', locations);
```

---

### Force Flag Pattern

```typescript
async seed(force: boolean = false): Promise<void> {
  if (force) {
    this.log('warning', 'Clearing existing data...');

    // Delete dependencies first
    await this.clearCollection('characters');
    await this.clearCollection('users');
  }

  // Seed logic...
}
```

---

## Troubleshooting

### MongoDB Connection Failed

**Symptoms**: `MongoNetworkError: failed to connect`

**Checklist**:
1. Verify MongoDB running: `docker ps | grep mongo` (local) o `mongosh <MONGO_URI>` (prod)
2. Check `.env.local` or `.env.production` MONGO_URI corretto
3. Verify credentials (username/password)
4. Check network (VPN, firewall)

**Fix**:
```bash
# Local - restart MongoDB container
docker-compose up -d mongo

# Production - check Atlas IP whitelist
```

---

### DocumentSeeder Embeddings Fail

**Symptoms**: `Error generating embeddings: ECONNREFUSED`

**Checklist**:
1. embeddings-service running: `docker ps | grep embeddings-service`
2. embeddings-worker running: `pm2 list | grep embeddings-worker`
3. Redis running: `docker ps | grep redis`
4. Qdrant running: `docker ps | grep qdrant`

**Fix**:
```bash
# Start missing services
docker-compose up -d embeddings-service redis qdrant
pm2 start ecosystem.config.js --only tenpennynovels-embeddings-worker

# Or skip embeddings
SKIP_EMBEDDINGS=true npm run seed:dev:documents
```

---

### Force Flag Not Working

**Symptoms**: `--force` ignored, data not cleared

**Fix**: Use `--` separator:
```bash
# ❌ Wrong
npm run seed:dev:users --force

# ✅ Correct
npm run seed:dev:users -- --force
```

---

## Best Practices

### 1. Always Backup Before --force

```bash
# MongoDB dump before force seeding
mongodump --uri="mongodb://..." --out=backup-$(date +%Y%m%d)

# Then seed
npm run seed:prod:users -- --force
```

---

### 2. Test Locally First

```bash
# Test in local Docker environment
npm run seed:dev:all

# Verify
mongosh mongodb://admin:password@localhost:27017/tenpennynovels?authSource=admin
> db.users.countDocuments()

# Then production
npm run seed:prod:all
```

---

### 3. Seed in Order

```bash
# ✅ Correct order (respects dependencies)
npm run seed:dev:users
npm run seed:dev:skills
npm run seed:dev:occupations
npm run seed:dev:locations

# ❌ Wrong order (will fail due to missing dependencies)
npm run seed:dev:locations # Fails if users don't exist
```

---

## Related Documentation

- [MongoDB Schemas](../infrastructure/mongodb-schemas.md) - Database structure
- [Embeddings Worker](../backend/embeddings-worker.md) - Embedding generation
- [Qdrant Vector DB](../infrastructure/qdrant-vector-db.md) - Vector storage

---

**Maintained by**: TenPennyNovels Team
**Last Updated**: 2026-03-15
**Seeder Count**: 10
**Total Data**: ~450 records (users, locations, items, skills, documents)
