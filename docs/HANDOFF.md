# Handoff — Roar (Inside the Game)

Last updated: 2026-10-20. Read this first if you are taking over the project or pointing another agent at it.

- Repo: `C:\Users\Abel ADIGUN\Desktop\repos\Inside The Game`
- Branch: `main`, commit `4e8cd48` (“Harden the app and deploy it to Azure”)
- Remote: `origin https://github.com/olabisi-9ja/Roar.git`. At the time of writing, commit `4e8cd48` was local and not pushed; check with `git log origin/main..HEAD`.
- Local Postgres container is stopped; no dev servers are running. The live app does **not** depend on this PC.

## What it is

Roar is an AI audience-intelligence platform for football, built for the Inside the Game: Developer
Hackathon (Microsoft + Premier League). Fans' phones become a stadium camera network: uploads are
classified by agents on Microsoft Foundry, clustered into Moments, and published to a live feed after
moderation. A separate admin/security console handles media approval and SOS incident triage. Match
data is synthetic and replayed live (hackathon rule).

Stack: Expo/React Native fan app (`apps/mobile`), Next.js fan web app (`apps/web`, port 3001),
Next.js admin console (`apps/admin`, port 3000), Fastify API (`apps/api`, port 4000), Prisma +
PostgreSQL, shared types (`packages/types`), AI agents (`packages/ai`), synthetic match engine
(`packages/matchdata`).

## Live deployment (Azure) — verified 2026-10-19/20

| Surface | URL | Notes |
| --- | --- | --- |
| Fan web app | https://ca-web.wittyocean-f89cf633.eastus2.azurecontainerapps.io | Public, no login |
| Admin console | https://ca-admin.wittyocean-f89cf633.eastus2.azurecontainerapps.io | HTTP Basic, user `admin`; password is the local `.env` `ADMIN_PASSWORD` / ACA secret |
| API | https://ca-api.wittyocean-f89cf633.eastus2.azurecontainerapps.io | `GET /health` is the quick check |

Container Apps scale to zero when idle; the **first request after a quiet period takes ~10–20 s**.
That is normal, not an outage.

### Azure inventory

Use the owner's Azure CLI login (`abeladigun11@gmail.com`); confirm the subscription with
`az account show`. Subscription and tenant IDs are deliberately not recorded here — read them from the
CLI so they are not published with the repo.

| Resource | Name | Notes |
| --- | --- | --- |
| Resource group | `rg-roar-app` | East US 2 (Postgres is in Central US) |
| Container Apps environment | `cae-roar` | East US 2; free-trial cap is one environment per subscription |
| API app | `ca-api` | external ingress :4000, 0.5 CPU / 1 Gi, min 0 / max 2, system-assigned identity |
| Web app | `ca-web` | external ingress :3000, 0.5 CPU / 1 Gi, min 0 / max 2 |
| Admin app | `ca-admin` | external ingress :3000, 0.5 CPU / 1 Gi, min 0 / max 2 |
| Container registry | `acrroar7c4a2e` | Basic; images `roar-api:v2`, `roar-web:v1`, `roar-admin:v1` |
| PostgreSQL Flexible Server | `psql-roar-7c4a2e` | **Central US**, Burstable B1ms, 32 GB, db `inside_the_game`, admin `roaradmin`, SSL required; firewall rule `local-dev` |
| Storage account | `stroar7c4a2e` | private container `media`; blobs are served only through the API's ACL layer |
| Log Analytics | `log-roar-7c4a2e` | Container Apps console/system logs |
| Microsoft Foundry | `roar-foundry-7c4a2e` | resource group `rg-roar-foundry`, East US 2; deployment `gpt-5-mini` |

The API authenticates to Blob Storage with its system-assigned managed identity (role
**Storage Blob Data Contributor** at the storage account scope). No storage key or connection string
is configured in the app. The storage primary key was rotated after a key was exposed in an earlier
debug output; do not reintroduce key-based auth.

Secrets are Azure Container Apps secrets, never in the repo:

- `ca-api`: `database-url`, `admin-token`, `azure-openai-key` (plus registry credentials)
- `ca-admin`: `admin-token`, `admin-password` (plus registry credentials)
- `ca-web`: registry credentials only

Local `.env` (gitignored) holds development values plus the admin and AI credentials used for local
runs. Never print or commit them.

### Current state (2026-10-20)

- Azure PostgreSQL `psql-roar-7c4a2e`: **Ready** (it was stopped once and restarted; stop/start is reversible).
- `ca-api`, `ca-web`, `ca-admin`: **0 replicas** while idle.
- Latest images: API `roar-api:v2`, web `roar-web:v1`, admin `roar-admin:v1`.
- Verified end to end: community upload → Foundry GOAL analysis → Moment draft → approval gate
  (pending 404 → approved 200) → published feed; `me` upload `SKIPPED` and owner-only; SOS → CRITICAL
  incident in the admin list; web `/api` rewrite; admin 401 anonymous / 200 authenticated.
- Local `insidethegame-db-1` container: **Exited**; no Node servers; ports 3000/3001/4000/5432 free.

