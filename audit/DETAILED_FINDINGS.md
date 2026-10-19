# Roar — Detailed Findings

Revision `ab03eba`. Severity follows realistic impact and exploitability, not checklist presence. Confidence: **Confirmed** (reproduced at runtime or unambiguous implementation evidence), **Probable** (strong evidence, full validation unavailable), **Potential** (risk requiring investigation).

Sources column maps to the specialist reports: **A** architecture, **B** security/privacy, **C** backend/data, **D** frontend/UX, **E** testing/DevOps. Findings were deduplicated and independently reviewed; runtime evidence was produced by the lead auditor.

---

## Summary table

| ID | Title | Severity | Confidence | Category | Primary evidence |
|---|---|---|---|---|---|
| F-01 | Unauthenticated fan writes with a single shared demo identity | High | Confirmed | AuthZ | `apps/api/src/server.ts:82-89,112-152,160-211` |
| F-02 | Approved "Only me"/"Security only" media is served publicly | High | Confirmed | Privacy/Access control | `apps/api/src/server.ts:242-254,401-414` |
| F-03 | No rate limiting, quotas, or abuse controls | High | Confirmed | Abuse/DoS | `apps/api/src/server.ts:15-22,160-211` |
| F-04 | Admin is a shared Basic password + static token; no RBAC/MFA/audit | High | Confirmed | Auth/session | `apps/admin/proxy.ts:5-30`, `apps/admin/lib/api.ts:6-13` |
| F-05 | SOS success screen fabricates a security response; no workflow exists | High | Confirmed | Safety/Product | `apps/web/app/sos/page.tsx:83-99` |
| F-06 | SOS payload is hardcoded, match-dependent, and cannot queue offline | High | Confirmed | Safety/Correctness | `apps/web/app/sos/page.tsx:24-37,75,107` |
| F-07 | Video-only capture can never pass the 0.6 AI confidence threshold | High | Confirmed | Product/AI | `apps/web/app/capture/page.tsx:65-94`, `packages/ai/src/index.ts:64`, `apps/api/src/agents.ts:12,56` |
| F-08 | AI jobs are fire-and-forget; failures swallowed, no retry/status | High | Confirmed | Reliability/Jobs | `apps/api/src/server.ts:149,209`, `apps/api/src/agents.ts:1-2` |
| F-09 | Private media/SOS text sent to external AI before audience check; EXIF retained | High | Confirmed | Privacy/AI | `apps/api/src/agents.ts:33-56`, `packages/ai/src/index.ts:52-113` |
| F-10 | Media stored on the API's local disk only | High | Confirmed | Storage/Reliability | `apps/api/src/server.ts:16,181-186,249-253` |
| F-11 | No tests, no CI, three apps skipped by typecheck, web lint red | High | Confirmed | Testing/CI | `package.json:8-18`; lint output |
| F-12 | No production build/run path for the API | High | Confirmed | DevOps/Build | `apps/api/package.json:7-9,20-23` |
| F-13 | Safety signals from fan media are discarded | High | Confirmed | Safety/AI | `packages/ai/src/index.ts:41-42`, `apps/api/src/agents.ts:46-56` |
| F-14 | Moment clustering uses upload time (±60 s) and is racy | Medium | Confirmed | Business logic | `apps/api/src/agents.ts:10-11,58-79` |
| F-15 | Moderation transitions can republish rejected media and orphan references | Medium | Confirmed | Moderation/Integrity | `apps/api/src/server.ts:347-348,385-412` |
| F-16 | Takedown does not revoke approved media or cached copies | Medium | Confirmed | Privacy/lifecycle | `apps/api/src/server.ts:252,371-414` |
| F-17 | No indexes on any FK/filter column | Medium | Confirmed | DB performance | `packages/database/prisma/migrations/0001_init/migration.sql` |
| F-18 | Failed/oversized uploads can orphan files; DB failure leaves blobs | Medium | Probable | Storage/reliability | `apps/api/src/server.ts:22,186-196` |
| F-19 | No idempotency for uploads/incidents; retries duplicate | Medium | Confirmed | Consistency | `apps/web/lib/uploads.ts:31-49,59-74` |
| F-20 | Media streaming has no Range/HEAD support | Medium | Confirmed | Media delivery | `apps/api/src/server.ts:242-254` |
| F-21 | Replay state is per-process; no realtime channel (15 s polling) | Medium | Confirmed | Scalability | `apps/api/src/replay.ts:9-23,32`, `apps/web/lib/live.ts:7-8,33` |
| F-22 | No graceful shutdown or readiness separation | Medium | Confirmed | Operations | `apps/api/src/server.ts:24-31,417` |
| F-23 | Admin has no security headers; web lacks CSP/HSTS | Medium | Confirmed | Security headers | `apps/admin/next.config.ts:7-18`, `apps/web/next.config.ts:20-40` |
| F-24 | Upload validation trusts client MIME/extension; no magic bytes/AV | Medium | Confirmed | Input validation | `apps/api/src/server.ts:163,183-186,250-253` |
| F-25 | AI outputs can be steered by user text (prompt injection) | Medium | Probable | AI integrity | `packages/ai/src/index.ts:102-113`, `apps/api/src/agents.ts:109-112` |
| F-26 | No deletion, retention, or erasure path | Medium | Confirmed | Privacy/compliance | `apps/api/src/server.ts:401-414` |
| F-27 | Demo scaffolding ships as working UI (dead links, inert controls, discarded caption, unsettable games) | Medium | Confirmed | UX/correctness | `apps/web/app/me/page.tsx:21-23`; `capture:139`; `play/call-it:73-80` |
| F-28 | Offline upload queue is unreliable and over-promised | Medium | Confirmed | Offline/PWA | `apps/web/lib/uploads.ts:59-74` |
| F-29 | Polling/selection races produce stale or wrong data | Medium | Confirmed | Client state | `apps/web/lib/live.ts:11-74`, `app/stats/page.tsx:23` |
| F-30 | Accessibility gaps: autoplay loops, duplicated controls, missing titles/h1, forced mic | Medium | Confirmed | Accessibility | `apps/web/app/live/page.tsx:47-49,106-113`, `app/layout.tsx:10-12` |
| F-31 | Feed mounts and autoplays every item | Medium | Probable | Performance | `apps/web/app/live/page.tsx:106-113` |
| F-32 | Admin UX: scaffold metadata, dark-mode contrast, partial error handling | Medium | Confirmed | Admin UX | `apps/admin/app/layout.tsx:15-18` |
| F-33 | Observability is request logs only | Medium | Confirmed | Observability | `apps/api/src/server.ts:15,149,209` |
| F-34 | 29 dependency advisories (mostly tooling), no CI gate | Medium | Confirmed | Supply chain | `npm audit` output |
| F-35 | Documentation stale/misleading (API.md, README app roles) | Medium | Confirmed | Docs/DX | `docs/API.md:5`, `README.md:7-9` |
| F-36 | Toolchain/dependency drift (TS, React, Expo versions) | Medium | Confirmed | Toolchain | workspace `package.json` files |
| F-37 | AI config is ambient and unvalidated; malformed endpoint in audit env | Medium | Confirmed | Integration/Config | `packages/ai/src/index.ts:9-11`; runtime 404 `/v1/v1/messages` |
| F-38 | Query params unvalidated (`since=abc`, `limit=-2`) | Low | Confirmed | API contract | `apps/api/src/server.ts:56-63` |
| F-39 | `playerIds` stores AI-supplied names, not player IDs | Low | Confirmed | Data integrity | `apps/api/src/agents.ts:50,76` |
| F-40 | Media URLs hardcode the web proxy prefix `/api/media/...` | Low | Confirmed | API contract | `apps/api/src/server.ts:216` |
| F-41 | Auth parsing errors return HTTP 500 | Low | Confirmed | Robustness | `apps/admin/proxy.ts:23`, `apps/api/src/server.ts:258-262` |
| F-42 | Env not validated at boot; compose exposes dev DB credentials | Low | Confirmed | Config/deployment | `apps/api/src/server.ts:20,417`; `docker-compose.yml:1-11` |
| F-43 | Mobile app is an Expo health-check stub | Low | Confirmed | Scope gap | `apps/mobile/App.tsx:7-24` |
| F-44 | Incident triage is a lost-update read-modify-write | Low | Probable | Concurrency | `apps/api/src/agents.ts:98-113` |
| I-01 | `workers/` and `infrastructure/` are empty stubs | Info | Confirmed | Scope note | `.gitkeep` files |
| I-02 | No tracked secrets or committed `.env` found | Info | Confirmed | Positive check | `git log --all -- .env` empty |
| I-03 | Fastify silently strips unknown body properties | Info | Confirmed | API behavior | runtime: extra property → 201 |

