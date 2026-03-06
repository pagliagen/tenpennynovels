# ElasticSearch Setup Guide - TenPennyNovels

Guida completa per setup ElasticSearch (hybrid search: keyword + semantic) sia locale (Docker) che produzione (VPS OVH).

---

## 📋 Overview

**Architettura Hybrid Search:**
- **ElasticSearch**: Keyword search (full-text) → trova parole esatte come "Caraibi"
- **Qdrant**: Semantic search (embeddings) → trova concetti simili
- **Hybrid**: Combina entrambi con ranking unificato

**Indici ElasticSearch (1:1 con Qdrant collections):**
1. `tenpennynovels_documents` → Qdrant `documents`
2. `tenpennynovels_document_chunks` → Qdrant `document_chunks`
3. `tenpennynovels_location_actions` → Qdrant `location_actions`

---

## 🐳 Setup Locale (Docker)

### 1. ElasticSearch Container

**✅ FATTO** - Container già configurato in `docker-compose.yml`:
```yaml
elasticsearch:
  image: elasticsearch:8.11.0
  ports: "9200:9200"
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=false
```

**Avvia:**
```bash
docker-compose up -d elasticsearch
```

**Verifica:**
```bash
curl http://localhost:9200 | jq
```

---

### 2. Crea Indici (3 indici)

#### A) document_chunks ✅ FATTO

```bash
curl -X PUT "http://localhost:9200/tenpennynovels_document_chunks" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "analysis": {
        "analyzer": {
          "italian_analyzer": { "type": "standard" }
        }
      }
    },
    "mappings": {
      "properties": {
        "chunkId": { "type": "keyword" },
        "documentId": { "type": "keyword" },
        "slug": { "type": "keyword" },
        "heading": {
          "type": "text",
          "analyzer": "italian_analyzer",
          "fields": { "keyword": { "type": "keyword" } }
        },
        "content": {
          "type": "text",
          "analyzer": "italian_analyzer"
        },
        "documentType": { "type": "keyword" },
        "headingLevel": { "type": "integer" },
        "parentSlug": { "type": "keyword" },
        "isActive": { "type": "boolean" },
        "order": { "type": "integer" }
      }
    }
  }'
```

#### B) documents

```bash
curl -X PUT "http://localhost:9200/tenpennynovels_documents" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "analysis": {
        "analyzer": {
          "italian_analyzer": { "type": "standard" }
        }
      }
    },
    "mappings": {
      "properties": {
        "documentId": { "type": "keyword" },
        "slug": { "type": "keyword" },
        "title": {
          "type": "text",
          "analyzer": "italian_analyzer",
          "fields": { "keyword": { "type": "keyword" } }
        },
        "description": {
          "type": "text",
          "analyzer": "italian_analyzer"
        },
        "content": {
          "type": "text",
          "analyzer": "italian_analyzer"
        },
        "documentType": { "type": "keyword" },
        "tags": { "type": "keyword" },
        "isVisible": { "type": "boolean" },
        "isDraft": { "type": "boolean" }
      }
    }
  }'
```

#### C) location_actions

```bash
curl -X PUT "http://localhost:9200/tenpennynovels_location_actions" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "analysis": {
        "analyzer": {
          "italian_analyzer": { "type": "standard" }
        }
      }
    },
    "mappings": {
      "properties": {
        "locationActionId": { "type": "keyword" },
        "locationId": { "type": "keyword" },
        "locationName": { "type": "keyword" },
        "characterId": { "type": "keyword" },
        "characterName": { "type": "keyword" },
        "content": {
          "type": "text",
          "analyzer": "italian_analyzer"
        },
        "actionType": { "type": "keyword" },
        "timestamp": { "type": "date" }
      }
    }
  }'
```

**Verifica indici creati:**
```bash
curl http://localhost:9200/_cat/indices?v
```

---

## 🚀 Setup Produzione (VPS OVH)

### 1. Installa ElasticSearch su Ubuntu

```bash
# SSH nella VPS
ssh -p 6688 ubuntu@51.83.44.181

# Import GPG key
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo gpg --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg

# Add repository
echo "deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list

# Install
sudo apt update && sudo apt install elasticsearch

# Configure (disable security for internal use)
sudo nano /etc/elasticsearch/elasticsearch.yml
```

**Configura `/etc/elasticsearch/elasticsearch.yml`:**
```yaml
cluster.name: tenpennynovels
node.name: node-1
network.host: 127.0.0.1
http.port: 9200
discovery.type: single-node

# Disable security (internal only)
xpack.security.enabled: false
xpack.security.enrollment.enabled: false
xpack.security.http.ssl.enabled: false
xpack.security.transport.ssl.enabled: false
```

