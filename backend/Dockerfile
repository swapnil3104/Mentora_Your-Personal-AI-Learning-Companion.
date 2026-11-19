# ========================================================
# Mentora Backend - Production Dockerfile
# Multi-stage optimized Node.js runtime
# ========================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install system dependencies needed for Prisma compilation on Alpine
RUN apk add --no-cache openssl libc6-compat

# Copy package descriptors and Prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies required for Prisma generate)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Prune devDependencies for production image
RUN npm prune --production

# --------------------------------------------------------
# Production Runtime Stage
# --------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat curl

ENV NODE_ENV=production
ENV PORT=5000

# Create uploads directory and set permissions
RUN mkdir -p /app/uploads && chown -R node:node /app

# Copy production node_modules from builder
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src

# Use non-root node user
USER node

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "src/server.js"]