---

# High

## F-01 — Unauthenticated fan writes with a single shared demo identity
- **Severity/Confidence:** High / Confirmed. **Sources:** A-05, B-01, C-01, D-04.
- **Evidence:** `apps/api/src/server.ts:82-89` (`demoUser()` upsert on `demo@roar.local`), write routes at `:112-152` (incidents) and `:160-211` (media). Runtime: unauthenticated `POST /incidents` → **201**; unauthenticated multipart `POST /media` → **201**; every row is attributed to the demo user. The `Role` enum (`packages/database/prisma/schema.prisma:13-18`) is never enforced.
- **Root cause:** Fan authentication was deferred with no stand-in; identity is hardcoded and no route checks authorization.
- **Impact:** Anyone who can reach the API can submit fake MEDICAL/FIRE incidents, flood uploads (100 MB each), and pollute the feed with untraceable content. Combined with F-03 this is a trivial abuse/DoS path; combined with F-05 it can send responders to the wrong place.
- **Fix:** Add a session/OIDC flow, derive the acting user server-side, enforce role matrices on all write/admin/security routes, and keep demo identity behind an explicit flag.
- **Regression test:** Unauthenticated writes return 401; `reportedById` equals the session user; user A cannot read user B's private media.

## F-02 — Approved "Only me"/"Security only" media is served publicly
- **Severity/Confidence:** High / Confirmed. **Sources:** A-06, B-05, C-03; runtime reproduction by lead auditor.
- **Evidence:** `apps/api/src/server.ts:242-254` — the media-file gate is `if (media.status !== "APPROVED" && !moderatorPreview)`. Status alone authorizes serving; `audience` only gates the moderator preview. `:294-305` filters the admin list to `audience: "community"`, but `PATCH /admin/media/:id` (`:401-414`) accepts any media ID. The UI promises "Only me" / "Security only" (`apps/web/app/capture/page.tsx:220-231`) and "Shared with security only" (`apps/web/app/sos/page.tsx:75`).
- **Repro (local):** upload with `audience=security` → `GET /media/<id>/file` 404 while PROCESSING → `PATCH /admin/media/<id> {"status":"APPROVED"}` → `GET /media/<id>/file` → **200**, `Cache-Control: public, max-age=86400`. An approved `audience=me` clip also returned **200** (pre-approval access was not exercised).
- **Root cause:** There is no `canViewMedia(viewer, media, purpose)` policy; APPROVED is treated as public, and there is no owner/security reader route, so the intended audience can never see the clip while approval exposes it to everyone.
- **Impact:** A private or security-only clip that is ever approved becomes public and stays in caches for a day. The audience control fans are shown is non-functional in both directions.
- **Fix:** Enforce audience × ownership × role on `GET /media/:id/file`; reject non-community approval in the moderation endpoint; use short-lived signed URLs; purge caches on status change.
- **Regression test:** Audience×status×viewer matrix — approved private media 404/403 to others, 200 only to the authorized viewer; approving non-community media via moderation returns 4xx.

## F-03 — No rate limiting, quotas, or abuse controls
- **Severity/Confidence:** High / Confirmed. **Sources:** B-02, C-01, A-11; runtime probe by lead auditor.
- **Evidence:** `apps/api/src/server.ts:15-22` — Fastify is registered with only CORS and multipart; no `@fastify/rate-limit`, no body/part caps beyond `fileSize: 100 MB`, `files: 1`, and no per-user quota. `POST /incidents` (`:112-152`) has no throttle or dedupe. `apps/admin/proxy.ts:16-30` has no login throttling/lockout.
- **Repro (local):** 40 rapid `GET /health` requests → 40× 200, **zero 429**; uploads of 100 MB are accepted unauthenticated (per limit at `:17`).
- **Root cause:** Abuse controls were never implemented; the API assumes a trusted demo network.
- **Impact:** Disk exhaustion via uploads, unbounded DB/AI work per request (AI cost if configured — see F-37), incident spam that can poison safety triage, and unlimited admin password guessing.
- **Fix:** Per-IP + per-user rate limits and cooldowns, storage quotas, request/part caps, AI budget, and admin lockout.
- **Regression test:** Burst returns 429 after threshold; quota exhaustion leaves no partial file; admin lockout triggers and resets.

