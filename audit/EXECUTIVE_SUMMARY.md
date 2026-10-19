# Roar — Production-Readiness Audit: Executive Summary

**Repository:** `C:\Users\Abel ADIGUN\Desktop\repos\Inside The Game`
**Revision audited:** `ab03eba` (branch `main`, 1 commit ahead of `origin/main`), working tree clean before the audit
**Audit date:** 19 October 2026
**Method:** repository inspection, five read-only specialist subagents (architecture, security/privacy, backend/data, frontend/UX, testing/DevOps), plus a locally started stack (embedded Postgres 18.4, API on Node 26.2.0) for runtime validation. No application files were modified. The local servers were stopped after testing.

---

## 1. Overall health

Roar is a coherent, well-organised hackathon MVP with unusually good bones for a demo: strict TypeScript across workspaces, a typed AI contract, a deterministic synthetic match-data engine with its own validation checks, clean Next.js builds, and a documented product spec. The code reads like an experienced engineer's deliberate scope cut — many demo limitations are marked in code with `ponytail:` deferral comments.

It is **not production-ready**. The largest gaps are not exotic vulnerabilities; they are the safety, privacy, and operational promises the product already makes to fans:

- The API has **no fan authentication or authorization** at all; every write is attributed to one shared demo user.
- The media **audience setting is a label, not an access policy**: approved "Only me" and "Security only" clips are served publicly with a 24-hour cache, while their intended audience has no way to view them.
- The **SOS flow tells fans "Seen by security" and "Steward on the way"** when no security dashboard or incident workflow exists, uses a hardcoded demo seat, and cannot queue offline.
- The **AI pipeline cannot complete end-to-end**: capture records video only, video analysis is capped at 0.5 confidence against a 0.6 threshold, and in the audited environment every AI call failed with a malformed URL (`/v1/v1/messages` → 404) while failures were only logged.
- **Safety signals from fan media are discarded**, private media is sent to the AI service before the audience check, and there is no rate limiting, retention, or deletion path.

Several risks are explicitly acknowledged in code/README as deferred (demo auth, local-disk storage, in-process AI, Azure/Fabric not provisioned). They are still reported here because each blocks production use and several are release-blocking the moment real fans or real safety reports are involved.

### Domain scorecard

| Domain | Rating | Summary |
|---|---|---|
| Architecture & code quality | Fair | Clear monorepo boundaries and contracts; replay/AI/state coupled to the process; several correctness gaps in core loops. |
| Security & privacy | Poor | No fan authN/authZ, broken media ACL, no abuse controls, shared admin credentials, private data to external AI. |
| Safety features | Poor | SOS response is fabricated and unstaffed; media-derived safety signals never reach anyone. |
| Backend/API & data | Fair | Schema is reasonable; no indexes, no idempotency, non-atomic moderation, no retention. |
| Frontend/UX | Fair | Polished demo; dead links and inert controls, offline queue lies, a11y gaps, lint red. |
| Testing & release engineering | Poor | No tests, no CI, API has no production build, three apps skipped by root typecheck. |
| Documentation | Fair | Good spec; API doc stale; app roles misdescribed. |

---

## 2. Findings summary

**0 Critical · 13 High · 24 Medium · 7 Low · 3 Informational** (47 total).
Confidence: 42 Confirmed, 4 Probable, 1 Potential. No Critical finding met the bar (no reproduced RCE, auth bypass, SQL injection, path traversal, or stored XSS was found); the High findings are release blockers because the product's core safety/privacy promises are unmet.

### Five most important findings

1. **F-02 — Media audience policy is broken (High, Confirmed).** After an admin approves a clip, `GET /media/:id/file` serves it to anyone with the ID, including `audience=me` and `audience=security` clips, with `Cache-Control: public, max-age=86400`. Reproduced locally: a security-only clip returned 404 while PROCESSING and 200 after `PATCH /admin/media/:id {"status":"APPROVED"}`; an approved only-me clip also returned 200. Intended viewers (the owner, security staff) have no authorized route at all.
2. **F-01 / F-03 / F-04 — No fan auth or abuse controls; shared admin credentials (High, Confirmed).** Unauthenticated `POST /incidents` and `POST /media` returned 201 in testing. 40 rapid requests produced no 429. The admin surface is one shared HTTP Basic password plus one static `ADMIN_TOKEN` with no RBAC, lockout, audit trail, or rotation.
3. **F-05 / F-06 — SOS promises a response the system cannot deliver (High, Confirmed).** The success screen is static ("Seen by security", "Steward on the way, ~2 min"); no admin route or API workflow handles incident acknowledgement/assignment/resolution, the seat is the hardcoded demo profile (`Section C · Row 12`), and the flow requires a loaded match and cannot queue offline.
4. **F-07 / F-08 / F-13 — The AI Moment pipeline cannot succeed and safety signals are dropped (High, Confirmed).** Capture only records video; the video prompt caps confidence at ≤0.5 while `MIN_CONFIDENCE` is 0.6; runtime AI calls all failed 404 (`POST /v1/v1/messages`) and were swallowed, leaving media in `PROCESSING`; `safetyRelevant` is never persisted and SECURITY/OTHER analyses return before any incident is created.
5. **F-09 — Private media and SOS text go to an external AI service before the audience check, and EXIF/GPS is never stripped (High, Confirmed).** `processUpload` analyses every audience including `me`/`security`; the UI promises "Security only" / "never your GPS", but stored and served bytes are the original upload. Runtime testing showed outbound AI attempts for all three test uploads.

