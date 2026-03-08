# Stage 1: Build React client
FROM node:22-alpine AS client-builder
WORKDIR /build/client
COPY tools/test-ui/client/package*.json ./
RUN npm install
COPY tools/test-ui/client/ ./
RUN npm run build

# Stage 2: Build Express server
FROM node:22-alpine AS server-builder
WORKDIR /build/server
COPY tools/test-ui/server/package*.json ./
RUN npm install
COPY tools/test-ui/server/ ./
RUN npx tsc

# Stage 3: Production
FROM node:22-alpine
WORKDIR /app/server
COPY tools/test-ui/server/package*.json ./
RUN npm install --omit=dev
COPY --from=server-builder /build/server/dist ./dist
COPY --from=client-builder /build/client/dist ../client/dist

EXPOSE 3100
CMD ["node", "dist/index.js"]
