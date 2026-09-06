# =============================================================================
# TenPennyNovels - API Gateway Dockerfile (dev container, hot-reload via tsx)
# In produzione il gateway gira via PM2 sull'host, non da questa immagine.
# =============================================================================

FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies dal lockfile (versioni bloccate — S8543).
# tsx è già in devDependencies: niente `npm install -g`.
RUN npm ci

# Copy source code (esplicito: niente COPY . . — S6470)
COPY tsconfig.json ./
COPY src ./src

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start with tsx for hot-reload in dev mode
CMD ["./node_modules/.bin/tsx", "watch", "src/index.ts"]
