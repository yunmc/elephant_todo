# Build stage — 基于 base 镜像（已含 node_modules）
FROM registry.cn-shanghai.aliyuncs.com/sigmalove/elephant-todo-base:latest AS builder

WORKDIR /app

# Copy source code (node_modules already in base)
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM docker.m.daocloud.io/library/node:20-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nuxtjs

# Copy built assets
COPY --from=builder /app/.output ./.output

# Copy init-db script for optional manual init
COPY --from=builder /app/scripts ./scripts

# Set ownership
RUN chown -R nuxtjs:nodejs /app

USER nuxtjs

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

EXPOSE 3001

CMD ["node", ".output/server/index.mjs"]
