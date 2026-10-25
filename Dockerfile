# Playwright's image already carries Chromium and ffmpeg, which this app needs
# at runtime. Building on the same tag keeps the browser and the client library
# in lockstep.
FROM mcr.microsoft.com/playwright:v1.64.1-noble AS deps
WORKDIR /app
# better-sqlite3 ships native bindings; compile them against this image's Node.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.64.1-noble AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    HOME=/tmp

# next start needs the app, the build output and the runtime dependencies.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

USER 1000:1000
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
