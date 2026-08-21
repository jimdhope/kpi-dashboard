# KPI Quest — Local LLM Briefing Pack

## 1. Project overview

KPI Quest is a gamified KPI competition app for a small office team (~13 players). Weekly themed competitions; players log activities against scoring rules; highest raw points wins the week. Deployed via Docker Compose on a public server; developed in this repo.

- **Repo:** `github.com/jimdhope/kpi-dashboard` (package name `kpi-quest`, v3.6.x)
- **Stack:** Next.js (App Router, TypeScript, strict), Node 22, Prisma 7 (`@prisma/adapter-pg`), PostgreSQL 16, better-auth (+ passkeys), Tailwind + shadcn/Radix UI, SSE live updates, MS Teams webhook integrations
- **Port:** 9103 (`npm run dev` / `next start -p 9103`)
- **Compose:** `postgres` (db `kpi_quest_v3`) + `app` services; container entrypoint runs `prisma db push` then starts Next

## 2. Commands

```bash
npm install
npm run dev          # dev server on :9103
npm run build        # production build
npm run typecheck    # tsc --noEmit -p tsconfig.typecheck.json  <- must pass
npm run test:unit    # node --test based suites
npm run db:push      # apply schema (project uses db push, not migrate files, in containers)
npm run db:studio    # inspect DB
```

Env: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kpi_quest_v3` (see `.env` / `sample.env`).

## 3. Architecture & conventions

```
prisma/schema.prisma        # all models, PascalCase table names
src/server/services/        # domain logic, 'import "server-only"', one exported const XService object
src/server/repositories/    # Prisma data access, one exported const XRepository
src/server/services/authorization.ts   # requireResourceAccess("nav.competitions.manage", "MANAGE"|"VIEW")
src/server/http.ts          # ok() / errorResponse(status, msg) helpers for route handlers
src/app/api/**/route.ts     # route handlers: auth via authService.requireCurrentUser()
src/app/(app)/...           # authenticated staff UI; (agent)/... agent-facing pages
src/components/             # shadcn-based UI; leaderboard.tsx is a generic <Leaderboard title entries/>
src/server/services/competition-sse-service.ts  # broadcasts e.g. {type:"score_event_recorded"}
src/server/jobs/worker.ts   # background jobs (npm run jobs:work)
```

Patterns to follow:
- Route handler -> authorization helper -> service -> repository -> prisma. No prisma calls in routes/components.
- New UI = compose existing shadcn components (`Card`, `Table`, `Badge`, `Tabs`); reuse `<Leaderboard>` for ranked lists.
- Live updates: refetch on SSE events rather than polling.
- Tests are `node --test` + tsx, colocated `*.test.ts`.

## 4. Data model essentials

- **User**(id, name, roles...) / **Pod** / **PodMembership**
- **Competition**(id, name, startsAt, endsAt, isDraft, podIds...)
- **CompetitionRule**(competitionId, title, points, isCheckbox, dailyTarget) — per-activity point values
- **CompetitionEntry**(competitionId, userId, present) — enrolment/presence only
- **CompetitionResult**(userId, rank, totalScore) — final archived outcome
- **ScoreEvent** (canonical ledger): (competitionId, ruleId, subjectAgentId, podId, quantity, points, scoredForDate, source, idempotencyKey unique, correctionOfId, voidedAt/voidedById/voidReason). Active points = rows where `voidedAt IS NULL`. All scoring flows through `score-event-service.record()` which also SSE-broadcasts.
- **TeamsWebhookEndpoint / TeamsAutomation / TeamsMessageTemplate** — outbound Teams messaging infra.
- No app-settings/feature-flag storage exists yet.
- Note: Postgres identifiers are case-sensitive; quote them (`"ScoreEvent"`).

## 5. Guardrails — do NOT touch

- Scoring pipeline (`score-event-service`, entry logging, ranks, `CompetitionResult`) — current competition behaviour must remain byte-identical.
- Existing auth/permission semantics; don't weaken authorization checks.
- Don't add heavy dependencies; don't restructure existing modules; additive changes only unless fixing a bug.

## 6. Feature spec: "Beat Your Best" (shadow beta)

### Problem

Raw cumulative points favour the most consistent high-volume player (won 52% of 83 historical weeks). Goal: a fairer weekly winner without changing the real competition.

### Chosen mechanism (validated by replaying all 83 historical competitions)

> Weekly BYB score = `this week's raw points / player's rolling best * 100`
> where *rolling best* = the player's max weekly total across their previous **8** competitions (excludes current).
> Ranking: highest ratio wins. Qualification floor: raw points >= **50%** of the current week's top raw score. Players with **< 3 prior competitions** are listed unranked (raw scores shown, no ratio).

Simulated outcomes vs current system: dominant player drops 43 -> 18 wins of 83; all 13 players win >=2 weeks; recent winners were sensible (players winning by hitting 95-109% of personal form). Handicaps and volume caps were tested and rejected (insufficient effect).

### Shadow-mode product shape (all toggles default OFF)

1. **`AppSetting` model** — `{ id, key (unique), value Json, updatedAt }` + migration/db push. New `app-setting-service.ts` with typed getters/setters and defaults:
   - `byb.enabled` (bool, false)
   - `byb.teamsAnnouncementEnabled` (bool, false)
2. **`beat-your-best-service.ts`** — pure computation from ScoreEvents:
   - input `competitionId`; per entrant: sum active points this competition;
   - rolling best: group that player's active points by competition across their prior competitions, take max of last 8;
   - apply floor + history rules; return ranked list `{ userId, name, rawPoints, rollingBest, ratio, qualified }`.
3. **API routes**
   - `GET /api/competitions/[id]/beat-your-best` — any signed-in user; returns standings + `enabled` flag.
   - `GET|PUT /api/settings/beat-your-best` — admin only via `requireResourceAccess("nav.competitions.manage")`.
4. **Admin page** `/competitions/beat-your-best` — full standings table, "BETA — doesn't count" badge, menu item under Competitions gated on `nav.competitions.manage`.
5. **Agent dashboard card** — compact top-5 (own row highlighted) on agent dashboard, rendered only when `byb.enabled`.
6. **Settings UI** — new "Beat Your Best (Beta)" section in Settings exposing both toggles.
7. **Live updates** — refetch BYB endpoint on SSE `score_event_recorded` / `score_event_voided`.
8. **Teams announcement (phase 2, toggle-gated)** — end-of-week job posts shadow winner using existing webhook infra; never fires while `byb.teamsAnnouncementEnabled` is false.

### Acceptance criteria

- With toggles off: zero behavioural/UI change anywhere.
- With `byb.enabled`: admin page + dashboard card appear; real leaderboard/scoring unchanged.
- Ratio math matches spec incl. floor and <3-weeks unranked handling; voided events excluded everywhere.
- `npm run typecheck` and `npm run build` pass.

## 7. Suggested build order

1. AppSetting model + service + settings API + Settings UI toggles
2. beat-your-best-service + repository aggregation queries (+ unit test for ratio/floor/history edge cases)
3. Competitions API endpoint + admin page + menu item
4. Agent dashboard card + SSE refresh
5. (Later) Teams announcement job
