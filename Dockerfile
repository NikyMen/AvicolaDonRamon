# ---- Base con pnpm + dependencias de Prisma ----
FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable
WORKDIR /app

# ---- Dependencias (con caché) ----
FROM base AS deps
# Copiamos el schema antes de instalar porque el postinstall corre "prisma generate".
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
# Cache mount del store de pnpm: reusa paquetes ya bajados entre builds.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# ---- Build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm exec prisma generate
# Cache mount de .next/cache: Next reusa la compilación previa → build incremental.
RUN --mount=type=cache,id=next-cache,target=/app/.next/cache \
    pnpm run build

# ---- Runner (app + deps para poder correr migraciones/seed) ----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
