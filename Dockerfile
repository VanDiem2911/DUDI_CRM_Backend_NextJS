# ---- Stage 1: Build Next.js ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Stage 2: Production runner ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# PORT sẽ được Render inject lúc runtime (mặc định 10000)
# CORS_ALLOWED_ORIGINS nên được set trong Render Dashboard
# Ví dụ: CORS_ALLOWED_ORIGINS=https://dudicrm.vercel.app

# Copy Next.js standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy CORS proxy entry point
COPY --from=builder /app/entry.cjs ./

# Port được Render inject qua env var – không hardcode
EXPOSE 10000

# Chạy CORS proxy thay vì server.js trực tiếp
CMD ["node", "entry.cjs"]
