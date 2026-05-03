# Multi-stage Docker build for sendoc-collab.
# Stage 1: install + compile TS to JS.
# Stage 2: minimal runtime image with prod deps only.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
EXPOSE 1234
CMD ["node", "dist/server.js"]
