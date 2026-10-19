# Roar — Prioritized Remediation Plan

Ordered by risk and dependency, not by effort. Effort is relative: **S** ≈ hours–1 day, **M** ≈ 1–3 days, **L** ≈ 1–2 weeks. No fixes were applied during the audit; this plan is for approval.

**P0 — Immediate:** required before any exposure to real fans or an untrusted network.
**P1 — Before production / next release:** release blockers and safety-critical correctness.
**P2 — Important improvements:** medium defects, performance, maintainability.
**P3 — Incremental:** low-severity cleanup and docs.

---

## P0 — Immediate (do not expose until done)

### P0-1. Enforce media access by audience, ownership, and role (F-02, F-16)
- **Action:** Replace the status-only gate in `GET /media/:id/file` with a single `canViewMedia(viewer, media, purpose)` policy: `community` + APPROVED → public; `me` → owner only; `security` → SECURITY/ADMIN only. Reject `APPROVED` on `me`/`security` via `/admin/media/:id` unless the transition is authorized. Stop setting `public, max-age=86400` for anything non-public; add cache purge on status change.
- **Depends on:** None (F-01 identity can land in parallel, but a role header/temporary check can enforce security viewers).
- **Risk:** Medium — could break the moderator preview; cover all three audiences with tests before deploying.
- **Validation:** Audience × status × viewer test matrix; re-run the runtime probe (private clip must stay 404/403 after approval); verify Cache-Control.
- **Effort:** S–M.

### P0-2. Add write authentication and a stopgap abuse layer (F-01, F-03, F-04)
- **Action:** Introduce authenticated sessions (or a gated demo mode bound to a private network), derive `userId` server-side, and remove the shared demo identity from production paths. Add per-IP/user rate limits, incident cooldowns/dedupe, upload quotas/part caps, AI budget, and admin login throttling/lockout. Rotate `ADMIN_TOKEN`; move to per-user short-lived tokens when OIDC lands.
- **Depends on:** F-02 policy if security roles are introduced in the same change.
- **Risk:** Medium — auth changes touch every write route and the admin proxy; stage and use contract tests.
- **Validation:** Unauthenticated writes → 401; burst → 429; quota exhaustion leaves no partial file; admin lockout triggers; audit rows record actor.
- **Effort:** M–L (full OIDC), S for the stopgap.

### P0-3. Stop the SOS over-promise and fix the payload (F-05, F-06)
- **Action:** Until a staffed workflow exists, show only a receipt ("Report received; reference …") and a prominent `tel:`/999 action — remove "Seen by security"/"Steward on the way". Capture an editable, real seat/location; allow venue-keyed incidents without a loaded match; queue offline and retry with a client idempotency key. Build the security dashboard + incident state machine as the P1 follow-up.
- **Depends on:** F-01 identity for attribution; offline queue work (F-28) can be shared.
- **Risk:** Medium — public safety copy changes and a new required field can affect the demo flow; coordinate with stakeholders.
- **Validation:** Two seats produce different sections; cold offline submission queues and flushes; success screen makes no claim beyond receipt; invalid state transitions return 409.
- **Effort:** S (copy + seat + queue), M–L (dashboard/state machine).

### P0-4. Gate and sanitize AI data (F-09)
- **Action:** Run the audience/consent check **before** reading or sending media; never send `me`/`security` media or incident text to the model without explicit consent. Strip EXIF/re-encode images, redact incident text, document the subprocessor and retention, and align the GPS/security copy.
- **Depends on:** F-02 audience policy; F-37 config validation so behavior is explicit.
- **Risk:** Low–Medium — re-encoding can alter quality; test image types.
- **Validation:** Stored images have no GPS; security/me uploads make zero model calls; provider request logs show redacted fields.
- **Effort:** S–M.

### P0-5. Make AI failures visible and fix configuration (F-08, F-37)
- **Action:** Add a job/status record with attempts, backoff, and a FAILED/stuck alert. Explicitly configure the model client (`baseURL` validated/normalized; reject a trailing `/v1` when the SDK appends `/v1`), support an explicit AI-enable flag, and document all accepted variables. Never silently inherit ambient OS credentials in production.
- **Depends on:** None; precedes F-07 threshold work.
- **Risk:** Low.
- **Validation:** Start with the ambient misconfiguration → clear warning/refusal; AI outage yields retryable status and an alert; requests hit one `/v1`.
- **Effort:** S (config) + M (job status/retry).

---

## P1 — Before production / next release

