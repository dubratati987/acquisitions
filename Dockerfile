# Multi-stage Dockwerfile for Node.js

# Base image with Node.js
FROM node:18-alpine AS base
RUN apk add --no-cache openssl3

# Set working directory
WORKDIR /app

# Copy package files
COPY package* ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose the port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })"

# Development stage
FROM base AS development
USER root
RUN npm ci && npm cache clean --force
RUN npx prisma generate
USER nodejs
CMD [ "npm", "run", "dev" ]

# Production stage
FROM base as production
USER root
RUN npx prisma generate
USER nodejs
CMD [ "npm", "start" ]