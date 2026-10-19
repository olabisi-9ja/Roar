# Build from the repository root:
#   docker build -f apps/api/Dockerfile -t roar-api .
FROM node:22-bookworm-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NEXT_TELEMETRY_DISABLED=1

# Workspace manifests first, so the dependency layer survives source-only changes.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/matchdata/package.json packages/matchdata/package.json
COPY packages/types/package.json packages/types/package.json

# The API and database workspaces. --include=dev keeps the runtime tools (tsx) and the Prisma CLI,
# which NODE_ENV=production would otherwise omit.
RUN npm ci --include=dev --workspace @inside/api --workspace @inside/database --include-workspace-root --no-audit --no-fund

COPY packages/ai packages/ai
COPY packages/database packages/database
COPY packages/matchdata packages/matchdata
COPY packages/types packages/types
COPY apps/api apps/api

# A dummy URL satisfies prisma.config.ts during generate; no database connection is made.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run generate -w @inside/database

EXPOSE 4000
CMD ["npm", "run", "start:prod", "-w", "@inside/api"]
