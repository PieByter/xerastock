# Web dashboard — Stock Analyst (Next.js standalone)
# Multi-stage build: deps → build → runtime minimal

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/engine/package.json packages/engine/package.json
RUN npm install --workspace @stock-analyst/web

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Middleware membaca env ini saat build — set sebelum build agar login aktif.
ARG DASHBOARD_PASSWORD=""
ENV DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD
RUN npm run db:generate
RUN npm run build --workspace @stock-analyst/web

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Output standalone sudah memuat server + dependency yang dipakai.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
