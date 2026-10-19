# Build from the repository root:
#   docker build -f apps/web/Dockerfile --build-arg API_URL=https://ca-api.example -t roar-web .
FROM node:22-bookworm-slim AS build
WORKDIR /repo
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NEXT_TELEMETRY_DISABLED=1

# Baked into the Next.js build so the /api rewrite points at the cloud API.
ARG API_URL=http://localhost:4000
ENV API_URL=$API_URL

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/matchdata/package.json packages/matchdata/package.json
COPY packages/types/package.json packages/types/package.json

RUN npm ci --workspace @inside/web --include-workspace-root --no-audit --no-fund

COPY packages/types packages/types
COPY packages/matchdata packages/matchdata
COPY apps/web apps/web

RUN npm run build -w @inside/web

ENV NODE_ENV=production \
    PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@inside/web"]
