FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 DATABASE_PATH=/app/data/ems.sqlite
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3001
VOLUME ["/app/data"]
CMD ["node", "server/index.js"]
