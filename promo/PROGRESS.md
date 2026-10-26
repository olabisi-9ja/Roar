# Roar promo video: progress log

Hackathon demo ad: about 1:20, no voiceover, epic orchestral score, real footage only (stock + real app recordings).
Read this first if you are a new session picking the work up.

## Decisions (agreed with the owner)

- Length about 80 s. No dialogue or voiceover: the acting carries it. End card only: "ROAR · Every fan is a camera · Built on Microsoft Foundry · Azure".
- No third-party trademarks: no Premier League, club crests, Meta/Ray-Ban names. Use the fictional Roar League.
  The capture screen's "Ray-Ban Meta" source option must not appear on screen.
- Music: epic orchestral build. Candidate: Mixkit "Dreaming Big" (https://assets.mixkit.co/music/31/31.mp3), climax around 72 s.
  Others: 76 "Epic Games", 846 "I Won't Surrender", 32 "Driving Ambition". All Mixkit Free License, no attribution needed.
- App footage must be the real product: fan web app + admin console running against the live Azure API, AI on Foundry.

## Script (80 s)

| Time | Shot |
|---|---|
| 0:00–0:05 | Black, crowd hum. Aerial stadium (Pixabay 239964), desaturated. |
| 0:05–0:15 | Four "eyes", ~2.5 s each, gold light trail from each lens: glasses close-up with REC overlay (Mixkit 14724), phone filming in crowd (Mixkit 32559 / 32590), broadcast camera (Mixkit 1512 / Pixabay 213801). |
| 0:15–0:22 | Goal: night penalty behind the net (Mixkit 43495) → crowd erupts behind the net (Mixkit 9585), confetti crowd (Pixabay 29322). Music hit. Split screen of angles. |
| 0:22–0:34 | Real app: capture → "AI is reading your moment" → admin "Picked by AI" → Publish. Colour floods in. |
| 0:34–0:48 | Fans away from the stadium: woman on bus (Mixkit 21841), man smiling at phone (Pixabay 183448), real For You feed in a phone frame. |
| 0:48–1:02 | Music drops to heartbeat. Dark crowd (Mixkit 22427), police lights (Mixkit 17396) → real SOS on phone → real CRITICAL incident in admin → police/stewards (Mixkit 4290). |
| 1:02–1:12 | Release: man celebrating at home (Mixkit 33581), family (Mixkit 21793). |
| 1:12–1:20 | End card. |

Stock sources: Mixkit (`https://assets.mixkit.co/videos/<id>/<id>-720.mp4`) and Pixabay API (needs the owner's key; ask them, never commit it).

## How the app is recorded

- Local fan web app (port 3001) and admin (port 3000) run from this branch against the live API through `promo/scripts/apiproxy.mjs`
  (relay on :4000; Node needs `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` in the cloud container).
- Root `.env` (gitignored) holds `API_URL`, `ADMIN_TOKEN`, `ADMIN_PASSWORD`. Ask the owner; never commit them.
- `promo/scripts/rec2.js <out> <scene> [fake-camera.y4m]` records a scene from `scenes2.js` with Playwright screenshots (phone 390x844@2x,
  or `DESK=1` for admin 1600x900@1.2). The fake camera "films" a stock clip converted to 720x1280 y4m, so uploads go through the real AI.
- Demo control used: `POST /admin/matches/rl-01/kickoff {"minute":59}` so fan clips land right after the 61' equaliser.

## Status

- [x] Script, music shortlist, stock shortlist
- [x] Admin console redesign (dark "control room": sidebar, overview stats, AI drafts with video, severity-coded incidents)
- [x] Fan app fix: analysing screen shows the clip instead of an empty box
- [x] Capture flow verified end to end with the live AI (about 14 s to a Moment draft)
- [ ] Record: capture (goal clip after 61'), admin curate + publish, feed, SOS, admin incidents
- [ ] Edit in Remotion, grade, music + SFX, render 1080p MP4 under 80 s
- [ ] Owner uploads to YouTube; redeploy web + admin images (see docs/HANDOFF.md) so the live site matches the video