## F-04 — Admin is a shared Basic password + static token; no RBAC/MFA/audit
- **Severity/Confidence:** High / Confirmed. **Sources:** B-03, A-05, C-01.
- **Evidence:** `apps/admin/proxy.ts:5-30` (single user "admin", shared `ADMIN_PASSWORD`); `apps/admin/lib/api.ts:6-13` (server sends static `ADMIN_TOKEN`); `apps/api/src/server.ts:256-267` (`isAdmin` token gate); no audit table in the schema.
- **Root cause:** Role-based auth (TRD 2.9) deferred; the proxy is the sole authentication gate.
- **Impact:** One leaked credential or token grants full admin: read every SOS report with seat locations, publish/remove moments, approve/remove media — with no actor attribution for any action.
- **Fix:** OIDC with MFA, per-user short-lived tokens enforced in the API, role matrix (MODERATOR/SECURITY/ADMIN), audit logging, rotation, revocation.
- **Regression test:** Curator gets 403 on incident routes; every mutation writes an actor audit row; revoked token returns 401.

## F-05 — SOS success screen fabricates a security response; no workflow exists
- **Severity/Confidence:** High / Confirmed. **Sources:** A-04, D-02; route inspection by lead auditor.
- **Evidence:** `apps/web/app/sos/page.tsx:83-99` — static checklist "Alert sent", "Seen by security", "Steward on the way · ~2 min". The API only exposes `GET /admin/incidents[/:id]` (`apps/api/src/server.ts:269-282`); a repository-wide search of `apps/admin` found **no** incident route or UI, and no status-transition endpoint exists. `IncidentStatus`/`IncidentMedia` are modelled (`schema.prisma`) but unused.
- **Root cause:** The incident lifecycle was modelled but never wired; the success screen was built as a prototype.
- **Impact:** Fans in an emergency may rely on a response that never happened instead of seeking a steward or calling 999. This is the most serious safety defect in the project.
- **Fix:** Build the security dashboard and incident state machine; drive the SOS UI from real status (receipt-only until ACKNOWLEDGED); never show unbacked claims.
- **Regression test:** POST → ACKNOWLEDGED → ASSIGNED → RESOLVED works, invalid transition returns 409, SOS shows only "sent" until acknowledged.

## F-06 — SOS payload is hardcoded, match-dependent, and cannot queue offline
- **Severity/Confidence:** High / Confirmed. **Sources:** D-01, D-03.
- **Evidence:** `apps/web/app/sos/page.tsx:29` sends `section: me.section, row: String(me.row)` from `apps/web/lib/data.ts:6` — every alert claims "Section C · Row 12". `:28` requires a loaded match before sending; `:33` blames connectivity on failure. `apps/web/public/sw.js:71-72` deliberately does not cache API writes, and no offline queue exists for incidents.
- **Root cause:** Demo profile constants reused as emergency payload; emergency flow depends on unrelated match APIs and has no offline path.
- **Impact:** Responders can be sent to the wrong location; on a cold stadium network outage the fan completes the flow and nothing is sent; the error text provides no `tel:` fallback.
- **Fix:** Mandatory editable seat/location (or ticket-derived), venue-keyed incidents independent of match state, offline queue + retry, `tel:`/999 fallback.
- **Regression test:** Submitting from two seats produces two distinct sections; cold offline submission queues and flushes; no match loaded still sends.

## F-07 — Video-only capture can never pass the 0.6 AI confidence threshold
- **Severity/Confidence:** High / Confirmed. **Sources:** A-01, C-10; verified against source.
- **Evidence:** `apps/web/app/capture/page.tsx:65-94` — the camera flow only creates `MediaRecorder` video blobs (no photo capture); `:150-167` simulates the AI steps on a timer. `packages/ai/src/index.ts:62-65` instructs the model, for media it cannot see, to "keep confidence at 0.5 or below". `apps/api/src/agents.ts:12` sets `MIN_CONFIDENCE = 0.6`, and `:56` returns before creating a Moment when `confidence < MIN_CONFIDENCE`.
- **Root cause:** Two independently reasonable decisions (video cannot be analysed; low-confidence analyses are dropped) compose into a dead loop for the only capture path the UI offers.
- **Impact:** The flagship record → AI → Moment journey cannot complete; fans see a simulated success screen that claims the clip joins a Moment. Demo value depends entirely on manual admin curation.
- **Fix:** Analyse a poster frame/scaled video, calibrate the threshold, and create a PROCESSING draft for reviewable footage instead of dropping; add photo capture.
- **Regression test:** A 0.9-confidence video analysis creates a PROCESSING Moment; a 0.55 result surfaces "pending review" instead of silently disappearing.

## F-08 — AI jobs are fire-and-forget; failures swallowed, no retry/status
- **Severity/Confidence:** High / Confirmed. **Sources:** A-08, C-02, E-04; runtime evidence.
- **Evidence:** `apps/api/src/server.ts:149` and `:209` — `void triageIncident(...)` / `void processUpload(...)` with `.catch(log)`; `apps/api/src/agents.ts:1-2` acknowledges "in-process for now". No job table, retry, timeout, or FAILED state exists. Runtime logs show `"Moment agents failed"` and `"Safety Analyst failed"` (404 from the AI endpoint), after which the media row remained `PROCESSING` with no error state for operators.
- **Root cause:** Jobs run inline in the API process with no durability or bookkeeping.
- **Impact:** Restarts/crashes lose in-flight analysis; AI or network faults leave uploads permanently stuck; a failed SOS triage leaves the rule-based severity only (acceptable) but with no visibility that AI refinement failed. SPEC 5.5 retry requirements are unmet.
- **Fix:** Durable queue/outbox with idempotent workers, attempts/backoff, job status surfaced to admins, dead-letter handling, stuck-job alerts.
- **Regression test:** Kill the API mid-job → job resumes/fails visibly; AI outage produces retryable state, not endless PROCESSING; duplicate delivery creates one Moment.

