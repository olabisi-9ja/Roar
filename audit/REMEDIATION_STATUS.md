# Remediation Status

Last updated: 2026-10-19

This tracks what changed after the audit, what is verified, and what still blocks production. It does not replace `REMEDIATION_PLAN.md`; the plan explains each finding, this file reports implementation state.

## Verified locally

| Check | Command | Result |
|---|---|---|
| API tests | `npm run test -w @inside/api` | 18/18 pass |
| AI config tests | `npm run test -w @inside/ai` | 8/8 pass |
| AI live smoke test | `npm run check -w @inside/ai` | Moment Analyst, Storyteller and Safety Analyst all returned valid schemas |
| Typecheck (all workspaces) | `npm run typecheck` | pass |
| Lint (web + admin) | `npm run lint` | 0 errors (only `<img>` warnings) |
| Web production build | `npm run build -w @inside/web` | pass with API stopped |
| Admin production build | `npm run build -w @inside/admin` | pass with API stopped (routes are PPR) |
| Prisma schema | `npx prisma validate --schema packages/database/prisma/schema.prisma` | valid |
| Migrations | `npm run migrate:deploy -w @inside/database` | 6 applied |

Runtime probes covered: media ACL by audience, owner-only `me` media, staff preview of `security`, approval gate, poster delivery, AI status persistence, SOS dedupe, incident state transitions, 429 limits, upload magic-byte rejection, and security headers. With the live provider: a goal photo produced a GOAL analysis (0.7) plus a Moment draft, a `me` upload was `SKIPPED` with zero AI attempts, and a fire photo produced a `SECURITY`/`CRITICAL` incident linked to the media.

## Verified on Azure (2026-10-19)

| Check | Result |
|---|---|
| `/health` | `db: up`, `ai: {enabled: true, provider: "azure-openai", model: "gpt-5-mini", error: null}` |
| Community upload → AI | GOAL analysis (confidence 0.6), Moment draft created, `aiStatus=SUCCEEDED` on attempt 1 |
| Moderation gate | pending clip 404 publicly (staff-preview only) → 200 after `APPROVED`; downloaded blob matched the fixture by SHA-256 |
| Moment publish | `PUBLISHED` and present in `/matches/rl-01/moments` |
| Private `me` upload | `aiStatus=SKIPPED`, no analysis returned; owner 200, stranger 404, anonymous 404 |
| SOS | MEDICAL report → `CRITICAL` incident visible in `/admin/incidents` |
| Web proxy | `/api/matches` → `source=synthetic` (build-time `API_URL` rewrite correct) |
| Admin gate | anonymous 401, Basic auth 200 |

Images `roar-api:v2`, `roar-web:v1`, `roar-admin:v1` run in Container Apps `ca-api`, `ca-web`,
`ca-admin` (`cae-roar`), with Azure Database for PostgreSQL and a private `media` blob container
accessed through the API's managed identity. The `Storage Blob Data Contributor` assignment took
about 28 minutes to propagate; until then Blob returned `AuthorizationPermissionMismatch`.

## Implemented

### Identity, access, abuse (F-01, F-02, F-03, F-16, F-23, F-24)

- Fans now get an opaque `roar_actor` HttpOnly first-party cookie on their first write. The old shared `demo@roar.local` user is gone from uploads and incidents; each browser owns its own `me` media.
- `GET /media/:id/file` and `/poster` use one policy (`apps/api/src/media-policy.ts`): only APPROVED `community` media is public; `me` is owner-only even for staff; `security` is staff-only; pending/rejected/removed media is never public. Public responses use `public, max-age=300`; everything else is `private, no-store`.
- Approving `me`/`security` media is still rejected by `/admin/media/:id`.
- In-process token buckets (`apps/api/src/limits.ts`): media 12/10 min, SOS 6/5 min, admin 300/min, per IP. `TRUST_PROXY` is opt-in.
- SOS dedupe: the same match + section + type within 2 minutes returns the original incident with `duplicate: true`.
- Admin incident state machine is enforced server-side; invalid moves return 409.
- API responses send `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy`. Web/admin send those plus `Permissions-Policy`, a frame-ancestors CSP, and HSTS in production; `X-Powered-By` is disabled.
- Uploads are streamed to `.part` files and atomically renamed, then checked against magic bytes for JPEG/PNG/GIF/WebP/MP4/WebM. An HTML payload declared as media gets 415.
- Malformed Basic auth in the admin proxy returns 401 instead of 500.

### SOS (F-04, F-05, F-06, F-28)

- The success screen only claims a receipt and a reference; it no longer says "seen by security" or "steward on the way". Section/row/description are editable, `tel:999` is prominent, and no match loaded still uses a known venue key.
- Offline or busy-queue reports are stored in `roar.sosQueue` and retried on reconnect. A queued report is labelled "Saved on this phone" and explicitly "not sent yet". Rate-limit (429) and 5xx responses are treated as retryable, not permanent failures.
- Admin `/incidents` shows severity, type, section, reporter, AI confidence, linked clips, and allowed status buttons.

