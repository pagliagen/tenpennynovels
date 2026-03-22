# Semantic Search - Quick Reference

Comandi rapidi per operazioni comuni con Qdrant + ElasticSearch + embeddings-worker.

---

## 🚀 Quick Start

```bash
# Health checks
curl http://127.0.0.1:6333/                  # Qdrant
curl http://127.0.0.1:9200/                  # ElasticSearch
curl http://127.0.0.1:5001/health            # Embeddings worker

# PM2 status
pm2 status tenpennynovels-embeddings-worker
```

---

## 🐳 Docker Commands

### Qdrant

```bash
# Status
docker ps | grep qdrant

# Logs
docker logs -f qdrant

# Restart
docker restart qdrant

# Stop/Start
docker stop qdrant
docker start qdrant

# Remove and recreate
docker rm -f qdrant
docker run -d --name qdrant --restart unless-stopped \
  -p 6333:6333 -v ~/qdrant_storage:/qdrant/storage:z \
  qdrant/qdrant:v1.17.0
```

### ElasticSearch

```bash
# Status
docker ps | grep elasticsearch

# Logs
docker logs -f elasticsearch

# Restart
docker restart elasticsearch

# Remove and recreate
docker rm -f elasticsearch
docker run -d --name elasticsearch --restart unless-stopped \
  -p 9200:9200 -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" -e "ES_JAVA_OPTS=-Xms1g -Xmx1g" \
  -v ~/elasticsearch_data:/usr/share/elasticsearch/data:z \
  docker.elastic.co/elasticsearch/elasticsearch:8.11.0
```

---

## 📊 Statistics

### Qdrant

```bash
# List collections
curl http://127.0.0.1:6333/collections | jq '.result.collections[].name'

# Collection info
curl http://127.0.0.1:6333/collections/forum_posts | jq '.result.points_count'
curl http://127.0.0.1:6333/collections/chat_messages | jq '.result.points_count'
curl http://127.0.0.1:6333/collections/document_chunks | jq '.result.points_count'

# All counts
for coll in forum_posts chat_messages document_chunks; do
  echo -n "$coll: "
  curl -s http://127.0.0.1:6333/collections/$coll | jq -r '.result.points_count'
done
```

### ElasticSearch

```bash
# List indices
curl http://127.0.0.1:9200/_cat/indices?v

# Index counts
curl http://127.0.0.1:9200/tenpennynovels_forum_posts/_count | jq '.count'
curl http://127.0.0.1:9200/tenpennynovels_chat_messages/_count | jq '.count'
curl http://127.0.0.1:9200/tenpennynovels_document_chunks/_count | jq '.count'

# Cluster health
curl http://127.0.0.1:9200/_cluster/health | jq '.status'
```

---

## 🧪 Testing

### Generate Embedding

```bash
curl -X POST http://127.0.0.1:5001/embed \
  -H "Content-Type: application/json" \
  -d '{"text":"test message"}' | jq '.dimensions'
```

### Semantic Search (Forum)

```bash
curl -X POST http://127.0.0.1:5001/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "background story",
    "source": "forum",
    "limit": 10,
    "filters": {
      "topicSlug": "ambientazione"
    }
  }' | jq '.results | length'
```

### Semantic Search (Chat)

```bash
curl -X POST http://127.0.0.1:5001/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "investigate murder",
    "source": "chat",
    "limit": 10,
    "filters": {
      "locationId": "660a1b2c3d4e5f6a7b8c9d0e",
      "dateStart": "2025-01-01",
      "dateEnd": "2025-12-31"
    }
  }' | jq '.results | length'
```

---

## 🔧 Maintenance

### Clean Old Data

```bash
# Delete old ElasticSearch index
curl -X DELETE http://127.0.0.1:9200/tenpennynovels_old_index

# Delete Qdrant collection
curl -X DELETE http://127.0.0.1:6333/collections/old_collection
```

### Recreate Collection

```bash
# Delete
curl -X DELETE http://127.0.0.1:6333/collections/forum_posts

# Recreate (auto-created by embeddings-worker on next event)
pm2 restart tenpennynovels-embeddings-worker
```

### Force Merge (ElasticSearch)

```bash
# Optimize after bulk indexing
curl -X POST http://127.0.0.1:9200/tenpennynovels_forum_posts/_forcemerge?max_num_segments=1
```

---

## 🐛 Troubleshooting

### Embeddings Worker Not Processing

```bash
# Check logs
pm2 logs tenpennynovels-embeddings-worker --lines 50

# Check Bull queue
redis-cli LLEN bull:embeddings:waiting
redis-cli LLEN bull:embeddings:active
redis-cli LLEN bull:embeddings:failed

# Clear failed jobs
redis-cli DEL bull:embeddings:failed

# Restart
pm2 restart tenpennynovels-embeddings-worker
```

### Qdrant Connection Refused

