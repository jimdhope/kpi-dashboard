# KPI Quest implementation guide

**Purpose:** this is the single working plan for the next phase of KPI Quest. It
sets product decisions, technical guardrails, delivery order, and acceptance
criteria before implementation begins.

**Status:** active implementation guide — update this document as decisions are
made and milestones are completed.

## Product direction

KPI Quest should make scoring quick for agents, reliable for managers, and
auditable for official business use. The application must retain a trustworthy
record of how every score was created, corrected, or cancelled. Dashboards,
leaderboards, mobile scoring, Teams integration, and notifications all build on
that record.

## Decisions already made

| Area | Decision |
| --- | --- |
| Score storage | Store every scoring action as an individual score event. Do not make a single daily aggregate the source of truth. |
| Totals and leaderboards | Calculate totals from score events for the requested date range. Optional daily/monthly summaries may be introduced later as a cache only. |
| Agent scoring | Agents can score themselves for rules they are allowed to score, in any quantity. |
| Agent undo | Agents can undo their own score events. Undoing must preserve history: void or reverse the original event rather than hard-delete it. |
| Admin corrections | Authorised admin roles can create, amend, void, or correct scores for any competition they are allowed to access, including historic competitions. |
| Client result | Live competition totals are provisional. Client results, normally received about 10 working days later, are the official confirmation point. |
| Client-result evidence | The team manager receives a spreadsheet covering all client KPIs. Competition KPIs are generally separate from it, but the spreadsheet may be used to validate a competition when needed. |
| Result sign-off | The relevant manager signs off a provisional competition result if validation is required. |
| Correction reason | Historic admin corrections require a free-text reason recorded with the correction. |
| Team bonuses | Do not include team bonuses in the new model for now. Preserve legacy information during migration, but retire the feature unless a repeatable business case returns. |
| Historic data | Never drop or overwrite legacy scoring data until it has been migrated, reconciled, signed off, and retained for an agreed period. |
| Local cutover | This workspace is not production. It may move fully to the new score-event model; when live data is imported later, run the reviewed transformer and reconciliation before release. |
| Real-time delivery | Real-time updates are a convenience layer, never the source of truth. A page can always recover by refetching data. |
| Feedback anonymity | If retained, “anonymous” means anonymous to administrators while privately linked to the submitting user so they can view its status. |

## Core scoring policy

### Score events

Every score action creates a discrete, append-only event. Typical sources are:

- an agent using the dashboard self-score card;
- an agent using the mobile quick-score page;
- a manager entering or correcting a score;
- a future Teams/Power Automate integration.

Each event should record at least:

| Field | Why it matters |
| --- | --- |
| Event ID | Identifies the action and supports idempotency. |
| Competition and rule | Defines what was scored. |
| Subject agent | Identifies who receives the score. |
| Quantity and points | Retains both the raw achievement and the points consequence. |
| Scored-for date and created-at timestamp | Separates the business date from the time of entry. |
| Source | Dashboard, mobile, manager, Teams, migration, etc. |
| Actor | Who submitted the action. |
| Status | Active or voided. |
| Void/correction link and reason | Makes amendments traceable. |
| Optional external reference | Prevents duplicate Teams or client-import submissions. |

Totals include active events only. A voided event remains visible in audit views but contributes zero. A correction should normally be a new event linked to the original, rather than editing history in place.

### Permissions and business rules

- An agent may only create or undo their own events.
- An agent may only score active, agent-permitted rules for competitions and pods they belong to.
- There is no artificial cap based on `dailyTarget`; it is a target, not a maximum.
- Managers and admins use existing role and competition-scope rules. The server independently checks scope on every mutation.
- Admin changes to historic or completed competitions require a reason.
- All public request boundaries validate input at runtime; client-side controls are never treated as authorisation.

### Competition lifecycle

Use an explicit status model so users understand the authority of a result:

```text
Draft → Active → Awaiting client result → Confirmed
                                  └────→ Adjusted
```

- **Active:** live totals and leaderboards are visible and provisional.
- **Awaiting client result:** activity has ended; authorised corrections remain possible while the external result is awaited.
- **Confirmed:** the client result has been received and the relevant manager has signed off where validation is required.
- **Adjusted:** a confirmed result changed later, with an audit reason.

