# Roar

Built for the Inside the Game: Developer Hackathon. AI audience intelligence platform for football. Fans' phones become a stadium camera network: uploads are classified, grouped into Moments, and pushed to a live feed. Full spec: [docs/SPEC.md](docs/SPEC.md).

## Layout

- `apps/mobile`: fan app (Expo, React Native)
- `apps/admin`: admin and security dashboard (Next.js)
- `apps/api`: REST API (Fastify, Prisma)
- `packages/database`: Prisma schema and client
- `packages/types`: shared types, including the AI result contract
- `packages/ai`: the AI agents (Moment Analyst, Storyteller, Safety Analyst) on Microsoft Foundry, using either an Azure OpenAI deployment (`AI_PROVIDER=azure-openai`) or Claude (`AI_PROVIDER=microsoft-foundry`). `npm run check -w @inside/ai` smoke-tests them
- `workers/`: media analysis, moment engine, incident engine (not started)
- `infrastructure/`: Azure and GitHub config (not started)
- `docs/`: spec and design notes

## Run locally

1. `cp .env.example .env`. Match data is synthetic (hackathon rule): the API replays the Roar League matches in `packages/matchdata` live. `REPLAY_SPEED=10` plays them ten times faster for demos.
2. `npm install`
3. Start Postgres: `npm run db:local` (no Docker needed, leave it running) or `npm run db:up` (Docker)
4. `npm run generate -w @inside/database`, then `npm run db:deploy`
5. `npm run dev:api` (http://localhost:4000/health)
6. Fan web app: `npm run dev:https -w @inside/web`, then open https://localhost:3001. On a phone on the same Wi-Fi, open the Network URL it prints (https://<your-pc-ip>:3001) and accept the certificate warning. https is needed for the camera.

The web app calls the API through its own `/api` path (a Next.js rewrite), so phones never talk to port 4000 directly.

## Synthetic match data

`packages/matchdata` turns a match storyline (clubs, momentum, goals, cards, subs) into a full, football-realistic event log: passes with distance, difficulty and ball speed, pressure, tackles, interceptions, shots with xG and speed, corners, fouls, and per-minute player distance and top speed. Every match is checked for realism before it can be replayed (`npm run check -w @inside/matchdata`), and `npm run export -w @inside/matchdata` writes the datasets to `packages/matchdata/datasets/`. Clubs and players are fictional.

API: `GET /matches/:id/events?since=<seq>` streams raw events as they happen; `GET /matches/:id/dataset` returns the full dataset after full time; `POST /admin/matches/:id/kickoff {"minute": 80}` restarts a replay (admin token).
