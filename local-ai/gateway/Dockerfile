FROM node:22-alpine AS builder
WORKDIR /app/gateway
COPY gateway/package.json ./
RUN npm install
COPY tsconfig.base.json /app/
COPY gateway/tsconfig.json ./
COPY gateway/src/ ./src/
RUN npx tsc

FROM node:22-alpine
WORKDIR /app/gateway
COPY gateway/package.json ./
RUN npm install --omit=dev
COPY patches/ ../patches/
RUN npx patch-package --patch-dir ../patches
COPY --from=builder /app/gateway/dist ./dist
EXPOSE 9000
CMD ["node", "dist/index.js"]
