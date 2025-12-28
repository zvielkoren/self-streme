# Multi-stage Dockerfile for Node.js app with Cloudflare Tunnel support
FROM node:20-alpine AS base

# Install necessary system dependencies
RUN apk add --no-cache \
    ca-certificates \
    curl \
    wget \
    util-linux \
    bash \
    git

# Install cloudflared
RUN wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

# Verify cloudflared installation
RUN cloudflared --version

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy application code
COPY . .

# Create necessary directories and set permissions
RUN mkdir -p logs media temp temp/downloads data && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the ports (default 7000 for API, 7001 for Addon)
EXPOSE 7000
EXPOSE 7001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the application using src/index.js
CMD ["node", "src/index.js"]
