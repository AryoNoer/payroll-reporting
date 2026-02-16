# ============================================
# Stage 1: Install dependencies
# ============================================
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ============================================
# Stage 2: Build the application
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js in standalone mode
RUN npm run build

# ============================================
# Stage 3: Production image
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create upload directory for Railway Volume mount
RUN mkdir -p /data/uploads && chown nextjs:nodejs /data/uploads

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma files for runtime and migrations
COPY --from=builder /app/prisma ./prisma

# Copy node_modules for runtime (Prisma client + serverExternalPackages like exceljs, xlsx)
COPY --from=builder /app/node_modules ./node_modules

# Copy data directory for seed
COPY --from=builder /app/data ./data

# Copy and set up entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

# Run as root initially so entrypoint can fix volume permissions,
# then entrypoint drops to nextjs user before starting the server
CMD ["/entrypoint.sh"]
