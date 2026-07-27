# Node 22.6+ is required: the server runs TypeScript through native type
# stripping and stores state in the built-in node:sqlite — no build step for the
# server, no native modules.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
EXPOSE 8080
CMD ["node", "--disable-warning=ExperimentalWarning", "server/src/index.ts"]
