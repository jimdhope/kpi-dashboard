# Milestone 0: scoring inventory and migration baseline

**Status:** discovery complete; the additive foundation is prepared but has not been applied to a database or connected to live application behaviour.

**Parent guide:** [Implementation guide](./IMPLEMENTATION-GUIDE.md)

## Implementation checkpoint (2026-07-18)

The first additive code slice has been prepared:

- `ScoreEvent` was added to `prisma/schema.prisma` with an additive migration at `20260718110000_add_score_events`.
- A server-only score-event repository and service were added for create, idempotency lookup, active-event totals, and audited voiding.
- No existing route, dashboard, report, Teams flow, or legacy scoring writer calls the new service yet. Live behaviour is unchanged.

Validation completed after the local development runtime became available:

- Prisma client generation completed successfully.
- `prisma validate` completed successfully.
- `npm run typecheck` completed successfully.
- `npm run test:score-events` completed successfully against isolated local-database fixtures. It verifies idempotent creation, active-event totals, and audited voiding.
- `npm audit --omit=dev` reported zero vulnerabilities.
- A production build completed successfully using a temporary in-command validation value for `BETTER_AUTH_SECRET`; `.env.local` itself was not changed.

After PostgreSQL was started, `prisma migrate deploy` applied `20260718110000_add_score_events` successfully to the local development database. A read-only check confirmed both the `ScoreEvent` table and the corresponding `_prisma_migrations` record. Existing score tables and live application scoring paths remain unchanged.

## Finding

KPI Quest currently has multiple live score stores with overlapping purposes. A
safe migration must introduce score events alongside these stores, migrate and
reconcile data, switch consumers deliberately, and only later retire legacy
structures. No existing scoring table is safe to drop in the first migration.

## Current score stores

| Store | Current shape | Current writers | Current readers/uses | Migration disposition |
| --- | --- | --- | --- | --- |
| `DailyAchievement` | Mutable per-agent/rule/day aggregate; no database uniqueness constraint for its intended composite identity | `POST /api/achievements` updates or creates via `findFirst`; manager scoring UI | Agent and management dashboards, competition log UI, agent rankings, daily Teams score card, badge calculations | Migrate to individual score events only where source events can be reconstructed; otherwise preserve as an auditable opening-balance migration event. Replace as the canonical competition-score source. |
| `CompetitionEntry.score` | Denormalised running total per competition entry | Competition entry service, competition service, Teams hashtag processing | V3 entry/standings paths, legacy competition APIs, certificates/competition workflows | Keep `CompetitionEntry` for enrolment/presence if needed; stop treating `score` as canonical after reconciliation. |
| `CompetitionScoreLog` | Individual V3 entries; may include `ruleId`, bonus flag, bonus team ID, timestamp | Competition entry service, competition APIs, Teams hashtag processing | Legacy score-log and entry workflows | Strong candidate for conversion to individual score events because it retains event-level timestamps. Preserve legacy references during migration. |
| `TeamBonusLog` | Team-only bonus with points, optional reason and date | `POST /api/bonus-logs` | Competition log UI and any bonus display | Do not add new feature support. Preserve table/data during retention; exclude it from the canonical individual score-event totals unless a future business decision restores team bonuses. |
| `DailyTaskLog` | Per-agent/task/day completion | `POST /api/task-logs` | Competition log UI | Treat as a separate task-completion domain initially. Decide later whether a completed task emits a score event; do not silently convert checkbox state into points. |
| `TrackerLog` | Timestamped decimal KPI measurement, independent of competitions | Tracker services and Teams score targets | KPI/performance dashboards; `competition-repository.getRankings()` currently aggregates it | Remains a separate KPI/performance domain. Do not migrate it into competition score events without an explicit rule mapping. |
| `CompetitionResult` | Persisted rank/total snapshot | Competition completion/gamification workflows | Results/badges history | Retain as a historical result snapshot. Later define how it is generated from confirmed score-event totals. |

## Verified live paths

### Competition scoring and correction paths

