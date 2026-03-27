FROM node:20-slim AS builder
WORKDIR /app

RUN corepack enable

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy shared package + matching service
COPY packages/shared/ ./packages/shared/
COPY services/matching/ ./services/matching/

# Install deps for all copied packages (shared + matching)
RUN pnpm install --no-frozen-lockfile

# Build shared first, then matching
RUN pnpm --filter @masterleadflow/shared run build
RUN pnpm --filter @masterleadflow/matching run build

# ---- production image ----
FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable

# Copy workspace structure needed at runtime
COPY --from=builder /app/pnpm-workspace.yaml /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/services/matching/dist ./services/matching/dist
COPY --from=builder /app/services/matching/package.json ./services/matching/package.json
COPY --from=builder /app/node_modules ./node_modules

WORKDIR /app/services/matching

USER node

CMD ["node", "dist/index.js"]