### AI (F-07, F-08, F-09, F-13, F-37)

- Provider selection is explicit via `AI_PROVIDER` (`microsoft-foundry`, `azure-openai`, `anthropic`); ambient OS Anthropic credentials are never inherited silently.
- Microsoft Foundry supports two routes: Claude through the Anthropic-compatible endpoint (`microsoft-foundry`) and Azure OpenAI models through the OpenAI-compatible endpoint (`azure-openai`). The latter is what free-trial subscriptions can deploy.
- Foundry resource/endpoint and base URLs are normalized; a trailing `/v1` is stripped with a warning (the `/v1/v1/messages` root cause). Azure OpenAI base URLs are normalized to the `/openai/v1` route.
- `aiStatus()` exposes provider/model/enabled/error without secrets and is shown on `/health` and the admin home.
- Private (`me`) and `security` media are gated before any file read or model call, and become `SKIPPED` with a reason.
- Every upload persists `aiStatus`, `aiError`, `aiAttempts`, `aiUpdatedAt`; analyses are upserted, so retries are safe. The admin queue has a "Retry AI analysis" action.
- Videos are analysed from a browser-captured JPEG poster; photos directly.
- Safety-relevant MEDIUM/CRITICAL analyses create or link a deduped incident.
- SOS text/seat data is only sent to AI when `AI_INCIDENT_TRIAGE=true` (default false).

### Moderation, data, operations (F-15, F-17, F-19, F-22, F-36, F-44)

- Reject/remove cascades to every linked Moment (not just `bestMedia`); publishing is blocked if any linked clip is private/rejected/removed.
- Removal of a Moment removes its linked media.
- `resumeAiAnalysis()` reclaims queued work after restart.
- Incident and media indexes added, plus CHECK constraints for `media.audience` and `moments.source`.
- SIGTERM/SIGINT drain Fastify and disconnect Prisma.
- CI workflow runs install → Prisma generate → typecheck → tests → lint → web/admin builds. Web/admin now have `typecheck` scripts; root has `test` and `lint`.

## Still blocking production

1. **AI runs on Azure OpenAI `gpt-5-mini`, not Claude.** Resource group `rg-roar-foundry` and AIServices account `roar-foundry-7c4a2e` exist in East US 2. `.env` uses `AI_PROVIDER=azure-openai`, `AZURE_OPENAI_RESOURCE=roar-foundry-7c4a2e`, and `AI_MODEL=gpt-5-mini`. Claude was not deployable because the subscription is `FreeTrial_2014-09-01` with spending limit on and **0 TPM quota for every Claude model**; `gpt-5-mini` (GlobalStandard, version `2025-08-07`) has free-trial quota and is live. To switch to Claude later, upgrade to pay-as-you-go, deploy with `modelProviderData` and API version `2025-10-01-preview`, then set `AI_PROVIDER=microsoft-foundry` and the Anthropic route variables.
2. **Fan identity is a guest cookie, not real authentication.** It removes the shared demo identity and supports ownership, but production needs a real sign-in (planned: Entra ID with roles) before private media can be treated as account data.
3. **Rate limits and guest identity are per API instance / local cookie.** Move buckets to Redis before scaling horizontally; rotate/expire guest identities as part of account migration.
4. **Blob lifecycle and cleanup are unfinished.** Media is stored in the private Azure `media` container and streamed through the API's ACLs (verified in the cloud), but there are no lifecycle rules for rejected/removed objects and no orphan sweeper yet.
5. **EXIF/GPS is not stripped.** Images are stored as uploaded. Add server-side decode/re-encode (e.g. sharp) before treating media as private-safe.
6. **Client idempotency keys are not unique rows.** SOS dedupe is a 2-minute seat/type query. Add a client key + unique constraint for strict exactly-once semantics.
7. **Observability and E2E coverage are thin.** Unit/CI coverage exists for policies, limits, cookies, uploads signatures, and AI URL handling; there is no Playwright suite, no metrics/tracing, and no alert for stuck AI jobs.
8. **API runs through `tsx` in production.** Add a compiled `dist` build, non-root container, healthcheck, and pinned Node/package manager.
9. **Mobile app is unchanged** and is not in the typecheck/CI matrix.

## How to verify

```powershell
npm run test -w @inside/api
npm run test -w @inside/ai
npm run check -w @inside/ai
npm run typecheck
npm run lint
npm run build -w @inside/web
npm run build -w @inside/admin
```

With the local DB/API running, the runtime probes used during remediation live in the OpenCode temp directory (`roar-probe2.mjs`, `roar-probe3.mjs`, `roar-probe4.mjs`); they exercise the real endpoints with `ADMIN_TOKEN` from `.env`.
