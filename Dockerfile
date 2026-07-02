# Stage 1: Builder
FROM node:20-alpine AS builder

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
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS runner

WORKDIR /app

# Install netcat for health check + fonts for SVG rendering
RUN apk add --no-cache netcat-openbsd bash fontconfig ttf-dejavu font-noto-emoji

# Copy standalone build output from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
COPY --from=builder /app/scripts ./scripts

# Copy production node_modules (runtime deps only)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin

# Create database initialization script
RUN echo '#!/bin/bash' > /entrypoint.sh && \
    echo 'echo "Waiting for database..."' >> /entrypoint.sh && \
    echo 'until nc -zv $DB_HOST 5432 2>/dev/null; do echo "Waiting..."; sleep 2; done' >> /entrypoint.sh && \
    echo 'echo "Database ready! Running migrations..."' >> /entrypoint.sh && \
    echo 'npx prisma migrate deploy 2>/dev/null || {' >> /entrypoint.sh && \
    echo '  echo "Migration deploy failed. Trying db_push transition..."' >> /entrypoint.sh && \
    echo '  npx prisma db push --accept-data-loss --skip-generate' >> /entrypoint.sh && \
    echo '  npx prisma migrate resolve --applied 0001_initial 2>/dev/null || true' >> /entrypoint.sh && \
    echo '  npx prisma migrate resolve --applied 0002_add_gamification_tables 2>/dev/null || true' >> /entrypoint.sh && \
    echo '  npx prisma migrate deploy' >> /entrypoint.sh && \
    echo '}' >> /entrypoint.sh && \
    echo 'echo "Seeding database..."' >> /entrypoint.sh && \
    echo 'npx tsx prisma/seed.ts' >> /entrypoint.sh && \
    echo 'echo "Starting application..."' >> /entrypoint.sh && \
    echo 'exec node server.js' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Worker entrypoint — waits for DB, applies migrations, skips seed to avoid race
RUN echo '#!/bin/bash' > /worker-entrypoint.sh && \
    echo 'echo "Worker waiting for database..."' >> /worker-entrypoint.sh && \
    echo 'until nc -zv $DB_HOST 5432 2>/dev/null; do echo "Waiting..."; sleep 2; done' >> /worker-entrypoint.sh && \
    echo 'echo "Database ready. Running migrations..."' >> /worker-entrypoint.sh && \
    echo 'npx prisma migrate deploy 2>/dev/null || {' >> /worker-entrypoint.sh && \
    echo '  echo "Migration deploy failed. Trying db_push transition..."' >> /worker-entrypoint.sh && \
    echo '  npx prisma db push --accept-data-loss --skip-generate' >> /worker-entrypoint.sh && \
    echo '  npx prisma migrate resolve --applied 0001_initial 2>/dev/null || true' >> /worker-entrypoint.sh && \
    echo '  npx prisma migrate resolve --applied 0002_add_gamification_tables 2>/dev/null || true' >> /worker-entrypoint.sh && \
    echo '  npx prisma migrate deploy' >> /worker-entrypoint.sh && \
    echo '}' >> /worker-entrypoint.sh && \
    echo 'echo "Starting worker..."' >> /worker-entrypoint.sh && \
    echo 'exec node server.js' >> /worker-entrypoint.sh && \
    chmod +x /worker-entrypoint.sh

# Install su-exec for running commands as different user
RUN apk add --no-cache su-exec

# Create non-root user for ownership (optional - can run as root)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Change ownership
RUN chown -R nextjs:nodejs /app

EXPOSE 9103

# Run as root for local testing
CMD ["/bin/bash", "-c", "/entrypoint.sh"]
