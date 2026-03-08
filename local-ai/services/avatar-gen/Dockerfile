FROM node:22-alpine AS builder
WORKDIR /app/services/avatar-gen
COPY services/avatar-gen/package.json ./
RUN npm install
RUN ln -s /app/services/avatar-gen/node_modules /app/node_modules
COPY tsconfig.base.json /app/
COPY shared/health.ts shared/logger.ts shared/types.ts /app/shared/
COPY services/avatar-gen/tsconfig.json ./
COPY services/avatar-gen/src/ ./src/
RUN npx tsc

FROM node:22-alpine
WORKDIR /app/services/avatar-gen
COPY services/avatar-gen/package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/services/avatar-gen/dist ./dist
EXPOSE 8120
CMD ["node", "dist/services/avatar-gen/src/index.js"]
