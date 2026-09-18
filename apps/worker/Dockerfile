# Worker — Stock Analyst (Discord bot + scheduler + trade engine)
# Multi-stage build: build TS → runtime minimal

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/engine/package.json packages/engine/package.json
RUN npm install --workspace @stock-analyst/worker

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate
RUN npm run build --workspace @stock-analyst/worker

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/worker/package.json ./apps/worker/package.json

USER node
CMD ["node", "apps/worker/dist/index.js"]