The exact UI wording can be refined, but the distinction between a live total and an official result must remain clear.

## Architecture principles

1. **One scoring command path.** Dashboard, mobile, manager tools, and Teams must use the same server-side service and policy checks.
2. **Score events first; projections second.** Standings, daily totals, activity lists, and any cached summaries are derived from the event record.
3. **Transactions for durable work.** Persist the score event and its audit/activity record atomically.
4. **Durable events for asynchronous work.** Notifications, SSE broadcasts, and Teams posts should be published from a durable outbox/job after the database transaction succeeds. Do not rely on an in-memory event bus for critical delivery.
5. **SSE is recoverable.** On a relevant event, clients should invalidate/refetch the affected data. Do not depend on complex local state merges for correctness.
6. **No destructive schema release.** Add new structures first, migrate and compare, switch reads/writes, then retire old structures in a later release.
7. **Auditability by design.** No hard deletion of official score actions or silent post-competition edits.

## Delivery roadmap

### Milestone 0 — Discovery and safeguards

**Goal:** establish a safe starting point without user-facing behaviour changes.

**Completed discovery note:** [Scoring inventory and migration baseline](./milestone-0-scoring-inventory.md)

- Inventory every current scoring writer and reader: `DailyAchievement`, competition entries/score logs, tracker logs, bonuses, tasks, certificates, badges, reports, Teams hooks, and exports.
- Identify all current data dependencies before declaring code dead.
- Define which roles may correct scores in each competition scope.
- Confirm what the client result contains and how it is matched to a competition.
- Document that client evidence is a manager-received KPI spreadsheet and define a lightweight, optional validation/sign-off workflow rather than assuming it is required for every competition.
- Decide legacy retention period and who signs off a reconciliation.

**Exit criteria:** a written migration map exists and no schema/table is scheduled for removal without a known reader, replacement, and retention decision.

### Milestone 1 — Canonical score-event foundation

**Goal:** create the trusted source of scoring truth.

- Introduce the score-event model, status/void relationships, source attribution, and appropriate database indexes.
- Create a server-only scoring service for create, undo, admin correction, and historic correction.
- Add idempotency support for clients and future external integrations.
- Implement audit views/data needed to explain a total.
- Add explicit competition-result lifecycle fields or equivalent status representation.

**Progress (2026-07-18):** additive schema, server-only ledger services,
idempotency/void integration coverage, and the manager score-log transition
writer are in place. The competition score log now includes a manager-facing
audit trail for active and voided events, recorder/source attribution, and a
reasoned correction action that retains the original event. Broader role/scope
regression coverage remains before this milestone is signed off.

**Exit criteria:** authorised users can create and undo/correct events; a competition total is reproducible from active events; voided events stay auditable; automated tests cover permissions and concurrent/duplicate submissions.

### Milestone 2 — Migration and reconciliation

**Goal:** move safely from parallel scoring systems.

- Migrate legacy records into score events with `source: migration` and a preserved legacy reference.
- Reconcile totals by competition, agent, rule, and team where applicable.
- Investigate and document every mismatch; do not silently force totals to match.
- Switch read models incrementally to the new events/projections.
- Keep legacy tables and code paths read-only for the agreed retention period.

**Progress (2026-07-18):** the restored local data reconciles with zero
daily-achievement-to-event mismatches. The score log, dashboards, rankings,
Teams daily cards, and badge calculations now read active ledger events.

**Exit criteria:** business owner approves reconciliation; dashboards, certificates, badges, and reports agree with the new scoring policy; rollback remains possible without data loss.

### Live-data import procedure

When a current production database is imported into this local cutover
environment:

1. take a database backup before the import;
2. apply all committed Prisma migrations, including the `ScoreEvent` schema;
3. run `npm run scores:backfill-daily-achievements` and review the dry-run;
4. run `npm run scores:backfill-daily-achievements -- --apply`;
5. run `npm run scores:reconcile -- --summary` and require zero
   daily-achievement-to-event mismatches;
6. only then enable ledger-backed score reads and writes.

The backfill is the type/data transformer for legacy daily aggregates. It
creates one clearly labelled opening-balance event per legacy row rather than
inventing individual historical actions.

### Milestone 3 — Real-time updates

