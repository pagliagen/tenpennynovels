# =============================================================================
# CDN Service - Production Dockerfile
# =============================================================================
FROM node:22-alpine

# Install Sharp dependencies
RUN apk add --no-cache \
    build-base \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Create storage directory
RUN mkdir -p /cdn-storage

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=20s \
  CMD node -e "require('http').get('http://localhost:${PORT:-4002}/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Expose port
EXPOSE 4002

# Start server
CMD ["node", "dist/index.js"]
