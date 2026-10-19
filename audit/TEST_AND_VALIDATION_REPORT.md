# Roar — Test and Validation Report

**Revision:** `ab03eba` · **Date:** 19 October 2026
**Environment:** Windows, Node **26.2.0**, npm **11.13.0**, embedded PostgreSQL **18.4**, API on `127.0.0.1:4000`.
**Scope:** safe local checks against a local dev database. No production application database or fan data was used; no destructive exploits were attempted; no application code, schema, lockfile, or dependency was changed. The local API did inherit ambient AI configuration from the OS (see side note), so outbound AI requests were attempted.

> **Important side note:** during upload/incident probes the API attempted outbound AI calls because AI credentials and `ANTHROPIC_BASE_URL` exist in the machine's **User** environment (not in the repo `.env`). Every call failed with HTTP 404 at the configured endpoint (`POST /v1/v1/messages`), so no model invocation succeeded. This is recorded as finding F-37 and as evidence for F-08/F-09. Values were never printed.

---

## 1. Static, build, and quality checks

| # | Command | Result | Notes |
|---|---|---|---|
| 1 | `git status --short --branch` | **PASS (clean)** | `## main...origin/main [ahead 1]`; no modified tracked files before the audit. |
| 2 | `npm run typecheck --workspaces --if-present` | **PASS** | api, ai, database, matchdata. **web, admin, mobile have no `typecheck` script**, so the root command silently skips them. |
| 3 | `npx tsc --noEmit -p apps/web/tsconfig.json` | **PASS** | Manual run. |
| 4 | `npx tsc --noEmit -p apps/admin/tsconfig.json` | **PASS** | Manual run. |
| 5 | `npx tsc --noEmit -p apps/mobile/tsconfig.json` | **NOT RUN independently** | Mobile has no `typecheck` script and is skipped by the root command; not verified by the lead auditor. |
| 6 | `npm run build -w @inside/web` | **PASS** | Next.js production build completed; 18 routes. |
| 7 | `npm run build -w @inside/admin` | **PASS** | Next.js production build completed. |
| 8 | `npm run lint -w @inside/admin` | **PASS** | 1 warning (`<img>`). |
| 9 | `npm run lint -w @inside/web` | **FAIL (exit 1)** | **4 errors, 7 warnings.** Errors: `apps/web/app/page.tsx:18`, `apps/web/app/stats/page.tsx:27`, `apps/web/components/Pwa.tsx:50`, `apps/web/lib/live.ts:70` — React Compiler “Calling setState synchronously within an effect can trigger cascading renders”. |
| 10 | `npm run check -w @inside/matchdata` | **PASS** | Synthetic matches generated/validated; deterministic. |
| 11 | `npm run check -w @inside/web` | **PASS** | `For You ranking: all checks passed`. |
| 12 | `npm run check -w @inside/ai` | **NOT RUN deliberately** | It exercises real model calls. Incidental calls from upload/incident probes did occur and failed with 404 (see §3.5). |
| 13 | `npm audit` | **FAIL** | **29 vulnerabilities: 22 high, 7 moderate, 0 critical.** |
| 14 | `npm audit --omit=dev` | **FAIL** | **26 vulnerabilities: 19 high, 7 moderate.** Concentrated in Expo/Metro/ESLint/Prisma tooling; runtime reachability not proven. |
| 15 | `npm test` | **FAIL (missing)** | No root or workspace `test` script exists; no test runner configured. |
| 16 | `npx expo install --check` | **FAIL** | Installed Expo 57.0.27 vs expected 57.0.30 (subagent E). |
| 17 | `npx expo-doctor` | **FAIL** | 19/21 checks (subagent E). |
| 18 | `npm run db:deploy` | **PASS** | 3 migrations found; “No pending migrations to apply.” |
| 19 | Prisma schema validation | **PASS** | Subagent C. |

**Not run:** production container build (none exists), deployment smoke tests, load/soak tests, penetration tests, dependency reachability analysis, browser/device tests.

---

## 2. Local runtime setup

1. `npm run db:local` → embedded PostgreSQL 18.4 ready on `localhost:5432`, database `inside_the_game`. The log noted a stale recovery checkpoint and “database already exists”; both are benign for this local data directory.
2. `npm run db:deploy` → 3 migrations, no pending.
3. `npm run start -w @inside/api` → Fastify listening on port 4000.
4. Probes were issued with PowerShell `Invoke-WebRequest` and `curl.exe` against `http://127.0.0.1:4000` (using `127.0.0.1` avoids the Windows IPv6 `localhost` resolution quirk).