| Path | Current behaviour | Risk to address |
| --- | --- | --- |
| `src/app/api/achievements/route.ts` | Manager-authorised POST searches `DailyAchievement` by fields then mutates/creates an aggregate | Concurrent requests can create duplicates or overwrite a total; no individual action history. |
| `src/app/api/achievements/[id]/route.ts` | Manager-authorised DELETE hard-deletes a daily aggregate | Incompatible with the required audit/undo policy. |
| `src/server/services/competition-entry-service.ts` | Updates entry total and creates `CompetitionScoreLog`; broadcasts SSE | Maintains a second scoring truth. |
| `src/server/services/competition-service.ts` | Creates entries and has a separate score mutation; deletes V3 entries/logs during competition deletion | Must be routed through the canonical service before legacy writes can stop. |
| `src/app/api/competitions/logs/route.ts` | Legacy competition score-log route | Must be mapped to the new service or retired deliberately. |
| `src/app/api/competitions/[id]/entries/[entryId]/score/route.ts` | Legacy entry score route | Must be mapped to the new service or retired deliberately. |
| `src/server/services/score-target-service.ts` | Teams hashtag path creates `CompetitionScoreLog`/increments `CompetitionEntry.score`, or writes `TrackerLog` | Do not change until Teams security/idempotency and rule mapping are designed. |

### Read and reporting paths

| Path | Current source | Required future state |
| --- | --- | --- |
| `src/server/services/agent-dashboard-service.ts` | `DailyAchievement` | Active score events aggregated by competition/rule/agent. |
| `src/server/services/management-dashboard-service.ts` | `DailyAchievement` | Active score events, with date filtering. |
| `src/app/api/competitions/agent-rankings/route.ts` | `DailyAchievement` | Aggregated active score events. |
| `src/app/api/competitions/[id]/send-daily-scores/route.ts` | `DailyAchievement` | Daily/event-based projection, preserving current Teams-card requirements. |
| Gamification badge routes | `DailyAchievement` | Explicitly validate whether badge rules use quantities, points, or rankings; move only after comparison tests. |
| `src/server/repositories/competition-repository.ts#getRankings` | `TrackerLog` via competition entries | Domain decision required: this currently conflicts with competition dashboards that use `DailyAchievement`. |
| Certificates/result workflows | `CompetitionEntry.score` and/or `CompetitionResult` | Use confirmed competition score-event totals once the result lifecycle is implemented. |

## Required canonical model

The exact field names remain implementation work, but the new model must have:

- an immutable primary score-event record;
- competition, rule, subject agent, quantity, and awarded points;
- a rule-name snapshot and, where available, the source action's original timestamp;
- the agent's historical pod at the time of scoring;
- `scoredForDate` and `createdAt` as separate values;
- a source (`manager`, `agent_dashboard`, `mobile`, `teams`, `migration`, etc.);
- actor/recorder identity;
- active/voided state, a void/correction link, and a free-text correction reason;
- a client/external idempotency key where relevant;
- indexes for competition/date, subject/date, rule/date, and external key lookup.

Score totals must sum active events. A score undo is a void/reversal operation, not a delete. Existing `Activity` records remain a complementary audit feed; they do not replace the score-event audit record.

## Migration approach

### Phase A — Additive foundation

1. Add the canonical score-event schema and server-only service without changing current reads or writes.
2. Add compatibility tests that calculate totals from both old data and the candidate projection.
3. Do not add a destructive migration, table drop, or automatic backfill to this release.

### Phase B — Backfill in a controlled job

1. Convert each `CompetitionScoreLog` to a score event using its timestamp and legacy ID as a reference.
2. For `DailyAchievement`, determine whether source rows already exist. Where not reconstructible, create a clearly marked migration/opening-balance event that retains the legacy record ID and date.
3. Do not transform `TeamBonusLog` into individual score events under the current product decision.
4. Do not transform `TrackerLog` without a competition-rule mapping decision.
5. Produce a reconciliation report by competition, agent, rule, and date range; retain mismatch records for review.

### Phase C — Dual-read comparison, then cutover

1. In a controlled environment, compare legacy and new totals for every affected report.
2. Switch one reader at a time after its comparison passes.
3. Switch each writer to the canonical service only after its reader has a validated projection.
4. Leave legacy tables read-only through the agreed retention period.

### Phase D — Retirement

Only after reconciliation sign-off, retention expiry, and a dependency search confirming no live reader remains:

1. remove legacy writer paths;
2. remove legacy readers;
3. archive/export required history;
4. introduce a separate, reviewed migration to remove obsolete fields/tables.

## Decisions still needed during Milestone 1

These do not block the additive score-event schema but must be resolved before cutover:

