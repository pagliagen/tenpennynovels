FROM node:24-alpine AS builder
WORKDIR /app/services/character-gen
COPY services/character-gen/package.json ./
RUN npm install
RUN ln -s /app/services/character-gen/node_modules /app/node_modules
COPY tsconfig.base.json /app/
COPY shared/ /app/shared/
COPY services/character-gen/tsconfig.json ./
COPY services/character-gen/src/ ./src/
RUN npx tsc

FROM node:24-alpine
WORKDIR /app/services/character-gen
COPY services/character-gen/package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/services/character-gen/dist ./dist
RUN chown -R node:node /app
USER node
EXPOSE 8130
CMD ["node", "dist/services/character-gen/src/index.js"]