### Test data created (local dev DB only)

- **2 incidents** — one from the “extra property” probe (Fastify stripped the extra field and accepted the otherwise valid body) and one from the valid probe.
- **3 media rows/files** — tiny 1×1 PNGs with `audience=community`, `audience=security`, and `audience=me`, stored under `apps/api/uploads/`. No cleanup endpoint exists, so they were left in the local dev DB/disk.
- No production data, real user media, or external account was touched.

---

## 3. Runtime results

### 3.1 Public reads

| Probe | Expected | Actual | Interpretation |
|---|---|---|---|
| `GET /health` | 200 | **200** | Healthy. |
| `GET /matches` | 200 | **200** | Synthetic fixture catalog returned. |
| `GET /matches/rl-01` | 200 | **200** | Match detail returned. |
| `GET /matches/does-not-exist` | 404 | **404** | Correct not-found. |
| `GET /matches/rl-01/events?since=abc` | 400 ideally | **200 with 0 events** | Invalid `since` silently empties the page (F-38). |
| `GET /matches/rl-01/events?limit=-2` | 400/clamp | **200 with 648 events** | Negative limit becomes `slice(0,-2)` and drops the last two (F-38). |
| `GET /matches/rl-01/moments` | 200 | **200** | Curated moments list returned. |
| `GET /media/nope/file` | 404 | **404** | Correct unknown-ID behavior. |

### 3.2 Admin authentication boundary

| Probe | Expected | Actual | Interpretation |
|---|---|---|---|
| `GET /admin/incidents` (no token) | 401 | **401** | Gate works for the simple case. |
| `GET /admin/incidents` (wrong same-length ASCII token) | 401 | **401** | Length/content check rejects. |
| `GET /admin/incidents` (valid token) | 200 | **200** | Admin reads incident list (local `ADMIN_TOKEN`). |
| `GET /admin/media` (valid token) | 200 | **200** | Admin media list. |
| `GET /admin/incidents/does-not-exist` (valid token) | 404 | **404** | No dynamic injection surface observed. |
| Crafted non-ASCII header with equal JS string length | 401 | **500** | `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`; `RangeError: Input buffers must have the same byte length` at `server.ts:261` (F-41). |
| `Authorization: Basic !!!` (admin proxy, subagent B) | 401/400 | **500** | `atob` throws before the gate returns (F-41). |

Neither auth parsing failure bypasses authentication; both return server errors and generate log noise.

### 3.3 Incident write validation

| Probe | Expected | Actual | Interpretation |
|---|---|---|---|
| `POST /incidents` bad `type` enum | 400 | **400** | Enum validation works. |
| `POST /incidents` missing `section` | 400 | **400** | Required field enforced. |
| `POST /incidents` extra property `injected` | 400 ideally | **201** | Fastify/Ajv default `removeAdditional` strips it and creates the incident (I-03). |
| `POST /incidents` valid unauthenticated body | 401 in production | **201** | Confirms open fan writes and shared demo identity (F-01). |
| `POST /media` without multipart body | 4xx | **406** | `FST_INVALID_MULTIPART_CONTENT_TYPE`; acceptable. |

### 3.4 Media upload and audience/privacy matrix (key reproduction)

All uploads used a valid 1×1 PNG, `matchId=rl-01`, `section=C`, and returned **201** with status `PROCESSING` (AI failed — see §3.5).

| Audience | Processing: public GET | Processing: admin GET | After `PATCH /admin/media/:id APPROVED` | Public cache header |
|---|---|---|---|---|
| `community` | **404** | **200** | **200** | `public, max-age=86400` |
| `security` | **404** | **404** (moderator preview limited to community) | **200** | `public, max-age=86400` |
| `me` | not tested pre-approval | not tested | **200** | `public, max-age=86400` |

**Interpretation:** the audience field does not authorize serving. An approved “security only” or “only me” clip is publicly retrievable by anyone who knows the ID, and intermediaries may cache it for 24 hours. Intended viewers have no route to it before approval. This is the confirmed reproduction for **F-02/F-16**.

`PATCH /admin/media/security-id {"status":"APPROVED"}` also returned 200, confirming the moderation endpoint does not restrict itself to community media.

