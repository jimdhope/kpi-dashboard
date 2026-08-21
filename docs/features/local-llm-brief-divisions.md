# KPI Quest — Divisions League Brief ("Autumn Cup")

## 1. Project context

KPI Quest: gamified weekly KPI competitions for a ~13-person office team. Next.js App Router + TypeScript + Prisma 7 + PostgreSQL 16, better-auth, Tailwind/shadcn UI, SSE live updates, MS Teams webhooks, background worker (`src/server/jobs/worker.ts`). Canonical score ledger = `ScoreEvent` table (`voidedAt IS NULL` = active). Services in `src/server/services/*`, repositories in `src/server/repositories/*`, route handlers use `ok()`/`errorResponse()` from `@/server/http`, admin auth via `requireResourceAccess("nav.competitions.manage")`. Dev on port 9103; `npm run typecheck` must pass.

**Additive changes only — never modify the scoring pipeline, entry logging, or the existing overall leaderboard.**

## 2. Why divisions

Raw cumulative points mean one player wins ~52% of weeks. Simulations over 83 historical weeks show a 3-division system with promotion/relegation gives 9 of 13 players silverware while keeping the Premier genuinely contested.

**Core principle: nobody is ever removed from the competition.** Relegation only means starting the next period in the division below. Every player is in exactly one division at all times, forever.

## 3. Calendar & structure

### 2026 "Autumn Cup" (Sep 1 – Dec 31)

- 3 divisions seeded Sep 1 from trailing form (avg raw pts over last 8 competitions before Sep 1):
  - **Premier** (5 players), **Championship** (4), **League One** (4)
- **Monthly title sprints**: most raw points within your division that calendar month -> Sep/Oct/Nov/Dec champions x 3 divisions = 12 trophies
- **Dec 31 = promotion/relegation day**, based on the full 4-month block table: top 2 promoted, bottom 2 relegated

### 2027 full year

- Quarterly reshuffles (Mar 31 / Jun 30 / Sep 30 / Dec 31), monthly titles throughout
- **December finals week**: division winners qualify for a head-to-head decider crowning the **annual champion**
- Monthly titles remain the monthly celebration and act as finals qualification

### Ongoing rules

- Overall weekly winner stays exactly as today (headline); division standings are an additional layer
- Division scoring = raw points against division-mates only
- New joiners enter League One immediately
- Absence protection: cannot be relegated if you played <50% of a block's weeks
- Fixed sizes (5/4/4) rebalanced at reshuffles; ties broken by monthly-title count, then shared title

## 4. League table display (official-table look, raw-points substance)

Each division renders as a proper league table:

| Pos | Player | Pld | Pts | Form |
|-----|--------|-----|-----|------|
| 1 | Adewunmi | 16 | 2042 | 1 · 1 · 2 · 1 · 1 |
| 2 | Bushra | 16 | 1876 | 2 · 3 · 1 · 2 · 2 |

- **Pos** — rank within division by raw points (monthly view or block view)
- **Pld** — competitions played in that period
- **Pts** — raw points total
- **Form** — last 5 weekly finishing positions within the division, small chips; purely cosmetic
- **Styling**: promotion zone marked green at the top of each non-Premier table, relegation zone red at the bottom, top-3 medal highlighting, striped rows — reuse existing shadcn `Table` / leaderboard patterns; compact card variant for mobile
- **Scoring logic unchanged**: monthly champion = most raw points; block-end promo/releg = block totals; overall weekly winner untouched

## 5. Implementation outline

1. **Model**: `DivisionAssignment` (id, userId, division enum `PREMIER|CHAMPIONSHIP|LEAGUE_ONE`, effectiveFrom, effectiveTo nullable) — history preserved; current assignment = `effectiveTo IS NULL`. Season periods derive from calendar months/quarters — no custom period tables.
2. **Jobs** (existing worker): month-end job crowns champions + Teams announcement; block-end job applies promo/releg with absence protection + announces reshuffle.
3. **APIs**: `GET /api/divisions/current`, `GET /api/divisions/history`, admin-only seeding/reshuffle endpoints.
4. **UI**: division badge on leaderboard rows, division tabs/filter on competition views, trophy cabinet page (champions history).
5. **Teams**: reuse webhook infrastructure for monthly champions and reshuffle-day announcements.

## 6. Acceptance criteria

- Every active player has exactly one current division at all times
- Existing overall winner flow byte-identical to today
- Promo/releg honours absence protection; seeding reproducible from ScoreEvent history
- League tables render per section 4 with correct Pld/Pts/Form values
- `npm run typecheck` && `npm run build` pass
