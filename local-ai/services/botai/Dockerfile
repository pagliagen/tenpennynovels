FROM node:22-alpine AS builder
WORKDIR /app/services/botai
COPY services/botai/package.json ./
RUN npm install
RUN ln -s /app/services/botai/node_modules /app/node_modules
COPY tsconfig.base.json /app/
COPY shared/ /app/shared/
COPY services/botai/tsconfig.json ./
COPY services/botai/src/ ./src/
RUN npx tsc

FROM node:22-alpine
WORKDIR /app/services/botai
COPY services/botai/package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/services/botai/dist ./dist
RUN chown -R node:node /app
USER node
EXPOSE 8080
CMD ["node", "dist/services/botai/src/index.js"]
