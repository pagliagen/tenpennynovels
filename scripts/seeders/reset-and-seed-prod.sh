#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Production MongoDB (no auth, db name = tenpennynovels)
MONGO_URI="mongodb://127.0.0.1:27017/tenpennynovels"

# Vector store URLs (servizi nativi, no Docker)
QDRANT_URL="http://127.0.0.1:6333"
ELASTIC_URL="http://127.0.0.1:9200"

# PM2 process name
EMBEDDINGS_WORKER_PM2="tenpennynovels-embeddings-worker"

echo ""
echo -e "${RED}⚠️  ATTENZIONE: Stai per resettare il database di PRODUZIONE!${NC}"
echo -e "${RED}   Questo cancellerà TUTTI i documenti, locations e vector stores.${NC}"
echo ""
read -p "Sei sicuro di voler continuare? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "❌ Operazione annullata."
  exit 0
fi

echo ""
echo "🧹 Cleaning production database and vector stores..."
echo ""

echo -e "${YELLOW}📦 Step 1: Dropping MongoDB collections...${NC}"
mongosh "${MONGO_URI}" --quiet --eval "
  db.documents.drop();
  db.documentchunks.drop();
  db.documentsubtypes.drop();
  db.locations.drop();
  print('✅ MongoDB collections dropped');
" || echo -e "${RED}⚠️  MongoDB cleanup failed (collections may not exist)${NC}"

echo ""
echo -e "${YELLOW}🔍 Step 2: Deleting Qdrant collections...${NC}"
curl -s -X DELETE "${QDRANT_URL}/collections/document_chunks" 2>/dev/null || echo -e "${RED}⚠️  Qdrant document_chunks collection not found${NC}"
curl -s -X DELETE "${QDRANT_URL}/collections/locations" 2>/dev/null || echo -e "${RED}⚠️  Qdrant locations collection not found${NC}"
curl -s -X DELETE "${QDRANT_URL}/collections/location_actions" 2>/dev/null || echo -e "${RED}⚠️  Qdrant location_actions collection not found${NC}"
echo ""
echo -e "${GREEN}✅ Qdrant collections deleted${NC}"

echo ""
echo -e "${YELLOW}🔎 Step 3: Deleting ElasticSearch indices...${NC}"
curl -s -X DELETE "${ELASTIC_URL}/tenpennynovels_document_chunks" 2>/dev/null || echo -e "${RED}⚠️  ES document_chunks index not found${NC}"
curl -s -X DELETE "${ELASTIC_URL}/tenpennynovels_locations" 2>/dev/null || echo -e "${RED}⚠️  ES locations index not found${NC}"
curl -s -X DELETE "${ELASTIC_URL}/tenpennynovels_location_actions" 2>/dev/null || echo -e "${RED}⚠️  ES location_actions index not found${NC}"
echo ""
echo -e "${GREEN}✅ ElasticSearch indices deleted${NC}"

echo ""
echo -e "${YELLOW}🔄 Step 4: Restarting embeddings-worker via PM2 (recreates collections)...${NC}"
pm2 restart "${EMBEDDINGS_WORKER_PM2}"
echo "   Waiting for worker to initialize..."
sleep 10

echo ""
echo -e "${YELLOW}⏳ Step 5: Waiting for embeddings-worker to be ready...${NC}"
echo "   Checking worker status..."
for i in {1..30}; do
  if pm2 logs "${EMBEDDINGS_WORKER_PM2}" --nostream --lines 50 2>&1 | grep -q "Embedding worker started"; then
    echo -e "${GREEN}   ✅ Worker is ready!${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}   ⚠️  Worker not ready after 30s, proceeding anyway...${NC}"
  fi
  sleep 1
done

echo ""
echo -e "${YELLOW}🌱 Step 6: Seeding documents (production)...${NC}"
npm run seed:prod:documents

echo ""
echo -e "${GREEN}✅ Reset and seed complete (PRODUCTION)!${NC}"
echo ""
echo -e "${BLUE}🔍 Test semantic search:${NC}"
echo "curl -s \"https://api.tenpennynovels.com/documents/semantic-search?q=Vampiri&limit=5\" | jq"
