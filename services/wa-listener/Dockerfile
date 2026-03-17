FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- production image ----
FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Create session persistence directory
RUN mkdir -p /data/sessions

VOLUME ["/data/sessions"]

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD node -e "process.exit(0)"

USER node

CMD ["node", "dist/index.js"]