### Other High findings

- **F-10** Uploaded media lives only on the API's local disk (lost on redeploy, no sharing, no cleanup).
- **F-11** No automated tests, no CI, root `typecheck` skips web/admin/mobile, and `npm run lint -w @inside/web` exits 1 with 4 errors.
- **F-12** The API has no production build/run path: `start` uses dev-only `tsx`; no Dockerfile/EAS/release process exists.

---

## 3. Verification results (summary)

| Check | Result |
|---|---|
| `git status` before/after | Clean; only new `audit/` artifacts added (untracked) |
| `npm run typecheck --workspaces --if-present` | PASS — but only api, ai, database, matchdata have scripts |
| `npx tsc --noEmit` web / admin | PASS (run manually); mobile not independently verified |
| `npm run build -w @inside/web` | PASS — 18 routes generated |
| `npm run build -w @inside/admin` | PASS |
| `npm run lint -w @inside/admin` | PASS (1 warning) |
| `npm run lint -w @inside/web` | **FAIL** — 4 errors, 7 warnings (exit 1) |
| `npm run check -w @inside/matchdata` / `-w @inside/web` | PASS |
| `npm run check -w @inside/ai` | NOT RUN — would make paid external AI calls |
| `npm audit` | **FAIL** — 29 vulnerabilities (22 high, 7 moderate, 0 critical); `--omit=dev` 26 (19 high, 7 moderate), largely tooling |
| `npm test` | FAIL — no `test` script exists |
| `npx expo install --check` / `expo-doctor` | FAIL — Expo 57.0.27 vs expected 57.0.30; 19/21 checks |
| Prisma migrate deploy (local) / validate | PASS — 3 migrations applied, schema valid |
| Runtime API probes | See `TEST_AND_VALIDATION_REPORT.md` — auth boundary, media ACL exposure, no rate limiting, auth-parse 500s, and malformed AI endpoint all reproduced |

---

## 4. Immediate actions (P0)

Do not expose this application to real fans or a public network until the following are addressed. Full sequencing is in `REMEDIATION_PLAN.md`.

1. **Fix the media access policy (F-02):** authorize by audience/ownership/role, refuse approving non-community media via the moderation endpoint, and remove the 24-hour public cache on private content.
2. **Add even a stopgap for write auth and abuse (F-01, F-03):** authenticated sessions (or a gated demo mode), server-derived identity, per-IP/user rate limits, upload quotas, and admin lockout.
3. **Stop the SOS over-promise (F-05, F-06):** show receipt-only until a real acknowledgement exists, send the real seat/location, and queue offline with a `tel:` fallback.
4. **Gate and sanitize AI data (F-09):** never send `me`/`security` media to the model, strip EXIF/re-encode, redact SOS text, and document the subprocessor.
5. **Make AI failures visible and non-silent (F-08):** job status + retry + alerting; fix the Foundry/base-URL configuration (F-37).

---

## 5. Limits of this audit

Static review plus a local runtime stack covers a great deal, but this audit did **not** perform browser/device testing (camera, MediaRecorder, IndexedDB queue, service-worker offline transitions, Safari playback), load/DoS testing, penetration testing, a real deployment review, or successful live AI calls (the configured endpoint returned 404). Dependency findings are advisory-based, not reachability-proven. No production application data or deliberately supplied credentials were used; the local stack did inherit ambient AI configuration from the OS, as documented in the validation report. No secret values appear in these reports. A clean audit cannot prove the absence of vulnerabilities; the uncovered areas are listed in `CODEBASE_COVERAGE.md`.
