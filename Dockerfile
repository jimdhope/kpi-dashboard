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
RUN apk add --no-cache netcat-openbsd

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=9103

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
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'echo "Waiting for database..."' >> /entrypoint.sh && \
    echo 'until nc -z $DB_HOST 5432; do sleep 1; done' >> /entrypoint.sh && \
    echo 'echo "Database ready! Running migrations..."' >> /entrypoint.sh && \
    echo 'npx prisma db push --skip-generate' >> /entrypoint.sh && \
    echo 'echo "Starting application..."' >> /entrypoint.sh && \
    echo 'exec node server.js' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Change ownership for security
RUN chown nextjs:nodejs /app

# Switch to non-root user
USER nextjs

EXPOSE 9103

CMD ["/entrypoint.sh"]