## Local development

```powershell
cp .env.example .env          # fill DATABASE_URL, ADMIN_TOKEN, ADMIN_PASSWORD, AI keys
npm install
npm run db:up                 # Docker Postgres on :5432 (or `npm run db:local`)
npm run generate -w @inside/database
npm run db:deploy             # apply migrations
npm run dev:api               # http://localhost:4000/health
npm run dev:web               # http://localhost:3001 (use `npm run dev:https -w @inside/web` for phone camera)
npm run dev:admin             # http://localhost:3000
```

Mobile: `npm run dev:mobile` (Expo). Checks: `npm run test`, `npm run typecheck`, `npm run lint`,
`npm run build -w @inside/web`, `npm run build -w @inside/admin`; AI smoke test
`npm run check -w @inside/ai`; match-data realism `npm run check -w @inside/matchdata`.

The API's dev scripts read `../../.env` via `tsx --env-file`. The deployed container receives env
vars from Container Apps instead.

## Deploying a change

Build locally (ACR Tasks are blocked on the free trial) and always disable attestations, otherwise the
push to ACR can hang:

```powershell
az acr login -n acrroar7c4a2e

docker build --provenance=false --sbom=false -f apps/api/Dockerfile -t acrroar7c4a2e.azurecr.io/roar-api:v3 .
docker build --provenance=false --sbom=false -f apps/web/Dockerfile --build-arg API_URL="https://ca-api.wittyocean-f89cf633.eastus2.azurecontainerapps.io" -t acrroar7c4a2e.azurecr.io/roar-web:v2 .
docker build --provenance=false --sbom=false -f apps/admin/Dockerfile -t acrroar7c4a2e.azurecr.io/roar-admin:v2 .

docker push acrroar7c4a2e.azurecr.io/roar-api:v3
docker push acrroar7c4a2e.azurecr.io/roar-web:v2
docker push acrroar7c4a2e.azurecr.io/roar-admin:v2

az containerapp update -g rg-roar-app -n ca-api --image acrroar7c4a2e.azurecr.io/roar-api:v3
az containerapp update -g rg-roar-app -n ca-web --image acrroar7c4a2e.azurecr.io/roar-web:v2
az containerapp update -g rg-roar-app -n ca-admin --image acrroar7c4a2e.azurecr.io/roar-admin:v2
```

- **Web `API_URL` is baked in at build time** (the `/api/*` rewrite is compiled). Changing the API
  URL requires rebuilding the web image; the admin reads `API_URL` at runtime.
- The API image runs `tsx` from devDependencies. Its Dockerfile installs with
  `npm ci --include=dev`; without that the container crash-loops with `sh: 1: tsx: not found`.
- Database migrations:

```powershell
$env:DATABASE_URL = "<azure connection string>"
npm run migrate:deploy -w @inside/database
```

If your machine is not allowed through the Postgres firewall, add your IP first:

```powershell
az postgres flexible-server firewall-rule create -g rg-roar-app -n psql-roar-7c4a2e `
  --rule-name my-ip --start-ip-address <ip> --end-ip-address <ip>
```

## Verify a deployment

```powershell
$api = "https://ca-api.wittyocean-f89cf633.eastus2.azurecontainerapps.io"
curl.exe -s "$api/health"
# {"status":"ok","db":"up","stats":"synthetic","ai":{"enabled":true,"provider":"azure-openai","model":"gpt-5-mini","error":null}}

