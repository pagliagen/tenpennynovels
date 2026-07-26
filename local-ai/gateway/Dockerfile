FROM node:24-alpine AS builder
WORKDIR /app/gateway
COPY gateway/package.json ./
RUN npm install
COPY tsconfig.base.json /app/
COPY gateway/tsconfig.json ./
COPY gateway/src/ ./src/
RUN npx tsc

FROM node:24-alpine
WORKDIR /app/gateway
COPY gateway/package.json ./
RUN npm install --omit=dev
COPY patches/ ../patches/
RUN npx patch-package --patch-dir ../patches
COPY --from=builder /app/gateway/dist ./dist
RUN chown -R node:node /app
USER node
EXPOSE 9000
CMD ["node", "dist/index.js"]
