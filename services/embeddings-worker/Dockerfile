# =============================================================================
# TenpennyNovels Embeddings Worker (Unified) - Multi-stage Dockerfile
# Includes: Node.js + Python + sentence-transformers
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Python Base - Install ML dependencies
# -----------------------------------------------------------------------------
FROM python:3.11-slim AS python-base

WORKDIR /app/python

# Install Python dependencies
COPY python/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# HuggingFace token (optional - for rate limits and private models)
ARG HF_TOKEN
ENV HF_TOKEN=${HF_TOKEN}

# Pre-download sentence-transformers model to cache
# This prevents download at runtime and fixes the "20 restarts" issue
RUN python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"

# Copy Python scripts
COPY python/ .

# -----------------------------------------------------------------------------
# Stage 2: Node.js Final - Application runtime
# -----------------------------------------------------------------------------
FROM node:22-alpine

WORKDIR /app

# Install Python3 runtime in Node image (no build tools needed)
RUN apk add --no-cache python3 py3-pip

# Copy Python environment from python-base stage
COPY --from=python-base /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
# Alpine uses Python 3.12, so copy packages there too
COPY --from=python-base /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=python-base /root/.cache/huggingface /root/.cache/huggingface
COPY --from=python-base /app/python /app/python

# Copy Node.js application files
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Build TypeScript
RUN npm run build

# Prune devDependencies after build (keep only production deps)
RUN npm prune --production

# Expose HTTP port
EXPOSE 5001

# Health check - verify HTTP endpoint responds
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Environment variables (can be overridden in docker-compose.yml)
ENV NODE_ENV=production
ENV HTTP_PORT=5001
ENV PYTHON_PATH=python3
ENV MONGODB_URI=mongodb://mongodb:27017/tenpennynovels
ENV REDIS_URL=redis://redis:6379
ENV QDRANT_URL=http://qdrant:6333
ENV LOG_LEVEL=info
ENV HF_TOKEN=${HF_TOKEN}

# Start unified embeddings service
CMD ["node", "dist/index.js"]
