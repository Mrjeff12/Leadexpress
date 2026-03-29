FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile 2>/dev/null || npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build 2>/dev/null || pnpm build
CMD ["node", "dist/index.js"]
