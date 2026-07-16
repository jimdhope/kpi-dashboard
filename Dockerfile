# Stage 1: Builder
FROM node:22.15.0-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client (needs a DATABASE_URL)
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kpi_quest_v3"
RUN npx prisma generate

# Build Next.js app
RUN BETTER_AUTH_SECRET=build-only-secret-not-used-at-runtime-000000000000 \
    BETTER_AUTH_URL=http://localhost:9103 \
    PASSKEY_RP_ID=localhost \
    npm run build

# Bundle the background worker so the runtime does not need the TypeScript toolchain.
RUN ./node_modules/.bin/esbuild src/server/jobs/worker.ts --bundle --platform=node --format=esm \
    --external:@prisma/client --external:pg '--external:*.node' --outfile=/app/worker.mjs

# Bundle the one-time authentication cutover utility for an explicitly enabled
# production migration. Better Auth's password hashing code is included in the
# bundle; Prisma and PostgreSQL use the runtime packages already in the image.
RUN ./node_modules/.bin/esbuild scripts/auth-cutover.ts --bundle --platform=node --format=cjs \
    --external:@prisma/client --external:pg '--external:*.node' --outfile=/app/auth-cutover.cjs

# Keep migration tooling separate from the application's dependency tree.
FROM node:22.15.0-alpine AS migration-tools
RUN npm install --prefix /opt/prisma --omit=dev prisma@7.8.0 tsx@4.23.1 dotenv@17.3.1

# Stage 2: Production
FROM node:22.15.0-alpine AS runner

WORKDIR /app
ENV NODE_PATH="/opt/prisma/node_modules"

# Install netcat for health check + fonts for SVG rendering
RUN apk add --no-cache netcat-openbsd bash fontconfig ttf-dejavu font-noto-emoji postgresql-client

# Copy standalone build output from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./
COPY --from=builder /app/worker.mjs ./worker.mjs
COPY --from=builder /app/auth-cutover.cjs ./auth-cutover.cjs

# Prisma's migration command is deliberately isolated from the web dependency tree.
COPY --from=migration-tools /opt/prisma/node_modules /opt/prisma/node_modules

# Create database initialization script
RUN echo '#!/bin/bash' > /entrypoint.sh && \
    echo 'set -Eeuo pipefail' >> /entrypoint.sh && \
    echo 'echo "Waiting for database..."' >> /entrypoint.sh && \
    echo 'until nc -zv $DB_HOST 5432 2>/dev/null; do echo "Waiting..."; sleep 2; done' >> /entrypoint.sh && \
    echo 'if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then' >> /entrypoint.sh && \
    echo '  echo "Database ready! Running migrations..."' >> /entrypoint.sh && \
    echo '  /opt/prisma/node_modules/.bin/prisma migrate deploy' >> /entrypoint.sh && \
    echo 'fi' >> /entrypoint.sh && \
    echo 'if [ "${RUN_AUTH_CUTOVER:-false}" = "true" ]; then' >> /entrypoint.sh && \
    echo '  echo "Running explicitly enabled Better Auth cutover..."' >> /entrypoint.sh && \
    echo '  node auth-cutover.cjs' >> /entrypoint.sh && \
    echo '  echo "Authentication cutover complete. Remove RUN_AUTH_CUTOVER and the CUTOVER_ADMIN_* variables from Portainer, then redeploy the stack."' >> /entrypoint.sh && \
    echo 'fi' >> /entrypoint.sh && \
    echo 'if [ "${RUN_SEED_ON_STARTUP:-false}" = "true" ]; then' >> /entrypoint.sh && \
    echo '  echo "Running explicitly enabled database seed..."' >> /entrypoint.sh && \
    echo '  /opt/prisma/node_modules/.bin/tsx prisma/seed.ts' >> /entrypoint.sh && \
    echo 'fi' >> /entrypoint.sh && \
    echo 'echo "Starting application..."' >> /entrypoint.sh && \
    echo 'exec node server.js' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Worker entrypoint — waits for DB, applies migrations, skips seed to avoid race
RUN echo '#!/bin/bash' > /worker-entrypoint.sh && \
    echo 'set -Eeuo pipefail' >> /worker-entrypoint.sh && \
    echo 'echo "Worker waiting for database..."' >> /worker-entrypoint.sh && \
    echo 'until nc -zv $DB_HOST 5432 2>/dev/null; do echo "Waiting..."; sleep 2; done' >> /worker-entrypoint.sh && \
    echo 'echo "Worker waiting for the migrated application..."' >> /worker-entrypoint.sh && \
    echo 'until nc -zv ${APP_HOST:-app} 9103 2>/dev/null; do echo "Waiting for application..."; sleep 2; done' >> /worker-entrypoint.sh && \
    echo 'echo "Starting worker..."' >> /worker-entrypoint.sh && \
    echo 'exec node worker.mjs' >> /worker-entrypoint.sh && \
    chmod +x /worker-entrypoint.sh

# Install su-exec for running commands as different user
RUN apk add --no-cache su-exec

# Create non-root user for ownership (optional - can run as root)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Change ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 9103

CMD ["/bin/bash", "-c", "/entrypoint.sh"]
