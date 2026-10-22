# Deploying Roar to Azure

Everything runs on Microsoft infrastructure: Azure Container Apps for the API and the two Next.js
apps, Azure Database for PostgreSQL for the data, Azure Blob Storage for media, Microsoft Foundry
for the AI agents, and Azure Container Registry for images. Logs go to a Log Analytics workspace.

## Resource inventory (resource group `rg-roar-app`, East US 2)

| Resource | Name | Notes |
| --- | --- | --- |
| Container registry | `acrroar7c4a2e` | Basic; images `roar-api`, `roar-web`, `roar-admin` |
| Postgres flexible server | `psql-roar-7c4a2e` | Burstable B1ms, 32 GB, database `inside_the_game` — **Central US**: free-trial subscriptions cannot create Postgres in East US 2 |
| Storage account | `stroar7c4a2e` | private container `media` (no public blob access) |
| Container Apps environment | `cae-roar` | with Log Analytics `log-roar-7c4a2e` |
| Container app (API) | `ca-api` | external HTTPS, port 4000, system-assigned identity |
| Container app (web) | `ca-web` | external HTTPS, port 3000 |
| Container app (admin) | `ca-admin` | external HTTPS, port 3000, HTTP Basic gate |
| Microsoft Foundry | `roar-foundry-7c4a2e` | separate resource group `rg-roar-foundry`; `gpt-5-mini` |

Trust boundary: fan media for the `community` audience is public only after moderator approval;
`me` media is owner-only and `security` media is staff-only, exactly as in local development. The
API streams media from the private blob container, so blobs themselves are never public.

## Public endpoints

With the current deployment (`wittyocean-f89cf633.eastus2.azurecontainerapps.io`):

- Fan app: `https://ca-web.wittyocean-f89cf633.eastus2.azurecontainerapps.io`
- Admin app (HTTP Basic, user `admin`): `https://ca-admin.wittyocean-f89cf633.eastus2.azurecontainerapps.io`
- API: `https://ca-api.wittyocean-f89cf633.eastus2.azurecontainerapps.io`

## Configuration

### API container (`ca-api`)

| Variable | Value |
| --- | --- |
| `DATABASE_URL` (secret) | `postgresql://roaradmin:…@psql-roar-7c4a2e.postgres.database.azure.com:5432/inside_the_game?sslmode=require` |
| `ADMIN_TOKEN` (secret) | shared admin token used by the admin app |
| `AZURE_OPENAI_API_KEY` (secret) | Foundry key |
| `MEDIA_STORE` | `azure-blob` |
| `AZURE_STORAGE_ACCOUNT` | `stroar7c4a2e` |
| `AZURE_STORAGE_CONTAINER` | `media` |
| `AI_PROVIDER` / `AZURE_OPENAI_RESOURCE` / `AI_MODEL` | `azure-openai` / `roar-foundry-7c4a2e` / `gpt-5-mini` |
| `FORCE_SECURE_COOKIES` | `true` behind Container Apps ingress |
| `TRUST_PROXY` | `1` (hop count) behind Container Apps ingress. `true` trusts every hop and lets clients spoof their IP past the rate limits |
| `CORS_ORIGINS` | public web and admin origins |

The API authenticates to Blob Storage with its managed identity
(`Storage Blob Data Contributor` on the storage account), so no storage key is stored.

### Web container (`ca-web`)

`API_URL` must point at the API at **build time**, because the `/api/*` rewrite is baked into the
Next.js build, and again at runtime.

### Admin container (`ca-admin`)

`API_URL`, `ADMIN_TOKEN` (secret) and `ADMIN_PASSWORD` (secret, HTTP Basic gate) at runtime.

## Build and push images

ACR Tasks are blocked on free-trial subscriptions (`TasksOperationsNotAllowed`), so build locally
with Docker and push to the registry:

```powershell
az acr login -n acrroar7c4a2e
docker build --provenance=false --sbom=false -f apps/api/Dockerfile -t acrroar7c4a2e.azurecr.io/roar-api:v2 .
docker build --provenance=false --sbom=false -f apps/web/Dockerfile --build-arg API_URL="https://ca-api.wittyocean-f89cf633.eastus2.azurecontainerapps.io" -t acrroar7c4a2e.azurecr.io/roar-web:v1 .
docker build --provenance=false --sbom=false -f apps/admin/Dockerfile -t acrroar7c4a2e.azurecr.io/roar-admin:v1 .
docker push acrroar7c4a2e.azurecr.io/roar-api:v2
docker push acrroar7c4a2e.azurecr.io/roar-web:v1
docker push acrroar7c4a2e.azurecr.io/roar-admin:v1
```

The API image runs `tsx` from devDependencies at runtime, so its Dockerfile installs with
`--include=dev`; without it the container boots to `sh: 1: tsx: not found` (exit 127).

## Database migrations

Run Prisma migrations from a machine that is allowed by the server firewall:

```powershell
$env:DATABASE_URL = "<azure connection string>"
npm run migrate:deploy -w @inside/database
```

## Deploy a new revision

```powershell
az containerapp update -g rg-roar-app -n ca-api --image acrroar7c4a2e.azurecr.io/roar-api:v2
az containerapp update -g rg-roar-app -n ca-web --image acrroar7c4a2e.azurecr.io/roar-web:v1
az containerapp update -g rg-roar-app -n ca-admin --image acrroar7c4a2e.azurecr.io/roar-admin:v1
```

## Verify

```powershell
curl https://ca-api.wittyocean-f89cf633.eastus2.azurecontainerapps.io/health
# {"status":"ok","db":"up","stats":"synthetic","ai":{"enabled":true,"provider":"azure-openai","model":"gpt-5-mini","error":null}}
```

Verified end to end on 2026-10-19 (images `roar-api:v2`, `roar-web:v1`, `roar-admin:v1`):

- A community photo upload reached Foundry: `aiStatus=SUCCEEDED` on the first attempt, GOAL analysis
  (confidence 0.6), and a Moment draft (`PROCESSING`).
- The moderation gate held: the pending clip returned 404 publicly, 200 after approval, and the
  downloaded bytes matched the uploaded fixture by SHA-256. Publishing the Moment put it in
  `/matches/rl-01/moments`.
- A `me` upload was `SKIPPED` by AI with no analysis; owner 200, stranger and anonymous 404.
- A MEDICAL SOS created a `CRITICAL` incident visible in the admin incident list.
- `https://ca-web…/api/matches` returns `source=synthetic` (build-time `API_URL` rewrite works);
  the admin console is 401 anonymous / 200 with Basic auth.

If the API logs `AuthorizationPermissionMismatch` from Blob Storage right after provisioning, the
managed-identity role assignment is still propagating; it took about 28 minutes here.

## Free-trial caveats

- Regions: some services reject East US 2 for free-trial subscriptions (Postgres did); the deploy
  script walks a list of regions. Container Apps environments are capped at **one per subscription**,
  so pick the region once.
- ACR Tasks are disabled; use local Docker builds. Build with `--provenance=false --sbom=false`:
  Docker's default attestation manifest list hangs at the final push to ACR.
- Environment creation can take the better part of an hour on a trial subscription; it reports
  "Waiting" until it completes.
- Spending limit is on, so the deployment stops when the trial credit runs out instead of billing.
- Scale-to-zero keeps idle cost near zero; the first request after idle takes a few seconds to start.