```bash
# Check container
docker ps | grep qdrant

# Check logs
docker logs qdrant

# Restart
docker restart qdrant

# Test connection
curl http://127.0.0.1:6333/
```

### ElasticSearch Yellow/Red Status

```bash
# Check health
curl http://127.0.0.1:9200/_cluster/health?pretty

# Check unassigned shards
curl http://127.0.0.1:9200/_cat/shards?v | grep UNASSIGNED

# Force allocation (single-node cluster)
curl -X PUT http://127.0.0.1:9200/_cluster/settings \
  -H "Content-Type: application/json" \
  -d '{"transient":{"cluster.routing.allocation.enable":"all"}}'
```

### Python Embeddings Not Loading

```bash
cd ~/tenpennynovels/services/embeddings-worker/python

# Activate venv
source venv/bin/activate

# Test import
python -c "from sentence_transformers import SentenceTransformer; print('OK')"

# Reinstall if needed
pip install --upgrade pip
pip install -r requirements.txt

deactivate
pm2 restart tenpennynovels-embeddings-worker
```

---

## 📦 Backup

### Quick Backup

```bash
# Qdrant (create snapshot)
curl -X POST http://127.0.0.1:6333/snapshots \
  -H "Content-Type: application/json" \
  -d '{"name":"backup_'$(date +%Y%m%d)'"}'

# Copy to backup dir
mkdir -p ~/backups/qdrant/$(date +%Y%m%d)
cp -r ~/qdrant_storage/snapshots/* ~/backups/qdrant/$(date +%Y%m%d)/

# ElasticSearch (stop container, copy data)
docker stop elasticsearch
cp -r ~/elasticsearch_data ~/backups/elasticsearch/$(date +%Y%m%d)
docker start elasticsearch
```

### Restore

```bash
# Qdrant
docker stop qdrant
rm -rf ~/qdrant_storage/*
cp -r ~/backups/qdrant/20260322/* ~/qdrant_storage/
docker start qdrant

# ElasticSearch
docker stop elasticsearch
rm -rf ~/elasticsearch_data/*
cp -r ~/backups/elasticsearch/20260322/* ~/elasticsearch_data/
docker start elasticsearch
```

---

## 📈 Monitoring

### Resource Usage

```bash
# Docker stats
docker stats --no-stream qdrant elasticsearch

# Disk usage
du -sh ~/qdrant_storage
du -sh ~/elasticsearch_data

# PM2 memory
pm2 show tenpennynovels-embeddings-worker | grep memory
```

### Logs

```bash
# Embeddings worker (real-time)
pm2 logs tenpennynovels-embeddings-worker

# Qdrant (last 100 lines)
docker logs --tail 100 qdrant

# ElasticSearch (last 100 lines)
docker logs --tail 100 elasticsearch
```

---

## 🔑 Key Endpoints

### Embeddings Worker

- `GET /health` - Health check
- `POST /embed` - Generate embedding
- `POST /search` - Hybrid semantic + keyword search

### Qdrant

- `GET /` - Version info
- `GET /healthz` - Health check
- `GET /collections` - List collections
- `GET /collections/{name}` - Collection info
- `POST /collections/{name}/points/search` - Vector search
- `POST /snapshots` - Create snapshot

### ElasticSearch

- `GET /` - Cluster info
- `GET /_cluster/health` - Cluster health
- `GET /_cat/indices?v` - List indices
- `GET /{index}/_count` - Document count
- `GET /{index}/_mapping` - Index mapping
- `POST /{index}/_search` - Full-text search

---

## 🎯 Common Tasks

### Add New Search Source

1. Update `services/embeddings-worker/src/types/events.ts` - Add event type
2. Update `services/embeddings-worker/src/workers/embedding-worker.ts` - Add handler
3. Update `services/embeddings-worker/src/http/EmbeddingsHttpServer.ts` - Add search methods
4. Update `services/unified-backend` - Add controller endpoint

### Reindex All Data

```bash
# Forum posts (publish Redis events for all posts)
mongo tenpennynovels --eval '
  db.forum_posts.find({isDeleted:false}).forEach(function(post) {
    db.redis_events.insert({
      channel: "embedding:forum_post:created",
      data: post,
      timestamp: new Date()
    });
  });
'

# Then embeddings-worker will process the queue
```

### Performance Tuning

```bash
# Qdrant - increase HNSW parameters
curl -X PATCH http://127.0.0.1:6333/collections/forum_posts \
  -H "Content-Type: application/json" \
  -d '{"hnsw_config":{"ef_construct":200,"m":16}}'

# ElasticSearch - increase refresh interval
curl -X PUT http://127.0.0.1:9200/tenpennynovels_forum_posts/_settings \
  -H "Content-Type: application/json" \
  -d '{"index":{"refresh_interval":"30s"}}'
```

---

**Full Documentation**: [08 - Semantic Search Setup](./08-semantic-search-setup.md)
