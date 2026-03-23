# 08 - Semantic Search Setup (Qdrant + ElasticSearch)

**Last Updated**: 2026-03-22

Guida completa all'installazione e configurazione del sistema di ricerca semantica per TenPennyNovels.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Qdrant Setup](#qdrant-setup)
  - [ElasticSearch Setup](#elasticsearch-setup)
  - [Embeddings Worker Setup](#embeddings-worker-setup)
- [Configuration](#configuration)
- [Collections & Indices](#collections--indices)
- [Testing](#testing)
- [Monitoring](#monitoring)
- [Backup & Restore](#backup--restore)
- [Troubleshooting](#troubleshooting)
- [Performance Tuning](#performance-tuning)

---

## Overview

Il sistema semantic search combina:
- **Qdrant** (vector database) - Ricerca semantica ANN (Approximate Nearest Neighbors)
- **ElasticSearch** (full-text search) - Ricerca keyword con analyzer italiano
- **Embeddings Worker** (TypeScript + Python) - Genera embeddings e gestisce indicizzazione
- **RRF Merge** (Reciprocal Rank Fusion) - Combina risultati semantic + keyword

### Features Implementate

✅ **Forum Search**:
- Ricerca semantica + keyword
- Filtri: topicSlug, discussionSlug, authorCharacterId
- Endpoint: `GET /api/forum/search`

✅ **Chat Search**:
- Ricerca semantica + keyword
- Filtri: locationId, characterId, dateStart, dateEnd
- Endpoint: `GET /api/game/chats/search`

✅ **Documents Search**:
- Ricerca semantica chunked
- Filtri: documentType (ambientazione, regolamento)
- Endpoint: `GET /api/documents/search`

---

## Architecture

```
┌─────────────────┐
│  unified-backend│
│  (POST create)  │
└────────┬────────┘
         │ Redis Pub/Sub
         ▼
┌─────────────────────┐       ┌──────────────┐
│ embeddings-worker   │──────▶│ Python       │
│ (Bull Queue)        │       │ embeddings   │
│                     │◀──────│ service      │
└──────┬─────┬────────┘       └──────────────┘
       │     │
       │     │ Qdrant REST API
       │     ▼
       │  ┌─────────────────┐
       │  │ Qdrant          │
       │  │ (Vector Store)  │
       │  │ - forum_posts   │
       │  │ - chat_messages │
       │  │ - document_chunks│
       │  └─────────────────┘
       │
       │ ElasticSearch REST API
       ▼
    ┌─────────────────┐
    │ ElasticSearch   │
    │ (Full-text)     │
    │ - forum_posts   │
    │ - chat_messages │
    │ - document_chunks│
    └─────────────────┘
```

### Data Flow

1. **Indexing** (Async):
   - User creates forum post/chat message → MongoDB
   - unified-backend publishes Redis event (`embedding:forum_post:created`)
   - embeddings-worker picks up event from Bull queue
   - Calls Python subprocess → generates embedding (384D vector)
   - Saves to Qdrant (vector) + ElasticSearch (text) + MongoDB (metadata)

2. **Searching** (Sync):
   - User searches → unified-backend
   - Calls embeddings-worker HTTP endpoint `/search`
   - embeddings-worker queries Qdrant (semantic) + ElasticSearch (keyword)
   - Merges results with RRF (Reciprocal Rank Fusion)
   - Returns top-K results

---

## Prerequisites

**Before starting**:
- ✅ Ubuntu 22.04+ VPS
- ✅ Docker installed (for Qdrant + ElasticSearch)
- ✅ MongoDB + Redis running
- ✅ Python 3.8+ installed
- ✅ Node.js 22.13.1 installed

**Resources Required**:
- **Disk**: 5-10 GB (Qdrant storage + ElasticSearch indices)
- **RAM**: 2 GB (Qdrant 512 MB + ElasticSearch 1 GB + embeddings 512 MB)
- **CPU**: 2 cores (embeddings generation is CPU-intensive)

---

## Installation

### Qdrant Setup

**Step 1: Install Docker** (if not installed)

```bash
# Add Docker GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
```

**Step 2: Run Qdrant Container**

```bash
# Create data directory
mkdir -p ~/qdrant_storage

# Run Qdrant container
docker run -d \
  --name qdrant \
  --restart unless-stopped \
  -p 6333:6333 \
  -p 6334:6334 \
  -v ~/qdrant_storage:/qdrant/storage:z \
  qdrant/qdrant:v1.17.0

# Verify running
docker ps | grep qdrant

# Check logs
docker logs qdrant

# Test healthcheck
curl http://127.0.0.1:6333/
# Expected output: {"title":"qdrant - vector search engine","version":"1.17.0"}
```

**Step 3: Configure Qdrant Persistence**

```bash
# Check storage directory
ls -lh ~/qdrant_storage

# Qdrant auto-creates these:
# - aliases/    - Collection aliases
# - collections/ - Vector data
# - meta/       - Metadata
# - raft_state/ - Cluster state

# Verify persistence (restart container)
docker restart qdrant
sleep 5
curl http://127.0.0.1:6333/collections
# Should return empty array initially
```

---

### ElasticSearch Setup

**Step 1: Run ElasticSearch Container**

```bash
# Create data directory
mkdir -p ~/elasticsearch_data

# Run ElasticSearch container (single-node, no security)
docker run -d \
  --name elasticsearch \
  --restart unless-stopped \
  -p 9200:9200 \
  -p 9300:9300 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  -e "ES_JAVA_OPTS=-Xms1g -Xmx1g" \
  -v ~/elasticsearch_data:/usr/share/elasticsearch/data:z \
  docker.elastic.co/elasticsearch/elasticsearch:8.11.0

# Verify running
docker ps | grep elasticsearch

# Check logs (may take 30-60s to start)
docker logs -f elasticsearch

# Wait for green status
sleep 60

# Test healthcheck
curl http://127.0.0.1:9200/
# Expected output: JSON with cluster info
```

**Step 2: Verify ElasticSearch Health**

```bash
# Check cluster health
curl http://127.0.0.1:9200/_cluster/health

# Expected output:
# {
#   "status": "green",
#   "number_of_nodes": 1,
#   "active_primary_shards": 0
# }

# List indices (should be empty initially)
curl http://127.0.0.1:9200/_cat/indices?v
```

**Step 3: Configure ElasticSearch for Production**

```bash
# Set max_map_count for mmap
sudo sysctl -w vm.max_map_count=262144

# Make permanent
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf

# Verify
sysctl vm.max_map_count
```

---

### Embeddings Worker Setup

**Step 1: Install Python Dependencies**

```bash
cd ~/tenpennynovels/services/embeddings-worker/python

# Create virtual environment
python3 -m venv venv

# Activate
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Verify installation
python -c "from sentence_transformers import SentenceTransformer; print('OK')"

# Deactivate
deactivate
```

**Step 2: Configure Environment Variables**

```bash
cd ~/tenpennynovels/services/embeddings-worker

# Create .env.production
nano .env.production
```

**Paste this configuration**:

```bash
# Node Environment
NODE_ENV=production

# HTTP Server (embeddings-worker API)
HTTP_PORT=5001
HTTP_HOST=127.0.0.1

# Python
PYTHON_PATH=python3

# MongoDB
MONGODB_URI=mongodb://tenpennynovels:YOUR_APP_DB_PASSWORD_HERE@127.0.0.1:27017/tenpennynovels

# Redis
REDIS_URL=redis://127.0.0.1:6379

# Qdrant
QDRANT_URL=http://127.0.0.1:6333

# ElasticSearch
ELASTICSEARCH_URL=http://127.0.0.1:9200
ELASTICSEARCH_INDEX_PREFIX=tenpennynovels

# Embeddings Model
EMBEDDINGS_MODEL=paraphrase-multilingual-MiniLM-L12-v2
EMBEDDINGS_CACHE_TTL=3600

# Moderation (optional)
MODERATION_ENABLED=false
MODERATION_MODEL=unitary/toxic-bert
MODERATION_THRESHOLD=0.7
```

**Save**: `Ctrl+O`, `Enter`, `Ctrl+X`

**Step 3: Build Embeddings Worker**

```bash
cd ~/tenpennynovels

# Build embeddings-worker TypeScript
npm run build --workspace=services/embeddings-worker

# Verify build
ls -lh services/embeddings-worker/dist

# Should see:
# - index.js
# - services/
# - workers/
# - http/
```

---

## Configuration

### Unified Backend Configuration

Add to `services/unified-backend/.env.production`:

```bash
# Embeddings Service
EMBEDDINGS_SERVICE_URL=http://127.0.0.1:5001
```

### PM2 Configuration

Embeddings worker is already configured in `ecosystem.config.js`:

```javascript
{
  name: 'tenpennynovels-embeddings-worker',
  cwd: './services/embeddings-worker',
  script: 'dist/index.js',
  interpreter: 'node',
  exec_mode: 'fork',
  instances: 1,
  max_memory_restart: '1G',
  env_production: {
    NODE_ENV: 'production',
    HTTP_PORT: 5001
  }
}
```

---

## Collections & Indices

### Qdrant Collections

Collections are **auto-created** by embeddings-worker on first start.

**Manual verification**:

```bash
# List collections
curl http://127.0.0.1:6333/collections

# Expected output after first run:
# {
#   "result": {
#     "collections": [
#       { "name": "document_chunks" },
#       { "name": "forum_posts" },
#       { "name": "chat_messages" }
#     ]
#   }
# }

# Get collection info
curl http://127.0.0.1:6333/collections/forum_posts

# Expected:
# {
#   "result": {
#     "status": "green",
#     "vectors_count": 0,
#     "points_count": 0,
#     "config": {
#       "params": {
#         "vectors": {
#           "size": 384,
#           "distance": "Cosine"
#         }
#       }
#     }
#   }
# }
```

### ElasticSearch Indices

Indices are **auto-created** by embeddings-worker on first start.

**Manual verification**:

```bash
# List indices
curl http://127.0.0.1:9200/_cat/indices?v

# Expected output:
# health status index                              docs.count
# green  open   tenpennynovels_document_chunks     0
# green  open   tenpennynovels_forum_posts         0
# green  open   tenpennynovels_chat_messages       0

# Get index mapping
curl http://127.0.0.1:9200/tenpennynovels_forum_posts/_mapping?pretty

# Expected:
# {
#   "tenpennynovels_forum_posts": {
#     "mappings": {
#       "properties": {
#         "postId": { "type": "keyword" },
#         "topicSlug": { "type": "keyword" },
#         "discussionSlug": { "type": "keyword" },
#         "authorCharacterId": { "type": "keyword" },
#         "content": { "type": "text", "analyzer": "italian" },
#         "createdAt": { "type": "date" }
#       }
#     }
#   }
# }
```

---

## Testing

### Test 1: Health Checks

```bash
# Qdrant health
curl http://127.0.0.1:6333/
# Expected: {"title":"qdrant - vector search engine","version":"1.17.0"}

# ElasticSearch health
curl http://127.0.0.1:9200/_cluster/health
# Expected: {"status":"green"}

# Embeddings worker health
curl http://127.0.0.1:5001/health
# Expected: {"status":"healthy","service":"embeddings-worker","model":"paraphrase-multilingual-MiniLM-L12-v2","loaded":true}
```

### Test 2: Generate Embedding

```bash
# Test embedding generation
curl -X POST http://127.0.0.1:5001/embed \
  -H "Content-Type: application/json" \
  -d '{"text":"This is a test message"}'

# Expected output:
# {
#   "success": true,
#   "embedding": [0.123, -0.456, 0.789, ...],  // 384 floats
#   "dimensions": 384
# }
```

### Test 3: Semantic Search (Empty Results)

```bash
# Test search endpoint (should return empty initially)
curl -X POST http://127.0.0.1:5001/search \
  -H "Content-Type: application/json" \
  -d '{"query":"test search","source":"forum","limit":10}'

# Expected:
# {
#   "success": true,
#   "results": [],
#   "totalResults": 0
# }
```

### Test 4: Create Forum Post & Index

**Step 1**: Create forum post via API (requires auth token):

```bash
# Get auth token first
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}' \
  | jq -r '.data.accessToken')

# Create forum post
curl -X POST http://localhost:8000/api/forum/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "topicSlug": "generale",
    "discussionSlug": "test-discussion",
    "content": "This is a test post for semantic search indexing"
  }'
```

**Step 2**: Wait for indexing (5-10 seconds):

```bash
# Check embeddings-worker logs
pm2 logs tenpennynovels-embeddings-worker --lines 20

# Should see:
# 💬 Processing forum post embedding: <postId>
# ✅ Forum post processed: <authorName> @ generale/test-discussion
```

**Step 3**: Verify indexed in Qdrant:

```bash
curl http://127.0.0.1:6333/collections/forum_posts

# Expected:
# {
#   "result": {
#     "points_count": 1,  # Now 1!
#     "vectors_count": 1
#   }
# }
```

**Step 4**: Verify indexed in ElasticSearch:

```bash
curl http://127.0.0.1:9200/tenpennynovels_forum_posts/_count

# Expected:
# {
#   "count": 1
# }
```

**Step 5**: Test semantic search:

```bash
curl -X POST http://127.0.0.1:5001/search \
  -H "Content-Type: application/json" \
  -d '{"query":"test post","source":"forum","limit":10}'

# Expected:
# {
#   "success": true,
#   "results": [
#     {
#       "postId": "...",
#       "topicSlug": "generale",
#       "discussionSlug": "test-discussion",
#       "authorCharacterId": "...",
#       "score": 0.85
#     }
#   ]
# }
```

---

## Monitoring

### Docker Containers Status

```bash
# Check containers
docker ps --filter name=qdrant --filter name=elasticsearch

# Expected output:
# CONTAINER ID   IMAGE                                   STATUS
# abc123...      qdrant/qdrant:v1.17.0                   Up 2 hours
# def456...      elasticsearch:8.11.0                    Up 2 hours

# Restart containers if needed
docker restart qdrant
docker restart elasticsearch
```

### Resource Monitoring

```bash
# Docker stats (real-time)
docker stats qdrant elasticsearch

# Expected:
# NAME            CPU %    MEM USAGE / LIMIT    MEM %
# qdrant          0.5%     256MiB / 8GiB       3.2%
# elasticsearch   2.3%     1.2GiB / 8GiB       15%

# Disk usage
du -sh ~/qdrant_storage
du -sh ~/elasticsearch_data

# Expected:
# 150M   ~/qdrant_storage
# 450M   ~/elasticsearch_data
```

### Embeddings Worker Monitoring

```bash
# PM2 status
pm2 status tenpennynovels-embeddings-worker

# Logs
pm2 logs tenpennynovels-embeddings-worker --lines 50

# Memory usage
pm2 show tenpennynovels-embeddings-worker | grep memory

# Restart if needed
pm2 restart tenpennynovels-embeddings-worker
```

### Collection Statistics

**Qdrant stats**:

```bash
# Document chunks
curl http://127.0.0.1:6333/collections/document_chunks | jq '.result.points_count'

# Forum posts
curl http://127.0.0.1:6333/collections/forum_posts | jq '.result.points_count'

# Chat messages
curl http://127.0.0.1:6333/collections/chat_messages | jq '.result.points_count'
```

**ElasticSearch stats**:

```bash
# All indices count
curl -s http://127.0.0.1:9200/_cat/indices?h=index,docs.count

# Expected output:
# tenpennynovels_document_chunks    245
# tenpennynovels_forum_posts        1523
# tenpennynovels_chat_messages      8942
```

---

## Backup & Restore

### Qdrant Backup

**Manual snapshot**:

```bash
# Create backup directory
mkdir -p ~/backups/qdrant

# Stop Qdrant
docker stop qdrant

# Copy data
cp -r ~/qdrant_storage ~/backups/qdrant/qdrant_storage_$(date +%Y%m%d_%H%M%S)

# Start Qdrant
docker start qdrant
```

**Automated backup script** (`~/backups/backup-qdrant.sh`):

```bash
#!/bin/bash
BACKUP_DIR=~/backups/qdrant
DATE=$(date +%Y%m%d_%H%M%S)

# Create snapshot via API (no downtime)
curl -X POST "http://127.0.0.1:6333/snapshots" \
  -H "Content-Type: application/json" \
  -d '{"name":"backup_'$DATE'"}'

# Copy snapshot to backup dir
mkdir -p $BACKUP_DIR
cp -r ~/qdrant_storage/snapshots $BACKUP_DIR/backup_$DATE

# Keep only last 7 days
find $BACKUP_DIR -type d -name "backup_*" -mtime +7 -exec rm -rf {} \;

echo "Qdrant backup completed: $DATE"
```

**Restore**:

```bash
# Stop Qdrant
docker stop qdrant

# Restore data
rm -rf ~/qdrant_storage/*
cp -r ~/backups/qdrant/qdrant_storage_20260322_120000/* ~/qdrant_storage/

# Start Qdrant
docker start qdrant

# Verify
curl http://127.0.0.1:6333/collections
```

### ElasticSearch Backup

**Manual snapshot**:

```bash
# Create backup directory
mkdir -p ~/backups/elasticsearch

# Stop ElasticSearch
docker stop elasticsearch

# Copy data
cp -r ~/elasticsearch_data ~/backups/elasticsearch/es_data_$(date +%Y%m%d_%H%M%S)

# Start ElasticSearch
docker start elasticsearch
```

**Restore**:

```bash
# Stop ElasticSearch
docker stop elasticsearch

# Restore data
rm -rf ~/elasticsearch_data/*
cp -r ~/backups/elasticsearch/es_data_20260322_120000/* ~/elasticsearch_data/

# Start ElasticSearch
docker start elasticsearch

# Verify
curl http://127.0.0.1:9200/_cat/indices?v
```

---

## Troubleshooting

### Problem 1: Qdrant Container Won't Start

**Symptoms**:
```bash
docker ps | grep qdrant
# (no output)

docker logs qdrant
# Error: permission denied
```

**Solution**:

```bash
# Fix permissions
sudo chown -R $USER:$USER ~/qdrant_storage

# Remove container
docker rm qdrant

# Recreate with correct permissions
docker run -d \
  --name qdrant \
  --restart unless-stopped \
  -p 6333:6333 \
  -v ~/qdrant_storage:/qdrant/storage:z \
  qdrant/qdrant:v1.17.0

# Verify
docker ps | grep qdrant
```

---

### Problem 2: ElasticSearch OOM (Out of Memory)

**Symptoms**:
```bash
docker logs elasticsearch
# ERROR: Java heap space OutOfMemoryError
```

**Solution**:

```bash
# Increase heap size
docker stop elasticsearch
docker rm elasticsearch

# Run with 2GB heap (adjust based on available RAM)
docker run -d \
  --name elasticsearch \
  --restart unless-stopped \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  -e "ES_JAVA_OPTS=-Xms2g -Xmx2g" \
  -v ~/elasticsearch_data:/usr/share/elasticsearch/data:z \
  docker.elastic.co/elasticsearch/elasticsearch:8.11.0
```

---

### Problem 3: Embeddings Worker Crashes

**Symptoms**:
```bash
pm2 status
# tenpennynovels-embeddings-worker  │ errored

pm2 logs tenpennynovels-embeddings-worker
# Error: ECONNREFUSED 127.0.0.1:6333
```

**Solution**:

```bash
# Check Qdrant is running
curl http://127.0.0.1:6333/
# If not responding, restart Qdrant
docker restart qdrant

# Check ElasticSearch is running
curl http://127.0.0.1:9200/
# If not responding, restart ElasticSearch
docker restart elasticsearch

# Restart embeddings-worker
pm2 restart tenpennynovels-embeddings-worker

# Monitor logs
pm2 logs tenpennynovels-embeddings-worker --lines 20
```

---

### Problem 4: Python Embeddings Fail to Load

**Symptoms**:
```bash
pm2 logs tenpennynovels-embeddings-worker
# Error: No module named 'sentence_transformers'
```

**Solution**:

```bash
cd ~/tenpennynovels/services/embeddings-worker/python

# Activate venv
source venv/bin/activate

# Reinstall dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Test
python -c "from sentence_transformers import SentenceTransformer; print('OK')"

# Deactivate
deactivate

# Restart worker
pm2 restart tenpennynovels-embeddings-worker
```

---

### Problem 5: Search Returns No Results

**Debug steps**:

```bash
# 1. Check collections have data
curl http://127.0.0.1:6333/collections/forum_posts | jq '.result.points_count'
# If 0, no data indexed yet

# 2. Check ElasticSearch indices
curl http://127.0.0.1:9200/tenpennynovels_forum_posts/_count
# If count=0, no data indexed

# 3. Check embeddings-worker is processing events
pm2 logs tenpennynovels-embeddings-worker --lines 50
# Should see "Processing forum post embedding" messages

# 4. Check Redis pub/sub is working
redis-cli PSUBSCRIBE "embedding:*"
# Then create a forum post in another terminal
# Should see messages published

# 5. Manually trigger re-indexing (if needed)
# Delete and recreate post to trigger indexing
```

---

## Performance Tuning

### Qdrant Optimization

**Increase HNSW parameters for better recall**:

```bash
# Update collection config (higher ef_construct = better quality, slower indexing)
curl -X PATCH http://127.0.0.1:6333/collections/forum_posts \
  -H "Content-Type: application/json" \
  -d '{
    "optimizers_config": {
      "indexing_threshold": 10000
    },
    "hnsw_config": {
      "ef_construct": 200,
      "m": 16
    }
  }'
```

### ElasticSearch Optimization

**Increase refresh interval** (faster indexing, slower search):

```bash
curl -X PUT http://127.0.0.1:9200/tenpennynovels_forum_posts/_settings \
  -H "Content-Type: application/json" \
  -d '{
    "index": {
      "refresh_interval": "30s"
    }
  }'
```

**Force merge** (optimize after bulk indexing):

```bash
curl -X POST http://127.0.0.1:9200/tenpennynovels_forum_posts/_forcemerge?max_num_segments=1
```

### Embeddings Worker Tuning

**Adjust concurrency** (in `.env.production`):

```bash
# Increase if CPU cores available
BULL_CONCURRENCY=10

# Increase cache TTL for frequently searched terms
EMBEDDINGS_CACHE_TTL=7200  # 2 hours
```

**Restart after changes**:

```bash
pm2 restart tenpennynovels-embeddings-worker
```

---

## Checklist

### Initial Setup

- [ ] Docker installed
- [ ] Qdrant container running on port 6333
- [ ] ElasticSearch container running on port 9200
- [ ] Python venv created + dependencies installed
- [ ] embeddings-worker `.env.production` configured
- [ ] embeddings-worker built (`npm run build`)
- [ ] PM2 started embeddings-worker
- [ ] Health checks passing (Qdrant, ElasticSearch, embeddings-worker)

### Post-Deployment Verification

- [ ] Collections auto-created (document_chunks, forum_posts, chat_messages)
- [ ] Indices auto-created (tenpennynovels_document_chunks, tenpennynovels_forum_posts, tenpennynovels_chat_messages)
- [ ] Test embedding generation (`POST /embed`)
- [ ] Test semantic search (`POST /search`)
- [ ] Create forum post → verify indexed (Qdrant + ElasticSearch)
- [ ] Test forum search with filters (`GET /api/forum/search`)
- [ ] Test chat search with filters (`GET /api/game/chats/search`)

### Monitoring Setup

- [ ] Docker containers auto-restart configured (`--restart unless-stopped`)
- [ ] PM2 embeddings-worker auto-restart configured
- [ ] Backup script created (`~/backups/backup-qdrant.sh`)
- [ ] Backup cron job configured
- [ ] Monitoring dashboard configured (optional: Grafana + Prometheus)

---

## References

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [ElasticSearch Documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Sentence Transformers](https://www.sbert.net/)
- [Bull Queue Documentation](https://optimalbits.github.io/bull/)

---

**Navigation**: [Deploy Index](./INDEX.md) | [Troubleshooting](./99-troubleshooting.md) | [PM2 Configuration](./05-pm2-configuration.md)
