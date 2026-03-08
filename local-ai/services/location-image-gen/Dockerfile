FROM node:22-alpine AS builder
WORKDIR /app/services/location-image-gen
COPY services/location-image-gen/package.json ./
RUN npm install
RUN ln -s /app/services/location-image-gen/node_modules /app/node_modules
COPY tsconfig.base.json /app/
COPY shared/health.ts shared/logger.ts shared/types.ts /app/shared/
COPY services/location-image-gen/tsconfig.json ./
COPY services/location-image-gen/src/ ./src/
RUN npx tsc

FROM node:22-alpine
WORKDIR /app/services/location-image-gen
COPY services/location-image-gen/package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/services/location-image-gen/dist ./dist
EXPOSE 8110
CMD ["node", "dist/services/location-image-gen/src/index.js"]
