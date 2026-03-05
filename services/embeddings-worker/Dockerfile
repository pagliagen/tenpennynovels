# =============================================================================
# TenpennyNovels Embeddings Worker (Unified) - Single-stage Dockerfile
# Python base + Node.js (Debian-based for PyTorch compatibility)
# =============================================================================

FROM python:3.12-slim

WORKDIR /app

# Install Node.js 22.x from NodeSource
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY python/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Pre-download HuggingFace model to cache
ARG HF_TOKEN
ENV HF_TOKEN=${HF_TOKEN}
RUN python3 -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"

# Copy Python scripts
COPY python/ /app/python

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
