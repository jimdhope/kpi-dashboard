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

# Install netcat for health check
RUN apk add --no-cache netcat-openbsd bash

# Copy standalone build output from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

# Copy production node_modules (runtime deps only)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Create database initialization script
RUN echo '#!/bin/bash' > /entrypoint.sh && \
    echo 'echo "Waiting for database..."' >> /entrypoint.sh && \
    echo 'until nc -zv $DB_HOST 5432 2>/dev/null; do echo "Waiting..."; sleep 2; done' >> /entrypoint.sh && \
    echo 'echo "Database ready! Running prisma db push..."' >> /entrypoint.sh && \
    echo 'npx prisma db push --url "$DATABASE_URL"' >> /entrypoint.sh && \
    echo 'echo "Starting application as nextjs user..."' >> /entrypoint.sh && \
    echo 'exec su-exec nextjs node server.js' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Install su-exec for running commands as different user
RUN apk add --no-cache su-exec

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Change ownership for security
RUN chown -R nextjs:nodejs /app

# Switch to non-root user (after creating entrypoint)
USER nextjs

EXPOSE 9103

# Override CMD to run entrypoint as root, then switch to nextjs
CMD ["/bin/bash", "-c", "/entrypoint.sh"]
