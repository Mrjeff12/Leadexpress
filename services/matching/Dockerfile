FROM node:20-slim AS builder
WORKDIR /app

# ── Step 1: Build @masterleadflow/shared ──
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/
RUN cd packages/shared && npm install && npx tsc

# ── Step 2: Install matching deps (excluding workspace dep) ──
COPY services/matching/package.json ./services/matching/
COPY services/matching/src ./services/matching/src
COPY services/matching/tsconfig.json ./services/matching/

WORKDIR /app/services/matching

# Remove workspace:* dep from package.json, install rest, then manually place shared
RUN node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
  delete pkg.dependencies['@masterleadflow/shared'];
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"
RUN npm install

# Manually install shared into node_modules
RUN mkdir -p node_modules/@masterleadflow && \
    cp -r /app/packages/shared node_modules/@masterleadflow/shared

# Build matching
RUN npx tsc

# ── Production image ──
FROM node:20-slim
WORKDIR /app/services/matching

ENV NODE_ENV=production

COPY --from=builder /app/services/matching/dist ./dist
COPY --from=builder /app/services/matching/package.json ./
COPY --from=builder /app/services/matching/node_modules ./node_modules

USER node

CMD ["node", "dist/index.js"]