## F-09 — Private media/SOS text sent to external AI before the audience check; EXIF retained
- **Severity/Confidence:** High / Confirmed (code) with runtime outbound attempts. **Sources:** B-06; lead audit.
- **Evidence:** `apps/api/src/agents.ts:33-56` — `processUpload` reads the file, base64-encodes the image (`packages/ai/src/index.ts:59-66`) and calls the model **before** the audience gate at `agents.ts:56`. Runtime: during three local uploads (community/security/me) the server issued outbound AI requests for each, including the private-audience ones. `apps/api/src/server.ts:181-186` stores raw bytes and `:249-253` streams them back, so EXIF/GPS is never stripped. The UI promises "Your section is attached to clips, never your GPS" (`capture/page.tsx:212`) and "Shared with security only" (`sos/page.tsx:75`).
- **Root cause:** Analysis is unconditional; storage/serving are pass-through; no consent gate or EXIF sanitization.
- **Impact:** Private fan photos and safety-report text are sent toward a third-party LLM service (attempted at runtime; the configured endpoint returned 404); photos can carry precise GPS metadata; the privacy copy is inaccurate.
- **Fix:** Gate AI on audience/consent, strip EXIF/re-encode images, redact incident text before model calls, document the subprocessor, and align UI copy.
- **Regression test:** Stored images contain no GPS tags; security/me uploads never trigger a model call; SOS payload shows only redacted fields in provider requests.

## F-10 — Media stored on the API's local disk only
- **Severity/Confidence:** High / Confirmed. **Sources:** E-03, C-09; README marks workers/infrastructure as not started.
- **Evidence:** `apps/api/src/server.ts:16` (`join(process.cwd(), "uploads")`), `:181-186` (write), `:249-253` (read). No object storage, replication, backup, lifecycle, or orphan cleanup.
- **Impact:** Any redeploy/instance loss destroys all fan media; multiple API instances cannot share files; disk exhaustion is unmitigated (see F-03/F-18).
- **Fix:** Move to Azure Blob/S3 with encryption, lifecycle rules, signed URLs, and a cleanup job; keep local disk behind a dev flag.
- **Regression test:** Restart/redeploy retains media; two instances serve the same asset; lifecycle deletes orphans.

## F-11 — No tests, no CI, three apps skipped by typecheck, web lint red
- **Severity/Confidence:** High / Confirmed. **Sources:** E-01, E-02, E-06, D-18; lead audit commands.
- **Evidence:** Root `package.json:8-18` has no `test` script; `npm test` → "Missing script". No `.github/` or CI config exists. `typecheck` uses `--workspaces --if-present`, and web/admin/mobile have no `typecheck` script, so the root command silently skips them (`npx tsc --noEmit` run manually passes today). `npm run lint -w @inside/web` exits 1 with 4 errors: `apps/web/app/page.tsx:18`, `app/stats/page.tsx:27`, `components/Pwa.tsx:50`, `lib/live.ts:70` (React Compiler setState-in-effect rule).
- **Root cause:** Quality gates are local and optional; no automated suite exists for safety-critical flows.
- **Impact:** Regressions in SOS, upload, auth, and moderation can ship unnoticed; the root typecheck gives false confidence about frontends.
- **Fix:** Add Vitest/Playwright coverage for SOS/upload/moderation/media ACL, a real root `test` script, typecheck scripts for all apps, and CI running install/typecheck/lint/test/build/audit.
- **Regression test:** A deliberate type error in web fails root typecheck; PR with failing lint is blocked; `npm test` covers the critical paths.

## F-12 — No production build/run path for the API
- **Severity/Confidence:** High / Confirmed. **Sources:** E-05, A-12.
- **Evidence:** `apps/api/package.json:7-9` — `"start": "tsx --env-file=../../.env src/server.ts"`, with `tsx` in `devDependencies:20-24`. No Dockerfile, no compiled output, no release script; `docker-compose.yml` runs only Postgres.
- **Impact:** `npm ci --omit=dev` cannot start the API; deployments are non-reproducible and tied to repo-relative `.env` paths.
- **Fix:** Compile to `dist` and run `node dist/server.js`, add a multi-stage non-root Dockerfile with healthcheck, document migrations and rollback.
- **Regression test:** Clean production install builds and starts; container healthcheck passes; API starts without devDependencies.

## F-13 — Safety signals from fan media are discarded
- **Severity/Confidence:** High / Confirmed. **Sources:** A-07, C-11.
- **Evidence:** `packages/ai/src/index.ts:41-42` — `MomentAnalysis` returns `severity` and `safetyRelevant`; `apps/api/src/agents.ts:48-56` persists neither `safetyRelevant` nor any incident link and returns early for `SECURITY`/`OTHER`. The `IncidentMedia` model exists but is never written.
- **Impact:** A fan photo/video showing violence, fire, or injury never reaches security; only the separate SOS form creates incidents. The product's promise that "the same infrastructure can identify and surface potential safety incidents" is unimplemented.
- **Fix:** Persist safety fields, create/attach incidents for MEDIUM+ signals with dedupe, notify security roles, link media via `IncidentMedia` without making it public.
- **Regression test:** A mocked SECURITY/`safetyRelevant=true` analysis creates a linked incident visible only to security, including `audience=security` clips that stay non-public.

---

# Medium

## F-14 — Moment clustering uses upload time (±60 s) and is racy
- **Severity/Confidence:** Medium / Confirmed (code); race is Probable under load. **Sources:** A-02, C-05.
- **Evidence:** `apps/api/src/agents.ts:10-11` (`CLUSTER_MS = 60_000`), `:60-63` matches on `createdAt` (server insert time), `:74` stores `timestamp: media.capturedAt` (also server upload time; `apps/api/src/server.ts:204`). `:59` even comments that two uploads racing can each start a Moment.
- **Impact:** Offline-delayed clips join the wrong Moment or split from clips captured seconds apart; spec proximity (~10-30 s) is not honoured.
- **Fix:** Client-supplied capture timestamp + official-event anchor, a ≤10 s window, and a per-match lock/transaction.
- **Regression test:** Clips captured 5 s apart but uploaded 10 min apart join one Moment; clips 5 min apart uploaded together stay separate; 5 concurrent uploads create one Moment.