### 3.5 AI pipeline behavior (observed during the upload/incident probes)

The API log recorded, for every upload and incident:

```
"Moment agents failed" ... 404 {"error":{"message":"Invalid URL (POST /v1/v1/messages)"...}}
    at async processUpload (apps/api/src/agents.ts:44:13)
"Safety Analyst failed" ... 404 ... at async triageIncident (apps/api/src/agents.ts:109:13)
```

- The calls were fired **after** the HTTP response (fire-and-forget), matching `void processUpload(...)` / `void triageIncident(...)`.
- Failures were logged and swallowed; media remained `PROCESSING`; no FAILED status or retry was scheduled.
- Root cause of the 404: the plain Anthropic SDK silently reads the **ambient** `ANTHROPIC_BASE_URL`, which is set at OS **User** scope and ends in `/v1`; the SDK appends `/v1/messages`, producing `/v1/v1/messages`. The repo `.env` documents none of these variables and contains no AI keys. Values were never printed.
- Outbound attempts occurred for **all three uploads**, including `audience=security` and `audience=me`, and for the incident description — evidence for the “AI before audience gate” finding (F-09). The endpoint rejected the URL with 404, so no model output or successful invocation occurred.

### 3.6 Abuse-control probe

| Probe | Expected | Actual |
|---|---|---|
| 40 sequential `GET /health` | 429 after threshold | **40× 200, zero 429** |

No rate-limit plugin or quota logic exists. This is a read probe; unauthenticated writes were separately confirmed to succeed, so the lack of throttling applies to expensive/mutating routes too (F-03).

### 3.7 CORS behaviour

| Origin | `Access-Control-Allow-Origin` |
|---|---|
| `http://evil.example` | **absent** |
| `http://localhost:3000` | **present** |

The configured allowlist behaved correctly in this environment. This is a positive result; CORS is not a substitute for authentication.

---

## 4. Checks that passed (and what they do not prove)

- **TypeScript** passes in all seven workspaces when run manually, but the root command skips three apps.
- **Web/admin production builds** pass; this proves compilation, not runtime correctness or accessibility.
- **Matchdata and web feed checks** pass; they cover synthetic-data generation and ranking logic only.
- **Prisma migrations** apply cleanly to the local database.
- **Basic auth boundary** returns 401 without/with a wrong token; this does not compensate for the shared credential model (F-04).
- **CORS** allowlist works; no wildcard was observed.
- **No tracked secrets** were found and `.env` is untracked.

## 5. Checks that failed

- Web lint (4 errors) — a real gate failure.
- `npm audit` (29 advisories; 26 production-scoped).
- Missing test script/runner.
- Expo dependency check/doctor.
- Runtime: media privacy matrix, AI endpoint, auth parsing robustness, and invalid query handling all failed expectations.

## 6. Not performed / limitations

- No browser or physical-device testing: camera capture, `MediaRecorder` MIME behavior, Safari playback, IndexedDB queue, service-worker offline transitions, reduced-motion, or screen-reader passes were not exercised.
- No end-to-end or integration suite exists to run.
- No load, stress, or disk-exhaustion test (100 MB uploads were not actually sent).
- No successful AI invocation; no prompt-injection payload was executed against a live model.
- No Docker build/deployment, CDN/cache, backup/restore, or multi-instance test.
- No penetration test; findings are code/runtime evidence, not an exhaustive vulnerability assessment.
- Dependency advisories are advisory counts; exploitability was not proven.
- Tests ran on Windows with a single local user and synthetic fixtures; behavior may differ under Linux/containers or a shared database.

## 7. Side effects and cleanup

- Local dev DB now contains 2 test incidents and 3 test media rows; three small PNGs remain in `apps/api/uploads/`. No cleanup endpoint exists, and deleting them was out of scope for a read-only audit. They are local-only artifacts.
- The API and embedded PostgreSQL processes were stopped; ports 4000 and 5432 were confirmed closed.
- No tracked files were modified. The only repository additions are the five files in `audit/`.

## 8. Safe reproduction guidance

To repeat the runtime probes without outbound AI requests, start the API with the ambient AI variables cleared (for example, unset `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, and any Foundry variables) and/or set an explicit AI-disable flag once F-37 is implemented. Otherwise uploads will attempt model calls. Use only a disposable local database when exercising write endpoints; the media approval probe intentionally changes status.
