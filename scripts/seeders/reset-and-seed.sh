#!/bin/bash

set -e  # Exit on error

echo "🧹 Cleaning database and vector stores..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# MongoDB connection
MONGO_HOST="localhost:27017"
MONGO_DB="tenpennynovels"
MONGO_USER="admin"
MONGO_PASS="admin123"
MONGO_URI="mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_HOST}/${MONGO_DB}?authSource=admin"

# Vector store URLs
QDRANT_URL="http://localhost:6333"
ELASTIC_URL="http://localhost:9200"

echo -e "${YELLOW}📦 Step 1: Dropping MongoDB collections...${NC}"
docker exec tenpennynovels-mongodb mongosh "${MONGO_URI}" --quiet --eval "
  db.documents.drop();
  db.documentchunks.drop();
  db.documentsubtypes.drop();
  db.locations.drop();
  print('✅ MongoDB collections dropped');
" || echo -e "${RED}⚠️  MongoDB cleanup failed (collections may not exist)${NC}"

echo ""
echo -e "${YELLOW}🔍 Step 2: Deleting Qdrant collections...${NC}"
curl -X DELETE "${QDRANT_URL}/collections/document_chunks" 2>/dev/null || echo -e "${RED}⚠️  Qdrant document_chunks collection not found${NC}"
curl -X DELETE "${QDRANT_URL}/collections/locations" 2>/dev/null || echo -e "${RED}⚠️  Qdrant locations collection not found${NC}"
curl -X DELETE "${QDRANT_URL}/collections/location_actions" 2>/dev/null || echo -e "${RED}⚠️  Qdrant location_actions collection not found${NC}"
echo -e "${GREEN}✅ Qdrant collections deleted${NC}"

echo ""
echo -e "${YELLOW}🔎 Step 3: Deleting ElasticSearch indices...${NC}"
curl -X DELETE "${ELASTIC_URL}/tenpennynovels_document_chunks" 2>/dev/null || echo -e "${RED}⚠️  ES document_chunks index not found${NC}"
curl -X DELETE "${ELASTIC_URL}/tenpennynovels_locations" 2>/dev/null || echo -e "${RED}⚠️  ES locations index not found${NC}"
curl -X DELETE "${ELASTIC_URL}/tenpennynovels_location_actions" 2>/dev/null || echo -e "${RED}⚠️  ES location_actions index not found${NC}"
echo -e "${GREEN}✅ ElasticSearch indices deleted${NC}"

echo ""
echo -e "${YELLOW}🔄 Step 4: Restarting embeddings-worker (recreates collections)...${NC}"
docker compose restart embeddings-worker
echo "   Waiting for worker to initialize..."
sleep 10

echo ""
echo -e "${YELLOW}⏳ Step 5: Waiting for embeddings-worker to be ready...${NC}"
echo "   Checking worker status..."
for i in {1..30}; do
  if docker logs tenpennynovels-embeddings-worker 2>&1 | tail -50 | grep -q "Embedding worker started"; then
    echo -e "${GREEN}   ✅ Worker is ready!${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}   ⚠️  Worker not ready after 30s, proceeding anyway...${NC}"
  fi
  sleep 1
done

echo ""
echo -e "${YELLOW}🌱 Step 6: Seeding documents...${NC}"
npm run seed:dev:documents
  
echo ""
echo -e "${GREEN}✅ Reset and seed complete!${NC}"
echo ""
echo -e "${BLUE}🔍 Test semantic search:${NC}"
echo "curl -s \"http://localhost:8000/documents/semantic-search?q=Vampiri&limit=5\" | jq"