## F-15 — Moderation transitions can republish rejected media and orphan references
- **Severity/Confidence:** Medium / Confirmed. **Sources:** A-09, C-06.
- **Evidence:** `apps/api/src/server.ts:347-348` publishing a Moment approves linked media unconditionally; `:385-390` re-publish only re-approves `PROCESSING` media; `:409-411` rejects/removes moments only where the media is `bestMediaId`, leaving non-best-angle Moments intact.
- **Impact:** Rejected content can be republished; removed clips can leave Moments whose angles 404; no server-side state machine guards transitions.
- **Fix:** Enforce a moderation state machine (rejected→re-review, publish requires APPROVED), clean all `MomentMedia` references, surface conflicts as 409.
- **Regression test:** Publishing with rejected media returns 409; removing a non-best angle updates the Moment and bestMedia.

## F-16 — Takedown does not revoke approved media or cached copies
- **Severity/Confidence:** Medium / Confirmed. **Sources:** B-04, A-10.
- **Evidence:** `apps/api/src/server.ts:252` sets `public, max-age=86400` for APPROVED media; `:371-399` (moment REMOVED) never changes media status; `:401-414` (media REMOVED) does not purge caches.
- **Impact:** After a takedown, previously fetched URLs and intermediary caches can keep serving removed content for up to a day.
- **Fix:** Separate moderation cache policy (`no-store`/short TTL), revoke/rotate URLs on status change, cascade removal decisions, purge CDN.
- **Regression test:** After REMOVED, a fresh request is 404/no-store and cache purge is invoked.

## F-17 — No indexes on any FK/filter column
- **Severity/Confidence:** Medium / Confirmed. **Sources:** C-08, A-16.
- **Evidence:** Only three unique indexes exist (`migration.sql:180-186`: users.email, ai_analysis.media_id, reactions(moment_id,user_id)). Hot queries (`server.ts:231-239` moments by matchId+status ordered by promoted/createdAt; `:294-305` media by audience ordered by uploadedAt; `:269-276` incidents by matchId ordered by createdAt; `agents.ts:60-63`, `:104-106`) have no supporting indexes.
- **Impact:** Full scans and expensive sorts as data grows; incident triage and feed latency degrade first.
- **Fix:** Composite indexes (matchId,status,createdAt), (matchId,createdAt), (audience,uploadedAt), (matchId,eventType,source,createdAt); verify with EXPLAIN ANALYZE.
- **Regression test:** EXPLAIN shows index scans for the main list queries.

## F-18 — Failed/oversized uploads can orphan files; DB failure leaves blobs
- **Severity/Confidence:** Medium / Probable. **Sources:** A-11, E-07.
- **Evidence:** `apps/api/src/server.ts:186` streams to disk before any DB work; `:187-190` relies on the multipart plugin throwing for oversize (`throwFileSizeLimit` default true), which skips the `truncated` cleanup; `:192-208` has no `finally` cleanup if `ensureMatch`/DB fails after the write.
- **Impact:** Repeated failing uploads accumulate orphaned private blobs and can exhaust disk; no quota or sweeper exists.
- **Fix:** Write to a temp file and move atomically, wrap write+DB in try/finally with cleanup, handle the plugin's size error explicitly, add an orphan sweeper.
- **Regression test:** Over-limit upload returns 413 with no new file; injected DB error removes the file.

## F-19 — No idempotency for uploads/incidents; retries duplicate
- **Severity/Confidence:** Medium / Confirmed. **Sources:** C-04, E-09.
- **Evidence:** `apps/web/lib/uploads.ts:31-49` posts without a key and retries at `:59-74`; `apps/api/src/server.ts:112-152` creates a new incident per POST; `agents.ts:48-53` inserts `ai_analysis` with a unique `mediaId`, so a retried analysis throws.
- **Impact:** Flaky-network retries duplicate incidents and media; duplicate triage/AI work; unique constraint failures on retried analysis.
- **Fix:** Accept client idempotency keys with unique constraints; return the existing row on replay; make AI inserts upserts.
- **Regression test:** Same key twice → one row, same ID; timeout retry returns the original incident.

## F-20 — Media streaming has no Range/HEAD support
- **Severity/Confidence:** Medium / Confirmed. **Sources:** A-10, D-11, C-15.
- **Evidence:** `apps/api/src/server.ts:242-254` sends a raw `createReadStream` with no `Range`/`Content-Range`/`Accept-Ranges`; the admin preview proxy (`apps/admin/app/media/[id]/route.ts:4-11`) forwards the body without range semantics.
- **Impact:** Seeking fails and Safari/iOS may refuse playback; large clips are re-downloaded whole; moderator preview is slow. This undermines the core video feed.
- **Fix:** Implement 206 partial content (or serve via a CDN/storage with range support) and forward `Range` through the admin proxy.
- **Regression test:** `Range: bytes=0-1023` → 206 + Content-Range; seek works in Safari.

## F-21 — Replay state is per-process; no realtime channel
- **Severity/Confidence:** Medium / Confirmed. **Sources:** A-13, C-16.
- **Evidence:** `apps/api/src/replay.ts:9-23` builds datasets and a `boot` clock in module memory; `:32` restart mutates process state; `apps/web/lib/live.ts:7-8,33` polls every 15 s. SPEC targets <5 s feed updates and Web PubSub realtime.
- **Impact:** Replicas disagree on match state; restarts reshuffle the demo schedule; feed updates lag up to 15 s.
- **Fix:** Extract `buildApp()` with injected state/clock, share replay state (Redis/DB), add SSE/WebSocket pub-sub with polling fallback.
- **Regression test:** Two instances agree at the same wall clock; realtime update arrives <5 s.

## F-22 — No graceful shutdown or readiness separation
- **Severity/Confidence:** Medium / Confirmed. **Sources:** C-17, E-08.
- **Evidence:** `apps/api/src/server.ts:417` only calls `app.listen`; there is no SIGTERM drain, no `prisma.$disconnect`, and `/health` (`:24-31`) is a single unbounded `SELECT 1` used for both liveness and readiness.
- **Impact:** Deploys cut in-flight uploads/AI jobs; a slow DB hangs health checks; connection pools leak on restart.
- **Fix:** SIGTERM handler draining requests and AI work, `app.close()`, Prisma disconnect, and separate bounded `/livez` + `/readyz`.
- **Regression test:** SIGTERM during upload completes cleanly; readiness fails/recover with DB.