curl.exe -s -o NUL -w "%{http_code}" "https://ca-web.wittyocean-f89cf633.eastus2.azurecontainerapps.io/"
curl.exe -s "https://ca-web.wittyocean-f89cf633.eastus2.azurecontainerapps.io/api/matches"  # source=synthetic
```

Admin: 401 anonymous, 200 with `-u "admin:$env:ADMIN_PASSWORD"`. API admin calls use the
`x-admin-token` header (not Basic auth).

Manual E2E flow:

1. `POST /media` (multipart: `matchId=rl-01`, `audience=community`, `file=<jpeg>`) with a cookie jar.
2. Poll `GET /media/:id/status` until `aiStatus` is not `QUEUED`/`RUNNING`; expect `SUCCEEDED`,
   an `analysis`, and a `moment` draft.
3. `GET /media/:id/file` is 404 publicly while pending; `PATCH /admin/media/:id {"status":"APPROVED"}`
   with `x-admin-token` makes it 200. The served bytes should match the upload.
4. `PATCH /admin/moments/:id {"status":"PUBLISHED"}` puts it in `GET /matches/:id/moments`.
5. Upload with `audience=me`: `aiStatus=SKIPPED`; owner 200, everyone else 404.
6. `POST /incidents` (`{matchId, type, section, row?, description?}`) creates an incident; it appears
   in `GET /admin/incidents` with the rule-based severity.
7. `GET /admin/ai/status` confirms provider/model.

Useful operational commands:

```powershell
az containerapp logs show -g rg-roar-app -n ca-api --tail 100 --type console
az containerapp revision list -g rg-roar-app -n ca-api -o table
az containerapp revision restart -g rg-roar-app -n ca-api --revision <name>
```

## Pause and resume

- **Container Apps:** no stop command; they scale to zero. Deleting the environment is destructive and
  slow to recreate (~55 minutes on this subscription) — don't do it to “pause”.
- **Azure Postgres:** `az postgres flexible-server stop -g rg-roar-app -n psql-roar-7c4a2e` /
  `... start ...`. Stopping it pauses compute billing but the live app breaks until it is started.
  Azure auto-starts a stopped server after **7 days**.
- **Local:** `docker compose stop` / `npm run db:up`.

## Hard-won gotchas

1. **`tsx` in production:** the API runs `tsx src/server.ts`; the image must install devDependencies
   (`--include=dev`). The original failure was exit 127, `tsx: not found`.
2. **ACR pushes:** build with `--provenance=false --sbom=false`. Docker's attestation manifest list
   hangs at the final push to this registry.
3. **Blob RBAC propagation:** after assigning Storage Blob Data Contributor, writes failed for ~28
   minutes with 403 `AuthorizationPermissionMismatch`. Check the role assignment before changing auth.
4. **Free-trial restrictions:** ACR Tasks are disabled; Postgres cannot be created in East US 2
   (used Central US); only one Container Apps environment per subscription; environment creation can
   take the better part of an hour; spending limit is on.
5. **Foundry:** `gpt-5-mini` deployment on `roar-foundry-7c4a2e`. Claude models had 0 TPM quota on
   this subscription, so the AI provider is `AI_PROVIDER=azure-openai`. Provider selection is explicit;
   ambient OS credentials are never inherited.
6. **Web rebuild rule:** `API_URL` is compile-time for the Next rewrite. Runtime env alone is not enough.
7. **Rate limits are in-process** (media 12/10 min, SOS 6/5 min, admin 300/min per IP). Move to Redis
   before running more than one API replica. They key on `request.ip`, so `TRUST_PROXY` must be the
   hop count `1` behind Container Apps ingress: `true` trusts a client-supplied `X-Forwarded-For` and
   lets anyone dodge the limits.
8. **Synthetic data only** — do not add licensed match data; the replay engine is in `packages/matchdata`.

## Non-negotiable product rules

- `me` and `security` media are **never** sent to AI and never served publicly. Only APPROVED
  `community` media is public. The single policy is `apps/api/src/media-policy.ts`.
- SOS is **receipt-only**: a reference and `tel:999`, no “steward on the way” or “seen by security”.
  AI incident triage is opt-in via `AI_INCIDENT_TRIAGE=true` (default false).
- AI provider must be chosen explicitly via `AI_PROVIDER`; never silently inherit ambient credentials.
- Never commit `.env`, credentials, or user media. Do not commit or push without the owner's approval.
- Keep the synthetic-data rule and the audience ACLs intact.

## Where to look

| File | Contents |
| --- | --- |
| `README.md` | Overview, layout, local run |
| `docs/GLASSES.md` | Meta Ray-Ban Display web app (`/glasses.html`) and the Android glasses-camera app |
| `docs/DEPLOYMENT.md` | Azure build/deploy/verify, resource inventory |
| `docs/SPEC.md`, `docs/PRD.md`, `docs/TRD.md`, `docs/API.md`, `docs/APPFLOW.md`, `docs/DESIGN.md` | Product and API specification |
| `audit/REMEDIATION_STATUS.md` | Security remediation status and remaining production gaps |
| `audit/REMEDIATION_PLAN.md`, `audit/DETAILED_FINDINGS.md`, `audit/EXECUTIVE_SUMMARY.md`, `audit/TEST_AND_VALIDATION_REPORT.md` | Audit evidence |
| `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/admin/Dockerfile`, `.dockerignore` | Images |
| `.github/workflows/ci.yml` | CI: install → generate → typecheck → tests → lint → builds |

## Demo features added 2026-10-23 (not yet deployed)

Translator, Tactics Analyst and Recap Writer agents; `/recap`, the "Why it worked" card, a language
picker in the fan app menu, partner API keys with signed webhooks, `/widget.html`, and the admin
Partners page. Routes in [API.md](API.md). New migration `20261023120000_partners`: run
`migrate:deploy` against Azure before rolling out the new API image. Set `PUBLIC_WEB_URL` on `ca-api` to
the `ca-web` URL so partner media links are absolute.

## Known gaps / sensible next steps

From `audit/REMEDIATION_STATUS.md` → “Still blocking production”:

- Compile the API to `dist` instead of running `tsx`; run as non-root with a container healthcheck.
- Replace guest-cookie identity with real auth (Entra ID) before treating private media as account data.
- Strip EXIF/GPS server-side (images are stored as uploaded).
- Add Blob lifecycle rules for rejected/removed objects and an orphan sweeper.
- Move rate limits to a shared store before scaling beyond one API instance.
- Mobile app is not deployed and not in the CI matrix.
- Optional: custom domain for the Container Apps environment; push the repo to `origin` for
  cross-machine handoff.
