# Roar — Codebase Coverage and Audit Method

Revision `ab03eba`. This document records what was inspected, how, by whom, and what remains uncovered, so the findings can be weighed against the audit's reach.

---

## 1. Repository map

| Area | Path | Stack / role | Coverage |
|---|---|---|---|
| Root | `package.json`, workspaces, `docker-compose.yml`, `.env.example` | npm workspaces, scripts, dev DB | **Full** |
| Fan app | `apps/web` | Next.js 16.4 App Router, PWA, port 3001 | **High** — all pages, core components, libs, service worker, config |
| Admin app | `apps/admin` | Next.js App Router, Basic-auth proxy, server actions | **High** — proxy, API client, curate flow, media route, layout/config |
| API | `apps/api` | Fastify 5, multipart, port 4000 | **Full** (`server.ts` 417 lines, `agents.ts`, `replay.ts`) |
| AI package | `packages/ai` | Anthropic SDK / Foundry, Zod schemas, prompts | **Full** (113 lines) |
| Database | `packages/database` | Prisma 7, PostgreSQL, migrations, local DB script | **High** — schema, 3 migrations, seed, config |
| Match data | `packages/matchdata` | Deterministic synthetic fixtures/events, checks | **Medium–High** — types, generator, check script, representative data |
| Shared types | `packages/types` | Domain contracts | **High** |
| Mobile | `apps/mobile` | Expo stub | **Full** (health-check stub) |
| Workers | `workers/*` | Empty placeholders | **Full** (verified empty) |
| Infrastructure | `infrastructure/*` | Empty placeholders | **Full** (verified empty) |
| Docs | `README.md`, `docs/*` | Spec, objective, design, API, decisions | **Medium–High** — claims cross-checked against code; design docs skimmed |
| Git history | last commits | Change context | **Light** — recent commit inspected; no full history archaeology |

**Scale:** a compact monorepo. All first-party HTTP routes, schema models, AI calls, and primary user journeys were traced end-to-end.

---

## 2. Specialist reviews

Five read-only subagents ran independently, each instructed not to modify files and to cite exact evidence. Their findings were deduplicated and spot-checked against source; runtime confirmations were performed by the lead auditor.

| Review | Scope | Main outputs |
|---|---|---|
| **A — Architecture & code quality** | Module boundaries, core loops, coupling, data flow, scalability | AI threshold dead loop, clustering correctness, fire-and-forget jobs, moderation state, replay architecture, dead UI paths |
| **B — Security & privacy** | AuthN/AuthZ, abuse, secrets, media privacy, headers, dependencies, prompt injection | Open write API, no rate limits, broken media ACL, admin credential model, AI privacy, missing headers, upload validation |
| **C — Backend/API/data** | Routes, validation, transactions, schema/migrations, concurrency, retention | Idempotency, clustering race, moderation/takedown, missing indexes, upload orphans, incident triage, query validation |
| **D — Frontend/UX/accessibility** | Journeys, state, offline/PWA, safety copy, a11y, admin UX | SOS hardcoded/fabricated, dead links, inert controls, offline queue, polling races, a11y gaps, admin scaffold issues |
| **E — Testing/DevOps/dependencies** | Tests, CI, builds, deployment, pins, advisories, observability | No tests/CI, no production API build, local-disk storage, toolchain drift, advisories, observability gaps |

No subagent had write access to application code; all produced findings only. The consolidated set contains 47 findings (13 High / 24 Medium / 7 Low / 3 Info).

---

## 3. Files and flows inspected in depth

### API and data
- `apps/api/src/server.ts` — every route: health, matches, events, insights, incidents, uploads, media serving, admin incidents/media/moments/moderation, replay restart; CORS/multipart config; demo identity; admin token check; file write/serve paths.
- `apps/api/src/agents.ts` — upload analysis, clustering, Moment creation, incident triage, safety-signal handling, failure behavior.
- `apps/api/src/replay.ts` — in-memory datasets, clock/boot state, restart, insight cache, event visibility.
- `packages/database/prisma/schema.prisma` and `migrations/0001-0003` — models, enums, unique constraints, indexes, cascade behavior, seed path.
- `packages/database/scripts/local-db.mjs` — embedded Postgres lifecycle.

### AI
- `packages/ai/src/index.ts` — client selection, model configuration, Zod schemas, prompt construction, analysis/incident/story/matcher/curator calls, null-on-failure behavior.
- `node_modules/@anthropic-ai/sdk/client.js` (read-only) — confirmed `ANTHROPIC_BASE_URL` auto-read that explains the `/v1/v1/messages` 404.