**Goal:** connected users see relevant score changes promptly.

- Publish score events through a durable outbox/queue to SSE channels.
- Use competition channels for standings and scoped user channels for personal updates.
- Make clients refetch affected views after an event.
- Handle reconnects, server restarts, and duplicate delivery safely.

**Progress (2026-07-18):** Score-event creation and voiding now publish SSE
invalidation signals for both agent self-scoring and manager daily-score paths.
The agent dashboard, agent competition view, manager score log, and canonical
competition standings subscribe to the selected competition and refetch their
database-backed read models after an event, reconnect, browser-online event, or
return to a visible tab. Signals are debounced and carry no calculated totals.
The current single-app Docker deployment is covered; a database-backed outbox
or cross-instance pub/sub remains required before horizontally scaling the web
service beyond one app container.

**Exit criteria:** two separate sessions see a score change without manual refresh; a reconnect or missed event self-recovers through refetch.

### Milestone 4 — Agent dashboard self-scoring pilot

**Goal:** prove the end-to-end self-scoring workflow in the most visible contained interface.

- Add a rule capability that distinguishes “visible to agents” from “agents may log this rule.” Do not overload one flag if both concepts are needed.
- Add a compact self-score card to the agent dashboard.
- Show immediate provisional feedback, recent individual actions, and an undo action.
- Make server-side eligibility checks authoritative.

**Progress (2026-07-18):** `CompetitionRule.agentCanLog` is an additive,
manager-controlled toggle in both competition editors. The agent dashboard
shows only enabled rules, records immutable `agent_dashboard` score events,
lists recent self-recorded entries, and permits the originator to undo them.
The API independently checks the rule, competition window, and active pod
membership; it does not trust the browser's selection.

**Exit criteria:** an agent can score and undo their own permitted event; a manager can see the audit trail; disallowed rules/competitions cannot be bypassed through direct requests.

### Milestone 5 — Mobile quick score and PWA

**Goal:** offer the same trusted action on a phone with minimal friction.

- Add the correct web-app manifest and verify icons, standalone launch, and mobile authentication.
- Build `/quick-score` around the same scoring service/API as Milestone 4.
- Use large targets, in-flight protection, idempotency, success feedback, and undo.
- Show recent score events rather than attempting to reconstruct history from daily totals.

**Progress (2026-07-18):** the existing web-app manifest is retained and a
mobile-first `/quick-score` screen now calls the same protected self-scoring
endpoint as the agent dashboard. It provides large controls, quantity
validation, an idempotency key per submission, and success/error feedback.
Recent-entry undo remains available from the agent dashboard. Real-device PWA
and retry/offline validation remains outstanding.

**Exit criteria:** real-device testing confirms installation, login, score, undo, offline/error recovery, and no duplicate scores from double taps or retries.

### Milestone 6 — Rollout support

**Goal:** make launch communication and feedback manageable.

- Add Message of the Day, using sanitised rich text and a cap on active messages. Consider a publish window/expiry to avoid stale announcements.
- Add Feedback with validated uploads stored on durable storage, not an ephemeral container filesystem.
- Introduce basic admin workflow for feedback status and responses.

**Progress (2026-07-18):** Message of the Day is implemented as a safe
plain-text announcement. Admins can create, view, edit, and delete messages on
the dedicated General → MOTD page, and signed-in agents see the active message
at the top of their dashboard. Agents can submit feedback with up to three
validated attachments, while admins triage it on General → Feedback. Files are
stored in `FEEDBACK_UPLOAD_DIR` (or local `uploads`). Docker Compose now mounts
`FEEDBACK_UPLOAD_HOST_DIR` into `/app/uploads`, and startup fails clearly if it
is not writable by UID 1001. Triage downloads are permission-protected, checked
against the attachment metadata for that feedback record, forced as downloads,
and marked `nosniff`. A live container-replacement persistence smoke test remains
for deployment verification.

**Exit criteria:** admins can communicate an announcement and triage feedback without exposing untrusted HTML/files or losing uploaded evidence on deployment.

### Milestone 7 — Absences and People management

**Goal:** improve people operations without destabilising existing administration.

