FROM node:22-alpine AS builder
WORKDIR /app/services/qa
COPY services/qa/package.json ./
RUN npm install
RUN ln -s /app/services/qa/node_modules /app/node_modules
COPY tsconfig.base.json /app/
COPY shared/ /app/shared/
COPY services/qa/tsconfig.json ./
COPY services/qa/src/ ./src/
RUN npx tsc

FROM node:22-alpine
WORKDIR /app/services/qa
COPY services/qa/package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/services/qa/dist ./dist
EXPOSE 8090
CMD ["node", "dist/services/qa/src/index.js"]