### Fan app (web)
- All route pages under `apps/web/app`: landing, home, live, matches, match detail, moment detail, stats, play (quiz, call-it), capture, SOS, me.
- `lib/live.ts` (polling/selection), `lib/uploads.ts` (IndexedDB queue), `lib/data.ts` (demo profile/quiz), `lib/feed.ts` (ranking), `components/Pwa.tsx`, `components/Nav.tsx`, `Icon`, `MomentCard`.
- `public/sw.js` (precache/runtime caching/write exclusions), `next.config.ts` (rewrites/headers/experimental flags), `app/layout.tsx` and metadata.

### Admin
- `proxy.ts` (Basic auth, fail-closed behavior), `lib/api.ts` (server token use), `app/curate/*` (server actions/forms/error paths), `app/media/[id]/route.ts` (privileged preview proxy), layout/config.

### Cross-cutting
- `package.json` scripts, workspace manifests, `docker-compose.yml`, `.env.example`, `README.md`, `docs/SPEC.md`, `docs/API.md`, `docs/OBJECTIVE.md`, `docs/DESIGN.md`, `docs/TRD.md`, `docs/PRD.md`, `docs/APPFLOW.md` (design/planning docs skimmed, not line-by-line).
- Git status/history, tracked-secret grep, hardcoded-link grep, empty-directory verification.

---

## 4. Runtime coverage

Performed against the local stack (details in `TEST_AND_VALIDATION_REPORT.md`):

- Health, match list/detail/404, events (valid and invalid params), moments.
- Admin auth: missing/wrong/valid token, malformed Basic (proxy), non-ASCII token (API).
- Incident validation: bad enum, missing field, extra property, valid unauthenticated write.
- Uploads: non-multipart, community/security/me PNGs, processing visibility, admin preview, approval, public retrieval, cache header.
- Abuse: 40-request burst.
- CORS: allowed vs disallowed origin.
- AI: incidental live attempts observed failing at the configured endpoint.
- Embedded Postgres startup, migration deployment, API boot/stop.

Not covered at runtime: browser rendering, camera/MediaRecorder, IndexedDB/service-worker transitions, video playback/range requests on Safari, screen readers, load/concurrency, multi-instance behavior, object storage, deployment, successful AI calls.

---

## 5. Explicitly not reviewed

- `node_modules`, generated Prisma client, `.next` build output, `.pgdata`, lockfile line-by-line.
- Binary assets, fonts, icons, certificates, and design files beyond their references.
- Full git history (only recent commits and tracking status).
- Third-party dashboard/SDK internals beyond the specific configuration behavior cited.
- Production infrastructure (none exists in-repo), cloud identity, network policy, WAF/CDN, DNS/TLS.
- Legal/compliance documents (privacy policy, DPIA, incident-response plan) — none were found.

---

## 6. Assumptions

- The repository is a hackathon/demo MVP moving toward production; deferrals marked `ponytail:` are intentional scope cuts, not accidental omissions. They are still reported because several block production.
- “Production-readiness” is judged against the product promises in `docs/SPEC.md` and the UI copy, including safety response, media privacy, and the record → AI → Moment loop.
- The local environment's OS-level AI credentials are not representative of a clean checkout; the audit reports both the code path and the observed configuration behavior.
- No finding assumes a specific cloud vendor; fixes are expressed vendor-neutrally where possible.

---

## 7. Residual risk

The audit found **no confirmed Critical issue** (no RCE, auth bypass, SQL injection, path traversal, or stored-XSS sink), but this is not a penetration test. Residual risk is concentrated in:

1. **Safety workflow reality** — the largest unquantified risk is organizational: whether a staffed security process exists outside this repository.
2. **Browser/device behavior** — offline SOS, camera capture, video playback, and PWA caching were reviewed statically, not exercised.
3. **Abuse at scale** — no load or disk-exhaustion testing was performed; the absence of limits is confirmed, the exact failure threshold is not.
4. **AI behavior** — no successful model invocation, so prompt injection, output quality, cost, and latency are unmeasured.
5. **Dependency exploitability** — advisory counts are not reachability proofs.
6. **Deployment** — no production environment exists to assess; container/edge/CDN configuration is unknown.

These gaps should be closed with browser/device E2E tests, load tests, a staging deployment, and a scoped penetration test before launch.
