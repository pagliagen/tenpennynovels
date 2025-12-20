# TenpennyNovels Embeddings Worker Dockerfile
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    build-base \
    && ln -sf python3 /usr/bin/python

# Copy package files and source code
COPY services/embeddings-worker/package.json services/embeddings-worker/tsconfig.json ./
COPY services/embeddings-worker/src ./src

# Install dependencies
RUN npm install

# Build TypeScript
RUN npm run build

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD ps aux | grep -q "[n]ode.*embeddings-worker" || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV MONGODB_URI=mongodb://tenpennynovels-mongodb:27017/tenpennynovels
ENV REDIS_URL=redis://tenpennynovels-redis:6379
ENV EMBEDDINGS_SERVICE_URL=http://tenpennynovels-embeddings:5001

# Run the worker
CMD ["node", "dist/index.js"]