| Decision | Proposed default |
| --- | --- |
| Old daily aggregates with no reconstructible action history | Migrate as a labelled opening-balance event rather than fabricate individual events. |
| Event points after rule configuration changes | Snapshot quantity and awarded points on every event; historic events do not recalculate when a rule changes. |
| Correction implementation | Void the original event and create a linked correction event, with free-text reason. |
| Competition deletion | Prevent hard deletion once score events exist; use archival/cancellation behaviour instead. |
| Client spreadsheet validation | Optional manager-led check and sign-off; not an automatic import. |
| `TrackerLog` competition rankings | Keep separate until the product owner explicitly decides whether those rankings are a KPI view or competition-score view. |

## First coding slice

The first code change should be deliberately additive:

1. Add the new score-event schema and migration only.
2. Add a server-only score-event repository/service with no existing route wired to it.
3. Add unit/integration coverage for create, void, correction, permissions, and total calculation.
4. Add a read-only internal comparison/reporting command or endpoint only if it is access-controlled and safe for the environment.

This avoids changing agent or manager workflows before the model is validated.

## Reconciliation command

Use the read-only command below before and during migration. It compares the
parallel score sources and emits JSON; it does not write score data.

```bash
npm run scores:reconcile -- --summary
npm run scores:reconcile -- --competition=<competition-id>
```

The report intentionally keeps `DailyAchievement` points, legacy
`CompetitionEntry` totals, `CompetitionScoreLog` values, active `ScoreEvent`
points, and team bonuses separate. A mismatch is a review signal, not an
automatic migration failure, because the legacy sources do not always represent
the same business measure.

### Initial local baseline (2026-07-18)

The summary command ran successfully against the local development database:

- 78 competitions were inspected.
- `DailyAchievement` totalled 38,925 points.
- `CompetitionEntry`, `CompetitionScoreLog`, `ScoreEvent`, and `TeamBonusLog` totals were all zero.
- No entry-versus-score-log mismatch was found.

This confirms that `DailyAchievement` is the only populated competition-score
source in the current local dataset. The eventual migration must therefore
represent its aggregate-only history as labelled opening-balance events unless
individual source actions can be recovered elsewhere.

## DailyAchievement backfill command

The following command is dry-run by default. It reports how many historical
aggregate rows would become `ScoreEvent` opening-balance records; it writes
nothing unless `--apply` is supplied.

```bash
npm run scores:backfill-daily-achievements
npm run scores:backfill-daily-achievements -- --apply
```

Every created event uses `source: migration`, retains the legacy row ID as an
external reference, and has a unique idempotency key. Re-running the command
is therefore safe: already migrated rows are skipped. Apply it only after
reviewing the dry-run count and taking an appropriate backup.

### Backfill result (2026-07-18)

A PostgreSQL backup was created before applying the local backfill. The command
then created 9,131 opening-balance events from 9,131 `DailyAchievement` rows.
The post-backfill reconciliation confirmed:

- `DailyAchievement` points: 38,925
- active `ScoreEvent` points: 38,925
- rerun dry-run pending events: 0

The ledger therefore reproduces the current historic competition score total,
while all legacy source rows remain intact and unchanged.

### Restored-data reconciliation and transition sync (2026-07-18)

After the current live dataset was restored locally, the comparison initially
found a 109-point difference across seven agents. The correction-aware sync
identified 31 changed legacy rows, voided the superseded migration events, and
created linked replacement events without modifying the legacy rows. The
post-sync reconciliation is now exact:

- `DailyAchievement` points: 39,034
- active `ScoreEvent` points: 39,034
- daily-achievement-to-event mismatches: 0

During the transition, the existing score-log POST still updates the legacy
aggregate for compatibility and immediately synchronises its corresponding
ledger event. Deleting a score-log item voids its ledger event and removes the
temporary aggregate. This keeps the audit trail while legacy-only consumers
are retired.

## Ledger projection

`score-event-projection-service.ts` now provides competition standings derived
only from active `ScoreEvent` records. It is not wired into a route or UI yet.
The reconciliation summary now includes a per-agent legacy-versus-ledger
mismatch count; this must remain zero before a dashboard reader is switched.

Reader cutover is complete for the score log, agent and management dashboards,
agent rankings, Teams daily-score cards, and badge/ranking calculations. These
paths use active score events while preserving their current response and card
shapes. The rankings route filters on an event's historical `podId`, not a
user's current membership. `DailyAchievement` remains for reconciliation,
backups, import compatibility, and the temporary transition writer.