**Progress (2026-07-18):** Managers can record date-range absences, including an
unknown end date, from Settings → Users → Absences. The daily competition log
automatically treats recorded absences as not present. A manager can tick a
person back to present for one specific day; this creates a day-only presence
override and does not alter the underlying absence record. Settings → People
now supports the core user, role, pod/campaign, and absence workflows while the
established pages remain available as a rollback path. Multi-role and multi-pod
permission regression testing is still required before the legacy navigation
entries are retired.

**Permission hardening (2026-07-18):** People page controls and all affected
service mutations use database-backed role configuration; role names are not
an authorisation boundary. Capabilities remain in `RolePermission` with clear
No access, View only, and View and change labels. Data scope is stored
separately in `RoleDataScope` with the explicit values NONE, ASSIGNED_PODS, and
ALL_PODS, displayed as No data access, Assigned pods only, and All pods.
One person can lead multiple pods and all assignments are combined. Separate
matrix rows cover account management, role assignment, pod deletion, MOTD,
feedback triage, backup/restore, permission administration, and other sensitive
actions. The reset action now genuinely restores defaults, while normal seeding
continues to fill missing rows without overwriting configured permissions.

- First add an absence model with date-overlap semantics and scoped manager actions.
- Respect in-progress competition policy: retain existing enrolment and earned points.
- Add the unified People view as an additive experience initially.
- Retire the separate Campaigns, Pods, and Users pages only after permission and workflow validation.

**Exit criteria:** every role sees only its permitted users and actions; absence dates affect new enrolment and leaderboard presentation as intended; current management workflows remain recoverable during rollout.

### Milestone 8 — Notifications and Teams

**Goal:** add delivery channels after the domain events are reliable.

**Progress (2026-07-18):** Persistent in-app notifications now cover feedback,
announcements, score corrections, and official result confirmation. Each
competition also has an opt-in automatic Teams update toggle. The background
worker checks every 15 minutes, uses the same delivery path as the manual daily
score send, and sends only when a score event, correction, or team bonus is
newer than the last fully successful automatic delivery. The feature is off by
default and failed/partial deliveries retain the prior marker for retry.

- Introduce a small, useful notification set first (score correction, result confirmation, feedback submitted, announcements).
- Keep audit activities, persistent user notifications, and ephemeral toasts as separate concepts.
- Defer complex per-type preferences and email delivery until there is demonstrated demand.
- Revisit the Teams bridge only after Power Automate capabilities are confirmed with IT.
- Require signed requests, sender mapping, idempotency/replay protection, and private failure audit logs for Teams scoring.

**Exit criteria:** notification delivery cannot create or alter scores; Teams cannot produce duplicate scoring; IT has approved the operational design.

### Milestone 9 — Cleanup and native-app decision

**Goal:** reduce maintenance only after replacements are proven.

- Remove legacy code and tables in small, independently reviewed releases after retention and reconciliation approval.
- Assess PWA/mobile adoption before choosing a native-app strategy.
- Do not commit to separate Swift and Windows/cross-platform frontends until there is a quantified need that the PWA cannot meet.

## Deferred or removed scope

| Item | Decision |
| --- | --- |
| Team bonus scoring | Deferred/removed from the new model pending a real business case. |
| Direct multi-platform native apps | Long-term investigation only. |
| Broad dead-code deletion | Only after dependency analysis and safe replacement. |
| Teams hashtag scoring | Deferred until scoring foundation, notifications/outbox, and IT verification are complete. |
| Per-event notification preferences and email | Defer past initial notification release. |

## Implementation checklist for every milestone

- [ ] Confirm user-facing policy and acceptance criteria before coding.
- [ ] Identify affected roles and independently enforce authorisation in services/route handlers.
- [ ] Validate all client-controlled data with Zod or equivalent runtime schemas.
- [ ] Provide migration and rollback considerations for every schema change.
- [ ] Add focused automated tests for the domain rules and permissions.
- [ ] Run type checking, Prisma validation, production build, and relevant security checks.
- [ ] Test the feature through the roles affected.
- [ ] Update this guide with completed work, changed decisions, and any new open questions.

## Change-control rule

Before starting a milestone, add a short implementation note under that milestone or link a dedicated design note from it. The note must state the exact user behaviour, data migration, permissions, and tests. This document remains the primary guide; additional notes should clarify a milestone, not create competing plans.
