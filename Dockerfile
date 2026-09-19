# syntax=docker/dockerfile:1
FROM node:24-trixie-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
# better-sqlite3 13.0.3 has no linux/arm64 prebuild for Node 24 → node-gyp needs a toolchain (verified).
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
ENV DATABASE_URL=file:/app/storage/app.db
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build \
 && node -e "require('@napi-rs/canvas'); require('better-sqlite3'); require('@resvg/resvg-js'); console.log('native modules OK')"

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    STORAGE_PATH=/app/storage \
    DATABASE_URL=file:/app/storage/app.db \
    TEMP_PATH=/tmp/drone-telemetry
COPY --from=build /app /app
RUN mkdir -p /app/storage /tmp/drone-telemetry
VOLUME ["/app/storage"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -H 0.0.0.0 -p ${PORT}"]
