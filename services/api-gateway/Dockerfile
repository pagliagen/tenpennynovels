# =============================================================================
# TenpennyNovels - API Gateway Dockerfile
# =============================================================================

FROM node:22-alpine

# Install global tools for development
RUN npm install -g tsx nodemon

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for tsx)
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start with tsx for hot-reload in dev mode
CMD ["tsx", "watch", "src/index.ts"]
