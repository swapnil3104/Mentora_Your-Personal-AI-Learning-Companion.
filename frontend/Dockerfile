# ========================================================
# Mentora Frontend - Production Multi-Stage Dockerfile
# Stage 1: Build React/Vite Application
# Stage 2: Serve via Nginx Alpine with Reverse Proxy
# ========================================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install clean dependencies
RUN npm ci

# Copy frontend source
COPY . .

# Set production API URL to relative /api for reverse-proxy routing
ENV VITE_API_URL=/api

# Build production bundle
RUN npm run build

# Stage 2: Nginx Web Server
FROM nginx:1.25-alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
