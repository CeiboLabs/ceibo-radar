# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install system deps required by Playwright/Chromium
RUN apt-get update && apt-get install -y \
    ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 \
    libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
    libpangocairo-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 \
    libxrender1 libxss1 libxtst6 wget xdg-utils \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Install deps (runs postinstall → playwright install chromium)
COPY package*.json ./
RUN npm ci

# Build Next.js app
COPY . .
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Same system deps needed at runtime by Playwright
RUN apt-get update && apt-get install -y \
    ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 \
    libgbm1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
    libpangocairo-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 \
    libxrender1 libxss1 libxtst6 wget xdg-utils \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Copy built app and node_modules (includes playwright + chromium)
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
# Copy playwright browser cache
COPY --from=builder /root/.cache /root/.cache

EXPOSE 3000

CMD ["npm", "start"]