**Avvia:**
```bash
sudo systemctl enable elasticsearch
sudo systemctl start elasticsearch
sudo systemctl status elasticsearch

# Verifica
curl http://localhost:9200
```

---

### 2. Crea Indici su VPS (stesso comando locale)

**Esegui gli stessi 3 comandi curl della sezione locale:**

```bash
# A) document_chunks
curl -X PUT "http://localhost:9200/tenpennynovels_document_chunks" ...

# B) documents
curl -X PUT "http://localhost:9200/tenpennynovels_documents" ...

# C) location_actions
curl -X PUT "http://localhost:9200/tenpennynovels_location_actions" ...
```

**Verifica:**
```bash
curl http://localhost:9200/_cat/indices?v
```

---

### 3. Environment Variables

**Aggiungi a `.env` (locale):**
```bash
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX_PREFIX=tenpennynovels
```

**Aggiungi a `ecosystem.config.js` (VPS):**
```javascript
// embeddings-worker
env_production: {
  ELASTICSEARCH_URL: 'http://127.0.0.1:9200',
  ELASTICSEARCH_INDEX_PREFIX: 'tenpennynovels',
  // ... altre env vars
}
```

---

## 🔧 Modifica embeddings-worker

**File:** `services/embeddings-worker/src/workers/embedding-worker.ts`

**Aggiungi client ElasticSearch:**
```typescript
import { Client } from '@elastic/elasticsearch';

// Nel constructor
this.elasticsearch = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
});
```

**Modifica `saveDocumentChunkEmbedding`:**
```typescript
// Dopo salvataggio Qdrant, aggiungi:
await this.elasticsearch.index({
  index: 'tenpennynovels_document_chunks',
  id: event.chunkId,
  document: {
    chunkId: event.chunkId,
    documentId: event.documentId,
    slug: event.slug,
    heading: event.title,
    content: event.content,
    documentType: event.documentType,
    headingLevel: event.headingLevel,
    parentSlug: event.parentSlug,
    isActive: true,
    order: event.order
  }
});
```

---

## 🧪 Test Hybrid Search

**Keyword search (ElasticSearch):**
```bash
curl -X POST "http://localhost:9200/tenpennynovels_document_chunks/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "bool": {
        "should": [
          { "match": { "heading": "Caraibi" } },
          { "match": { "content": "Caraibi" } }
        ]
      }
    }
  }' | jq
```

**Semantic search (Qdrant) - già funzionante:**
```bash
curl "https://api.tenpennynovels.com/documents/semantic-search?q=vampiri&limit=5"
```

---

## 📦 Deployment Checklist

### Locale (Docker)
- [ ] `docker-compose up -d elasticsearch`
- [ ] Crea 3 indici ElasticSearch
- [ ] Aggiungi `ELASTICSEARCH_URL` a `.env`
- [ ] Modifica embeddings-worker per indicizzare su ElasticSearch
- [ ] Test keyword search

### VPS (Produzione)
- [ ] Installa ElasticSearch via apt
- [ ] Configura `/etc/elasticsearch/elasticsearch.yml`
- [ ] `sudo systemctl enable elasticsearch`
- [ ] Crea 3 indici ElasticSearch
- [ ] Aggiungi env vars a `ecosystem.config.js`
- [ ] Deploy embeddings-worker modificato
- [ ] `pm2 restart tenpennynovels-embeddings-worker`
- [ ] Test keyword + semantic search

---

## 🔍 Comandi Utili

**List indici:**
```bash
curl http://localhost:9200/_cat/indices?v
```

**Count documenti in indice:**
```bash
curl "http://localhost:9200/tenpennynovels_document_chunks/_count"
```

**Delete indice (reset):**
```bash
curl -X DELETE "http://localhost:9200/tenpennynovels_document_chunks"
```

**Health check:**
```bash
curl http://localhost:9200/_cluster/health | jq
```

---

## 📝 Note

- **ElasticSearch memory**: Default 512MB (`ES_JAVA_OPTS=-Xms512m -Xmx512m`)
- **Qdrant vs ElasticSearch**: Qdrant per semantic, ElasticSearch per keyword - complementari
- **Hybrid ranking**: TODO - implementare endpoint che combina score di entrambi
- **Reindexing**: Se modifichi mapping, devi delete + recreate indice + reindex data

---

## 🐛 Troubleshooting

**ElasticSearch not starting:**
```bash
# Check logs
docker logs tenpennynovels-elasticsearch
# O su VPS
sudo journalctl -u elasticsearch -f
```

**Index creation fails:**
```bash
# Verifica cluster health
curl http://localhost:9200/_cluster/health
# Se yellow/red, aumenta memory ES_JAVA_OPTS
```

**VPS out of memory:**
```bash
# Riduci heap ElasticSearch
sudo nano /etc/elasticsearch/jvm.options
# Set: -Xms256m -Xmx256m
```