### P1-1. Complete the AI Moment pipeline (F-07, F-13)
- **Action:** Support photo capture or extract poster frames/video frames; calibrate `MIN_CONFIDENCE`; keep low-confidence results as reviewable PROCESSING drafts instead of dropping. Persist `safetyRelevant`/severity and create/attach incidents (with media links) for MEDIUM+ safety signals, deduped by match/section/time.
- **Depends on:** P0-4 (privacy gate), P0-5 (job status), security dashboard for incident routing.
- **Risk:** Medium — threshold changes could flood moderation; add sampling and review queues.
- **Validation:** Mocked 0.9 analysis creates a draft; 0.55 surfaces pending review; SECURITY/safety signal creates a security-only incident.
- **Effort:** M–L.

### P1-2. Durable storage and media delivery (F-10, F-20, F-18)
- **Action:** Move to Azure Blob/S3 with encryption/lifecycle/signed URLs; keep local disk behind a dev flag. Implement Range/HEAD (or delegate to storage/CDN), temp-file + atomic move, and `finally` cleanup for failed uploads. Add an orphan sweeper and quota.
- **Depends on:** Storage provisioning; P0-2 quotas.
- **Risk:** Medium — migration of existing local files and URL changes; update clients.
- **Validation:** Restart/redeploy retains media; two instances serve the same asset; `Range: bytes=0-1023` → 206; over-limit upload leaves no file.
- **Effort:** M–L.

### P1-3. Production build, tests, and CI (F-11, F-12, F-36)
- **Action:** Compile the API to `dist` and run `node`, add a multi-stage non-root Dockerfile + healthcheck, pin Node/package manager, align React/TS/Expo, add `typecheck` scripts to web/admin/mobile, fix the four web lint errors, and add CI (install → typecheck → lint → unit/integration/Playwright → build → audit). Add tests for SOS, uploads, media ACL, moderation, and AI failure paths.
- **Depends on:** P0 fixes so tests assert the new contracts.
- **Risk:** Low–Medium — CI may surface latent failures; fix incrementally.
- **Validation:** `npm ci --omit=dev` starts the API; a deliberate web type error fails root typecheck; CI blocks a failing PR; lint exits 0.
- **Effort:** M–L.

### P1-4. Make moderation and takedown consistent (F-15, F-16, F-14)
- **Action:** Enforce a moderation state machine (publish requires APPROVED; rejected requires re-review), clean all MomentMedia references (not only bestMedia), cascade takedown decisions, and add a cache policy/purge. Move clustering to capture time + official event anchor with a ≤10 s window and a per-match lock/transaction.
- **Depends on:** DB migrations/index work (P1-5).
- **Risk:** Medium — existing inconsistent rows need a backfill/repair script.
- **Validation:** Publish with rejected media → 409; removing a non-best angle updates the Moment; capture-time clustering tests; concurrent uploads create one Moment.
- **Effort:** M.

### P1-5. Database integrity and performance (F-17, F-44)
- **Action:** Add composite indexes for feed, incidents, media lists, and clustering; add an optimistic version or conditional updates for triage; convert `audience`/`source` to enums (or CHECK constraints) and validate `playerIds` (F-39).
- **Depends on:** None.
- **Risk:** Low — index creation can lock large tables; use concurrent creation in production.
- **Validation:** EXPLAIN shows index scans; constraint rejects invalid audience; concurrent triage loses nothing.
- **Effort:** S–M.

### P1-6. Security headers and auth robustness (F-23, F-24, F-41)
- **Action:** Add CSP (`frame-ancestors 'none'`), XFO, nosniff, HSTS, Permissions-Policy on both apps; disable `X-Powered-By`; wrap auth parsing in try/catch and always return 401; add magic-byte validation and `nosniff` on media.
- **Depends on:** None.
- **Risk:** Low — CSP needs a report-only rollout to avoid breaking inline styles/scripts.
- **Validation:** Header assertions; malformed Basic/non-ASCII token → 401; HTML declared as image → 415.
- **Effort:** S.

### P1-7. Incident idempotency and graceful shutdown (F-19, F-22)
- **Action:** Add client idempotency keys + unique constraints for incidents/uploads and upsert AI analyses; add SIGTERM drain, `app.close`, Prisma disconnect, and bounded live/ready endpoints.
- **Depends on:** P0-3 for incident API shape.
- **Risk:** Low.
- **Validation:** Duplicate key returns the original row; SIGTERM during upload completes; readiness fails/recover with DB.
- **Effort:** S–M.

---

## P2 — Important improvements

