# API

Source: [SPEC.md](SPEC.md) sections 2.7 and 2.8. Fastify, `apps/api/src/server.ts`. The fan web app proxies
it under `/api`.

## Public (fans)

| Route | Notes |
| --- | --- |
| `GET /health` | DB and AI provider status |
| `GET /matches`, `GET /matches/:id`, `GET /matches/:id/insights`, `GET /matches/:id/events`, `GET /matches/:id/dataset` | Synthetic Roar League replay |
| `GET /matches/:id/moments?lang=` | Published Moments; `lang` is `en`, `fr`, `es`, `pt`, `de` or `ar` (Translator agent, cached) |
| `GET /matches/:id/events/:eventId/tactics?depth=beginner\|expert&lang=` | Tactics Analyst: why a goal worked. Facts come from the event log; 404 for non-goals |
| `GET /matches/:id/recap?length=15\|30\|60&lang=` | Multi-angle recap: segments (fan Moments and goals, match order, seconds sum to `length`) with narration lines |
| `POST /media`, `GET /media/:id/status`, `/media/:id/file`, `/media/:id/poster` | Uploads and ACL-gated media |
| `POST /incidents` | SOS |

Without an AI provider, tactics and recaps fall back to rule-based English and Moments stay untranslated.

## Partner API (studios, streaming platforms)

Header `x-api-key: roar_pk_…` (created in the admin console, stored hashed). 600 requests/min per key.
Language defaults to the partner's setting; `?lang=` overrides it. Media URLs are absolute when
`PUBLIC_WEB_URL` is set.

| Route | Notes |
| --- | --- |
| `GET /partner/v1/matches` | Fixtures |
| `GET /partner/v1/matches/:id/moments?lang=` | Published Moments |
| `GET /partner/v1/matches/:id/recap?length=&lang=` | Recap playlist |

Webhook `moment.published` fires when a Moment is published (admin create or publish). `POST` JSON
`{type, createdAt, data: <Moment>}` with `x-roar-event`, `x-roar-timestamp` and
`x-roar-signature: sha256=<hex HMAC-SHA256(secret, timestamp + "." + body)>`. One retry on network error
or 5xx, 5 s timeout. Verify the signature and reject old timestamps.

Embeddable widget: `<iframe src="https://<fan web app>/widget.html?match=rl-01&lang=fr">` (the only
frameable page).

## Admin (`x-admin-token`)

Incidents, media moderation, Moment curation, replay control, AI status, and partners:
`GET /admin/partners`, `POST /admin/partners {name, webhookUrl?, language?}` (returns `apiKey` and
`webhookSecret` once), `DELETE /admin/partners/:id` (revokes).
