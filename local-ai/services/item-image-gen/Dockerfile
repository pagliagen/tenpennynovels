FROM node:22-alpine AS builder
WORKDIR /app/services/item-image-gen
COPY services/item-image-gen/package.json ./
RUN npm install
RUN ln -s /app/services/item-image-gen/node_modules /app/node_modules
COPY tsconfig.base.json /app/
COPY shared/health.ts shared/logger.ts shared/types.ts /app/shared/
COPY services/item-image-gen/tsconfig.json ./
COPY services/item-image-gen/src/ ./src/
RUN npx tsc

FROM node:22-alpine
WORKDIR /app/services/item-image-gen
COPY services/item-image-gen/package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/services/item-image-gen/dist ./dist
EXPOSE 8100
CMD ["node", "dist/services/item-image-gen/src/index.js"]