| Item | Findings | Action | Depends | Risk | Validation | Effort |
|---|---|---|---|---|---|---|
| P2-1 | F-27 | Wire or disable mock UI: real `/me` moments, working React/Share or explicit disabled state, leaderboard filters, persisted captions/predictions, fixture-derived quiz | P1-1 API detail routes | Low | Click-through matrix; caption stored; predictions settle | M |
| P2-2 | F-28 | Reliable offline queue: periodic/visibility flush, backoff, visible status, rewards only on acceptance, queue before match association | P0-3, F-19 | Low | API-only outage flushes automatically; rejection visible | S–M |
| P2-3 | F-29 | Abort/stamp polling, synchronous selection init, separate onboarding flag, surface secondary errors | None | Low | Reordered responses never regress; fixture switch clears stats | S |
| P2-4 | F-30 | Accessibility: pause/reduced-motion for autoplay, render chrome once, per-route titles/h1, optional mic with accurate errors | None | Low | axe pass; reduced-motion test; mic-denied test | S–M |
| P2-5 | F-31 | Virtualize/cap the feed and lazy-mount media | None | Low | Decoder count bounded; scroll performance | M |
| P2-6 | F-32 | Admin metadata, light surface/dark variants, `res.ok` error states | None | Low | Dark-mode legibility; simulated 500 state | S |
| P2-7 | F-33 | Metrics/tracing/job status, SOS and stuck-job alerts, request/job IDs | P1-1, P1-7 | Low | Fault injection raises alerts; traces span upload→AI | M |
| P2-8 | F-34 | Dependency triage/upgrades, split runtime/build deps, SCA + SBOM in CI | CI (P1-3) | Medium (upgrades) | Audit trends down; builds/tests pass | M |
| P2-9 | F-25 | Treat AI output as suggestions; immutable reporter type; log overrides; delimit prompts | P1-1 | Low | Injection cannot change stored type without review | S–M |
| P2-10 | F-26 | Retention/erasure: hard-delete endpoints + purge job, cascades, cache invalidation, backup policy | Storage (P1-2) | Medium | Delete removes row+file; retention job verified | M |
| P2-11 | F-21 | Shared replay state + SSE/WebSocket with polling fallback; extract `buildApp()` for tests | P1-3 | Medium | Two instances agree; <5 s update; tests without listening | L |
| P2-12 | F-35, F-36 | Docs status matrix, generated route/OpenAPI docs, pin toolchain | None | Low | Clean-machine setup; docs match routes | S–M |

---

## P3 — Incremental

| Item | Findings | Action | Effort |
|---|---|---|---|
| P3-1 | F-38 | Validate/clamp `since`/`limit` with a Fastify schema | S |
| P3-2 | F-39, F-40 | Resolve player names to IDs; return canonical/signed media URLs | S–M |
| P3-3 | F-42 | Startup env schema, document all vars, remove published DB port / dev creds | S |
| P3-4 | F-43 | Remove or build the mobile stub; correct README roles | S–M |
| P3-5 | I-01, I-03 | Mark placeholders clearly; decide strict vs strip-unknown body behavior | S |

---

## Recommended order and dependencies

1. **P0-2 identity/abuse stopgap + P0-1 media policy + P0-3 SOS truthfulness** — these three determine whether the product can be exposed to anyone at all. They are independent enough to run in parallel with separate owners.
2. **P0-4 AI privacy + P0-5 AI config/job visibility**, then **P1-1** to make the AI loop real.
3. **P1-3 build/test/CI** early enough that P1-4/P1-5/P1-6 land behind tests.
4. **P1-2 storage + P1-4/5 data**, then **P1-7** operational hardening.
5. P2 items in parallel once the contracts stabilize; P3 as cleanup.

### Quick wins (high value, small effort)
- P0-3 copy change + real seat (S) removes an active safety misrepresentation.
- P0-1 media audience check + non-community approval rejection (S) closes a confirmed privacy exposure.
- F-41 auth parsing try/catch (S) removes remote 500s.
- P1-5 indexes + P1-6 headers (S) are low-risk, high-leverage.
- Fixing the four lint errors and adding `typecheck` scripts (S) restores the quality gate.

### Systemic root causes (fix together)
- **Identity is absent** → F-01, F-02, F-04, F-05, F-09, F-19, F-26 all simplify once real users/roles exist.
- **No durable job/state layer** → F-08, F-13, F-19, F-21, F-33 share one queue/outbox solution.
- **No server-side policy layer** → media ACL, moderation transitions, retention, and AI consent should be centralized, not patched route-by-route.
- **No test/CI foundation** → every other fix is riskier until P1-3 lands.
