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
# Không hardcode PORT – Render sẽ inject PORT=10000 vào lúc runtime
# Next.js standalone server.js tự đọc process.env.PORT

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Không EXPOSE cố định – dùng PORT của Render (mặc định 10000)
EXPOSE ${PORT:-10000}

CMD ["node", "server.js"]