## F-23 — Admin has no security headers; web lacks CSP/HSTS
- **Severity/Confidence:** Medium / Confirmed. **Sources:** B-08; agent runtime probe.
- **Evidence:** `apps/web/next.config.ts:20-40` sets nosniff/XFO/Referrer-Policy/Permissions-Policy but no CSP/HSTS; `apps/admin/next.config.ts:7-18` defines no headers, and `apps/admin/proxy.ts` adds none.
- **Impact:** The admin (which holds incident PII and moderation power) can be framed and lacks baseline hardening; `X-Powered-By` leaks framework info.
- **Fix:** Add CSP (`frame-ancestors 'none'`), XFO, nosniff, HSTS, Permissions-Policy centrally (proxy/middleware), disable `X-Powered-By`.
- **Regression test:** Automated header assertions on `/`, `/curate`, and 401 responses; framing blocked.

## F-24 — Upload validation trusts client MIME/extension; no magic bytes/AV
- **Severity/Confidence:** Medium / Confirmed. **Sources:** B-10, C-15.
- **Evidence:** `apps/api/src/server.ts:163` classifies by client `mimetype`; `:183` derives the stored extension from the client filename; `:250-253` chooses the response content-type from the extension and defaults to `image/jpeg`; no content sniffing, re-encode, or AV. API responses carry no `X-Content-Type-Options`.
- **Impact:** Any bytes can be stored and later served under an image/video content-type (HTML/SVG declared as images, malware hosting); parser abuse is possible for consumers that ignore content-type.
- **Fix:** Magic-byte validation, re-encode/transcode, strict extension allowlist, `nosniff` on media responses, separate media domain, AV scanning.
- **Regression test:** HTML bytes declared `image/png` return 415; stored files are canonical; media responses include nosniff.

## F-25 — AI outputs can be steered by user text (prompt injection)
- **Severity/Confidence:** Medium / Probable. **Sources:** B-11, C-11.
- **Evidence:** `packages/ai/src/index.ts:102-113` interpolates the SOS description into the prompt; `apps/api/src/agents.ts:109-112` applies the model's `type` unconditionally (severity only ever rises). Media captions/descriptions feed analysis prompts similarly.
- **Impact:** A crafted description can relabel an incident type or misclassify a Moment; the severity floor prevents downgrades of CRITICAL/MEDIUM but not type confusion or feed manipulation.
- **Fix:** Treat model output as untrusted suggestions; keep the reporter's type immutable (display AI type as a suggestion), require confirmation for changes, delimit/validate inputs, log overrides.
- **Regression test:** Injection strings cannot change the stored type without moderator confirmation; severity never decreases.

## F-26 — No deletion, retention, or erasure path
- **Severity/Confidence:** Medium / Confirmed. **Sources:** B-07, C-09.
- **Evidence:** `apps/api/src/server.ts` exposes no DELETE route; `:401-414` only changes status; files remain on disk and rows in the DB; no retention job or backup-expiry assumption is documented.
- **Impact:** Rejected/removed media and incident PII persist indefinitely; fans cannot exercise erasure; backups keep copies. Privacy/regulatory exposure grows with real users.
- **Fix:** Define per-class retention, add hard-delete endpoints + background purge with cascades and cache purge, document backups.
- **Regression test:** Delete removes row+file and invalidates caches; rejected media purged after the retention window.

## F-27 — Demo scaffolding ships as working UI
- **Severity/Confidence:** Medium / Confirmed. **Sources:** A-14, D-05, D-06, D-09, D-10.
- **Evidence:** `apps/web/app/me/page.tsx:21-23` links `/moment/goal-7214`, `celebration-7220`, `save-6402` — IDs no API can resolve (events are `<fixtureId>-<seq>`); `apps/web/app/live/page.tsx:36-37` and `moment/[id]/MomentView.tsx:45-46` render React/Share buttons with no handlers; leaderboard tabs (`play/leaderboard:28-30`) only restyle; the caption field (`capture/page.tsx:139`) has no state and is omitted from the upload at `:94`; Call It (`play/call-it/page.tsx:73-80`) never records or settles; the quiz (`lib/data.ts:9-12`) asks about Arsenal in a fictional league.
- **Impact:** Fans hit dead ends and lose typed content; "working" affordances erode trust; game rewards/copy are false.
- **Fix:** Wire real data, disable/label mock controls, persist captions/predictions, derive quiz content from the synthetic fixture.
- **Regression test:** All `/me` tiles resolve; tabs change data; caption appears in the stored media; React/Share either call an API or are visibly disabled.

## F-28 — Offline upload queue is unreliable and over-promised
- **Severity/Confidence:** Medium / Confirmed. **Sources:** D-07, E-07.
- **Evidence:** `apps/web/lib/uploads.ts:59-74` flushes only on mount and `online`; `:64-70` silently drops items the API rejects; `apps/web/components/Pwa.tsx:16-18` registers those two triggers only. Capturing offline requires a loaded match (`capture/page.tsx:88-90`), and `capture/page.tsx:178-180` awards "+50 crowns" regardless of acceptance.
- **Impact:** API-only outages leave clips queued indefinitely; a cold offline launch cannot queue; fans lose clips without notice while being told they were saved and rewarded.
- **Fix:** Periodic/visibility/backoff flush, queue before match association, surface queue state and rejections, award crowns only on acceptance.
- **Regression test:** Kill only the API, queue a clip, restore it → auto-flush; rejection shows an error and keeps/removes the item visibly.

## F-29 — Polling/selection races produce stale or wrong data
- **Severity/Confidence:** Medium / Confirmed. **Sources:** D-08.
- **Evidence:** `apps/web/lib/live.ts:11-74` — no abort/sequence guard on polls, `localStorage` match selection applied after mount, `setInterval` polls overlap with no visibility pause; `apps/web/app/stats/page.tsx:23` keeps showing insights for the previous fixture while the new one loads; `apps/web/app/page.tsx:11-22` conflates "visited" with match selection.
- **Impact:** Scores can regress to older responses; stats can be shown under the wrong fixture; returning users skip onboarding unintentionally; secondary feed/insights errors are silent.
- **Fix:** Initialize selection synchronously, stamp/abort requests, ignore out-of-order responses, pause polling when hidden, separate onboarding flag, surface secondary errors.
- **Regression test:** Delayed/reordered responses never regress state; switching fixtures clears old stats immediately.

## F-30 — Accessibility gaps
- **Severity/Confidence:** Medium / Confirmed. **Sources:** D-12, D-13, D-14.
- **Evidence:** `apps/web/app/live/page.tsx:47-49` autoplays looping video with no pause control (WCAG 2.2.2) and `:106-113` duplicates header/rail controls per slide for assistive tech; `app/layout.tsx:10-12` gives every route the title "Roar" and key pages have no `h1` (`home`, `live`, `stats`); `capture/page.tsx:51-62` requires microphone permission to record video and reports denial as a camera failure.
- **Impact:** Motion-sensitive users cannot stop video; screen-reader and keyboard users face repetitive/ambiguous navigation; fans who deny the mic (common) cannot capture clips and are misled about why.
- **Fix:** Pause/reduced-motion handling for autoplay, render shared chrome once, per-route metadata + one `h1`, request video first with optional audio and specific error messages.
- **Regression test:** axe pass on key routes; reduced-motion emulation stops autoplay; mic-denied recording works or shows an accurate message.

## F-31 — Feed mounts and autoplays every item
- **Severity/Confidence:** Medium / Probable. **Sources:** D-16.
- **Evidence:** `apps/web/app/live/page.tsx:106-113` renders the full ranked list (`rankFeed` in `lib/feed.ts:10-11`, API bounded to 50 moments at `server.ts:236` plus official events) with autoplaying videos and no virtualization/visibility gating.
- **Impact:** Dozens of simultaneous decoders cause jank, memory/battery/data drain on mid-range phones.
- **Fix:** Virtualize/cap the snap feed and mount/play media only when visible.
- **Regression test:** Profile a finished match on a mid-range device; decoder count stays bounded.

## F-32 — Admin UX: scaffold metadata, dark-mode contrast, partial error handling
- **Severity/Confidence:** Medium / Confirmed. **Sources:** D-15.
- **Evidence:** `apps/admin/app/layout.tsx:15-18` still has `title: "Create Next App"`; scaffold theme tokens (`app/globals.css`) make the curate page unreadable in dark mode; `curate/page.tsx` fetch paths only branch on some status codes, so a 401/500 can crash or silently fail curation.
- **Impact:** Curators on dark mode cannot read the page; browser tabs are indistinguishable; moderation actions can fail without feedback.
- **Fix:** Real metadata, force a light surface or add dark variants, handle `res.ok` with error states.
- **Regression test:** Dark mode legible; title correct; simulated 500 from `/admin/moments` shows an error state.

## F-33 — Observability is request logs only
- **Severity/Confidence:** Medium / Confirmed. **Sources:** E-11.
- **Evidence:** `apps/api/src/server.ts:15` enables Fastify logging; `:149,209` log AI job failures only. No metrics, tracing, job/queue visibility, SOS alerting, or SLOs exist.
- **Impact:** Failures are discovered by users; media stuck in PROCESSING and untriaged incidents are invisible; no basis for on-call.
- **Fix:** Request/job IDs, metrics (uploads, job outcomes, AI latency/errors), tracing, error tracking, and alerts for SOS and stuck jobs.
- **Regression test:** Fault injection in staging raises alerts; traces span upload → AI → Moment.

## F-34 — 29 dependency advisories (mostly tooling), no CI gate
- **Severity/Confidence:** Medium / Confirmed (advisory counts); reachability Potential. **Sources:** B-12, E-12.
- **Evidence:** `npm audit` → 29 vulnerabilities (22 high, 7 moderate, 0 critical); `--omit=dev` → 26 (19 high, 7 moderate), concentrated in Expo CLI/Metro, ESLint chains, and Prisma CLI tooling rather than Next/Fastify/Anthropic runtime packages.
- **Impact:** Tooling/CI risk today; runtime reachability unproven. Without an audit gate, a future runtime advisory can land silently.
- **Fix:** Reachability triage, incremental upgrades (`npm audit fix` without `--force`), split runtime/build deps, add SCA + SBOM to CI.
- **Regression test:** CI fails on new high/critical outside an allowlist; production-only audit trends clean.

## F-35 — Documentation stale/misleading
- **Severity/Confidence:** Medium / Confirmed. **Sources:** A-15, E-15.
- **Evidence:** `docs/API.md:5` says "Implemented so far: `GET /health`" while ~18 routes exist; `README.md:7-9` presents `apps/mobile` as the fan app though it is a health-check stub and the real fan client is `apps/web`; `docs/OBJECTIVE.md` mixes vision with current state; Azure/Fabric/workers are described structurally but directories are empty.
- **Impact:** Reviewers and integrators waste time on wrong assumptions; hidden endpoints; wrong expectations about deliverables.
- **Fix:** Implemented/Partial/Planned status matrix, corrected app roles, generated OpenAPI/route table, mark vision docs as aspirational.
- **Regression test:** Docs link/route check in CI; release checklist requires the matrix.

## F-36 — Toolchain/dependency drift
- **Severity/Confidence:** Medium / Confirmed. **Sources:** E-13, E-16.
- **Evidence:** Root `package.json` has no `engines`, `packageManager`, `.nvmrc`, or `.node-version`; TypeScript 5.9.3 (api/packages) vs 6.0.3 (mobile); React 19.2.3 (mobile) vs 19.3.0 (web/admin); Expo 57.0.27 installed vs 57.0.30 expected by `expo install --check`; `expo-doctor` 19/21.
- **Impact:** CI/local drift, inconsistent compile/lint semantics, duplicate React copies risking Metro/runtime issues.
- **Fix:** Pin Node via `engines`/`packageManager`/`.nvmrc`, align TS and React, run `npx expo install --fix`, add doctor to CI.
- **Regression test:** `npm ci` on pinned Node passes; `npm ls react` shows one version; expo-doctor 21/21.

## F-37 — AI config is ambient and unvalidated; malformed endpoint in the audit environment
- **Severity/Confidence:** Medium / Confirmed. **Source:** lead audit runtime + `packages/ai/src/index.ts:9-11`.
- **Evidence:** The client picks `new AnthropicFoundry()` if a Foundry env var exists, else `new Anthropic()` if `ANTHROPIC_API_KEY` exists. The Anthropic SDK silently honours the ambient `ANTHROPIC_BASE_URL` (`node_modules/@anthropic-ai/sdk/client.js:71`). In the audit environment those variables are set at OS **User** scope (with a base URL ending in `/v1`), even though the repo `.env` documents none of them. Every AI call therefore went to `POST /v1/v1/messages` and returned **404** (`Moment agents failed`, `Safety Analyst failed` in the API log). `.env.example:12-16` documents only `ANTHROPIC_FOUNDRY_RESOURCE`/keys and claims "Leave all three empty to run without AI", which is false here.
- **Impact:** AI silently never works in this environment; private data was still sent (F-09) and failures were invisible (F-08). Local demos can behave differently from `.env` expectations because OS-level credentials override the documented setup.
- **Fix:** Validate/normalize AI configuration at startup (explicitly set `baseURL`, reject values ending in `/v1` for SDK-relative paths), support an explicit `AI_ENABLED`/dry-run flag, document `ANTHROPIC_FOUNDRY_BASE_URL`/`ANTHROPIC_BASE_URL`, and fail loudly with actionable diagnostics.
- **Regression test:** Start with the ambient misconfiguration → clear startup warning or refusal to enable AI; a request reaches the configured endpoint with a single `/v1`; `.env`-only environments disable AI as documented.

---

# Low

## F-38 — Query params unvalidated (`since=abc`, `limit=-2`)
- **Severity/Confidence:** Low / Confirmed. **Sources:** C-14; runtime.
- **Evidence:** `apps/api/src/server.ts:56-63` — `Number("abc")` → NaN filters out every event (returns 200 with 0 events); `Number("-2")` is truthy so `limit` becomes −2 and `slice(0,-2)` drops from the end (runtime returned 648 of 650 events). No schema validation on query strings.
- **Impact:** Clients silently get wrong pages; negative limits produce odd payloads. Low abuse potential.
- **Fix:** Validate with a Fastify schema, clamp limits, return 400 for non-integer/negative values.
- **Test:** `since=abc`, `limit=-1` → 400 or documented clamping.

## F-39 — `playerIds` stores AI-supplied names, not player IDs
- **Severity/Confidence:** Low / Confirmed. **Sources:** A-16, C-13.
- **Evidence:** `packages/ai/src/index.ts:40` returns player **names**; `apps/api/src/agents.ts:50,76` writes them into `playerIds`; the schema field name implies IDs and there is no resolution step.
- **Impact:** Player-based queries/aggregations are unreliable; data model misleads future features.
- **Fix:** Resolve names to canonical IDs at write time (or rename the field and store names intentionally), validate against the dataset.
- **Test:** Written `playerIds` are a subset of known player IDs.

## F-40 — Media URLs hardcode the web proxy prefix `/api/media/...`
- **Severity/Confidence:** Low / Confirmed. **Sources:** A-17.
- **Evidence:** `apps/api/src/server.ts:216` returns `/api/media/<id>/file`, a path that only resolves through the web app's Next rewrite (`apps/web/next.config.ts:17-19`); the mobile app and direct API consumers have no such prefix.
- **Impact:** Non-web clients cannot load returned media URLs.
- **Fix:** Return canonical `/media/:id/file` or a configured absolute/signed URL.
- **Test:** Fetching the API-returned URL from a non-web origin succeeds.

## F-41 — Auth parsing errors return HTTP 500
- **Severity/Confidence:** Low / Confirmed. **Sources:** B-13; runtime for both cases.
- **Evidence:** `apps/admin/proxy.ts:23` calls `atob` without try/catch — `Authorization: Basic !!!` produced 500 in agent B's runtime probe. `apps/api/src/server.ts:258-262` compares `.length` then `timingSafeEqual(Buffer.from(token), Buffer.from(expected))`; a crafted header of equal string length but different UTF-8 byte length threw `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` → HTTP 500 (reproduced; API log line confirms `RangeError: Input buffers must have the same byte length`, `isAdmin ... server.ts:261`).
- **Impact:** Unauthenticated clients can generate 500s/log noise; no bypass, but a robustness defect. Fixing also removes error-based signal.
- **Fix:** try/catch around base64 decode and Buffer comparison; compare digests or fixed-length HMACs; always return 401.
- **Test:** Malformed/missing-colon/oversized/non-ASCII tokens → 401, never 500.

## F-42 — Env not validated at boot; compose exposes dev DB credentials
- **Severity/Confidence:** Low / Confirmed. **Sources:** E-14, B-09.
- **Evidence:** `apps/api/src/server.ts:20,417,258-262` uses silent defaults (`CORS_ORIGINS`, `API_PORT`, missing `ADMIN_TOKEN` disables admin); `docker-compose.yml:1-11` publishes Postgres `5432` with `inside/inside`. `.env.example` lists only a few variables; no schema validation.
- **Impact:** Misconfiguration fails late or silently; published DB with known credentials in shared dev environments.
- **Fix:** Schema-validated env at startup with clear failures, document all required variables, remove the DB port publish (or bind localhost), use strong credentials via secret manager.
- **Test:** Unset required var fails startup with a clear message.

## F-43 — Mobile app is an Expo health-check stub
- **Severity/Confidence:** Low / Confirmed. **Sources:** D-17, A-15.
- **Evidence:** `apps/mobile/App.tsx:7-24` shows "INSIDE THE GAME" and an API status string; no fan journeys; `app.json` template branding; no typecheck/lint scripts.
- **Impact:** The documented mobile deliverable does not exist; reviewers may mistake the web PWA for it.
- **Fix:** Build the real app or remove it from production scope and correct docs.
- **Test:** Documented mobile journey works in Expo.

## F-44 — Incident triage is a lost-update read-modify-write
- **Severity/Confidence:** Low / Probable. **Sources:** C-12.
- **Evidence:** `apps/api/src/agents.ts:98-113` reads the incident, computes severity, then updates with no version/conditional write.
- **Impact:** Concurrent edits (future acknowledgement/assignment flows) can be overwritten; today there is a single writer, so impact is latent.
- **Fix:** Conditional update (`WHERE severity = ...`) or optimistic version column.
- **Test:** Two concurrent triage updates leave no lost data.

---

# Informational

## I-01 — `workers/` and `infrastructure/` are empty stubs
`.gitkeep` only in `workers/{media-analysis,moment-engine,incident-engine}` and `infrastructure/{azure,github}`. README marks these as not started. No defect, but no deployment or queue exists despite docs referencing them.

## I-02 — No tracked secrets or committed `.env`
`git log --all -- .env` is empty; `.env` is ignored; repository grep found no API keys or private keys outside the empty `.env.example`. Positive hygiene check.

## I-03 — Fastify silently strips unknown body properties
Because Fastify's Ajv defaults include `removeAdditional`, `POST /incidents` with an extra property returned 201 with the field stripped rather than 400 (runtime). Acceptable, but if strict rejection is intended, set `ajv.customOptions.removeAdditional = false` and test.
