# KPI Quest Next.js, Performance, and Security Audit

Date: 15 July 2026  
Application version: 3.5.2  
Audit basis: local source, lockfile, existing build output, local OrbStack PostgreSQL metadata, and current npm/GitHub advisories  
Change policy: no application code, database data, migrations, or production systems were changed

## Executive summary

KPI Quest is already on Next.js 16. The proposed Next.js work is therefore a low-complexity but urgent patch from installed version 16.2.3 to 16.2.10, not a major framework migration. The installed version is covered by multiple high-severity denial-of-service, SSRF, and Proxy bypass advisories. The bypasses matter particularly here because every API and most page-level access control begins in `proxy.ts`.

The most urgent application-specific risk is deployment safety. Both application and worker startup fall back from `prisma migrate deploy` to `prisma db push --accept-data-loss`. A transient or genuine migration failure can therefore trigger a destructive schema reconciliation automatically. The production process also runs as root, the checked-in Compose file contains a known default session secret and database password, and the runtime image copies the entire 985 MB dependency tree even though a standalone build is available.

The most significant authorisation defect confirmed in this review is KPI log ownership. Any authenticated user can supply another user's ID when creating a KPI log and can delete any KPI log by ID. Batch creation has the same issue. More generally, permission checks are split among the Proxy, route handlers, and services, which makes coverage hard to prove and makes the current Next.js Proxy vulnerabilities more consequential.

The largest dashboard performance cost is request fan-out combined with repeated authentication work. The agent dashboard begins with eight parallel API calls and later fetches KPI logs separately. Each protected request performs a session lookup plus role/permission queries in the Proxy, and handlers commonly repeat the session and permission lookup. All 76 page components are Client Components, so the dashboard waits for hydration before requesting its main data. Several endpoints return whole collections and aggregate them in the browser.

The earlier 8 GB development-server heap failure is confirmed as a real out-of-memory event, but the audit did not reproduce it during a short safe run. Existing artifacts show 776 MB of Turbopack development cache and unusually broad output tracing from dynamic backup/import filesystem code. These are plausible contributors to development pressure, but a heap profile from a controlled soak is required before assigning a single root cause.

### Priority order

1. Patch Next.js to 16.2.10 and remove the destructive migration fallback before the next deployment.
2. Fix KPI log ownership/permissions, enforce a production session secret, correct secure-cookie detection, and stop running as root.
3. Put explicit permission checks in every privileged route/service and add login/reset throttling, upload limits, session revocation, and security headers.
4. Replace dashboard request fan-out with server-side dashboard queries, eliminate repeated permission queries, and add bounded API filters/pagination.
5. Slim the runtime image, isolate migration/import tooling, then run controlled development and production memory soaks.

## Audit baseline

| Item | Observed result |
|---|---:|
| Next.js | 16.2.3 installed; 16.2.10 current patch |
| React / React DOM | 19.2.5 installed; 19.2.7 current patch |
| Local Node.js | 22.15.0 |
| Docker base | floating `node:20-alpine`; exact patch not pinned |
| Production dependency audit | 24 findings: 1 critical, 7 high, 15 moderate, 1 low |
| API route files | 117, including `route.ts` and `route.tsx` |
| Mutating API handlers | 100 method exports |
| Page components | 76 total; 76 declared as Client Components |
| Agent dashboard startup | 8 initial requests plus a later KPI-log request |
| Existing `.next` directory | 1.1 GB |
| Turbopack development cache | 776 MB |
| Existing standalone output | 87 MB |
| Full local `node_modules` | 985 MB; copied into production by Dockerfile |
| Standalone static chunks | 5.7 MB total; largest individual JS chunk about 432 KB |
| Local test database | 20 MB, 48 users, 30 sessions, 3,332 KPI logs, 77 competitions |
| Type check | Passed on 15 July 2026 |

A short isolated standalone test, using the existing build and unauthenticated routes, produced a cold response of about 50 ms for `/`, then about 3 ms warm; `/login` was 6 ms cold and about 3 ms warm; `/api/auth/session` was 9 ms cold and about 3 ms warm. These values establish only framework overhead. They do not represent signed-in dashboard performance because no test session was created and no production system was queried.

## Findings register

Severity reflects the observed KPI Quest deployment and reachability, not only an upstream CVSS score.

| ID | Severity | Finding and evidence | Impact | Confidence | Recommended action | Effort / regression risk |
|---|---|---|---|---|---|---|
| S-01 | Critical | Application and worker entrypoints run `prisma db push --accept-data-loss` whenever migration deployment fails. | A startup or migration problem can automatically remove or reshape production data. Both containers may race this logic. | Confirmed | Remove all `db push` fallbacks. Run `prisma migrate deploy` once in a dedicated deployment job, fail closed, and require a verified backup/rollback path. | Small / medium |
| S-02 | High | Next.js 16.2.3 is affected by multiple Proxy bypass, DoS, SSRF, cache poisoning and XSS advisories; the app depends heavily on Proxy enforcement. | Authentication or authorisation checks may be bypassed on affected request forms; availability and server-side network access are also exposed. | Confirmed | Upgrade Next.js to 16.2.10 immediately and retain route-local authorisation. | Small / low |
| S-03 | High | KPI create and batch-create accept any `userId`; delete accepts any log ID. Services require only authentication and perform no owner or manager check. | An agent can forge KPI results for another user or delete another user's records. | Confirmed | Default agents to their own ID; permit delegated writes only with the appropriate performance-management permission and pod scope. Verify ownership on delete. | Medium / medium |
| S-04 | High | Checked-in Compose configuration uses `SESSION_COOKIE_SECRET=dev-secret-change-in-production` and `postgres/postgres`. | If reused in production, session signatures can be forged and the database credential is known. | Confirmed configuration risk; production value not inspected | Remove secret defaults, use Docker/Portainer secrets, require adequate entropy at startup, rotate any deployed matching values, and keep PostgreSQL off public host ports. | Small / medium if rotation logs users out |
| S-05 | High | Session cookies become `Secure` only when the unrelated `URL` variable begins with HTTPS. The project otherwise documents `APP_URL` and uses `PUBLIC_URL`. | Production cookies may travel without the Secure flag even when the public site is HTTPS. | Confirmed | Use one validated public URL setting or an explicit secure-cookie flag; default to Secure in production and add a `__Host-` cookie migration plan. | Small / medium |
| S-06 | High | Application and worker start as root even though a `nextjs` user is created. The runtime also contains shells, PostgreSQL clients, package executors, source, scripts and the full dependency tree. | A server-side compromise has unnecessarily broad container capability and tooling. | Confirmed | Run as the unprivileged user, make the filesystem read-only except explicit temp paths, drop capabilities, and split web, worker, migration and import concerns. | Medium / medium |
| S-07 | High | `npm audit --omit=dev` reports 24 findings, including critical `protobufjs`, high gRPC and Next.js issues. Firebase Admin is reachable through the administrator import workflow; Prisma CLI is copied into and executed by production. | Crafted data could cause code execution or denial of service in affected dependency paths; build tools increase attack surface. | Confirmed dependency state; exploitability varies | Apply the dependency batches below. Prefer removing legacy Firebase/import and unused packages if no longer required. Do not run `npm audit fix --force` or downgrade Prisma automatically. | Medium / medium-high |
| S-08 | Medium-high | Login, forgotten-password and reset-password endpoints have no IP/account throttling or progressive delay. | Credential stuffing, password guessing and reset-email abuse are unrestricted at application level. | Confirmed | Add proxy-aware, shared-store rate limits; use generic responses and audit events; define safe limits for login and reset separately. | Medium / low |
| S-09 | Medium-high | Password changes and resets do not revoke existing sessions. Sessions last 14 days and expired rows are cleaned only during login. | A stolen session remains valid after password recovery; expired rows accumulate between logins. | Confirmed | Revoke all sessions for the user after reset/change, then issue a fresh session where appropriate. Move expiry cleanup to a scheduled job. | Small / medium |
| S-10 | Medium-high | Backup/import uploads read the full request into memory, have no explicit byte/decompression limits, and accept backup SQL that is executed as the application database user. Temporary Firebase credentials are written under the application working directory. | An administrator session compromise or accidental large/gzip-bomb upload can exhaust memory or execute destructive SQL; credentials can persist after failure. | Confirmed | Enforce compressed and expanded limits, stream uploads, validate safe file names, use restrictive temporary files with guaranteed cleanup, add step-up confirmation, and run restore/import in isolated jobs. | Medium-large / medium |
| S-11 | Medium-high | Privileged access is distributed across the Proxy, handlers and services. Several route handlers contain no visible permission check and depend on downstream behaviour. | Coverage is difficult to verify and future changes can silently create broken access control. Proxy bypass defects have wider impact. | Confirmed design risk | Define typed route policies and enforce permission/ownership inside services or handlers; treat Proxy as an early rejection layer only. Add a role/method integration matrix. | Large / medium |
| S-12 | Medium | No application security headers are configured in `next.config.mjs`, including CSP, HSTS, frame protection, MIME protection, referrer and permissions policies. | Browser-side exploit impact is higher and clickjacking/content injection receive fewer defensive barriers. | Confirmed | Add headers in report-only/staged form, especially CSP; verify image generation, inline styles, Tiptap and Teams pages before enforcement. | Medium / medium |
| S-13 | Medium | Cookie-authenticated mutations have no explicit Origin/CSRF validation. `SameSite=Lax` is useful but is the sole application-level CSRF defence. | Same-site subdomain compromise and future cookie/configuration changes can expose state-changing requests. | Confirmed defensive gap | Require same-origin `Origin`/`Host` for browser mutations and add CSRF tokens where cross-origin workflows require them. Keep SameSite and Secure flags. | Medium / medium |
| S-14 | Medium | The incoming Teams endpoint sits under the authenticated `/api` Proxy matcher, but its purpose is an external webhook and the route has no independent signature/token verification. | It is either unusable externally today or would become unauthenticated without adequate verification if excluded from the Proxy. | Confirmed | Give incoming endpoints scoped high-entropy secrets or verified signatures, replay protection and rate limits, then explicitly exempt only that route from session auth. | Medium / medium |
| S-15 | Medium | Backup/import errors sometimes return raw exception text; import logging writes stack traces and credential-file paths. Firebase import writes durable debug files in the working directory. | Internal paths, database tool errors and implementation details may leak to administrators or logs and sensitive artifacts may persist. | Confirmed | Return stable error codes, redact logs, remove credential/path logging, and use structured security audit events with retention controls. | Small-medium / low |
| P-01 | High | Every protected request loads the session with user roles and pod memberships; permission checks then query roles and permissions again. Proxy always computes effective admin access, even for unrelated routes. Handlers repeat authentication. | The agent dashboard's request fan-out multiplies database round trips before useful data is returned. | Confirmed | Resolve session plus effective permissions once per request, avoid unconditional admin checks, and pass a verified auth context to route logic. Cache role-policy definitions with explicit invalidation. | Medium / medium |
| P-02 | High | `/dashboard` is client-rendered, fetches the session after hydration, then mounts another Client Component. The agent view issues eight startup API calls plus KPI logs; the admin view performs four sequential calls. | Visible loading states last longer, requests duplicate shared data, and each call repeats auth/database work. | Confirmed | Make the dashboard shell a Server Component, select the role view server-side, and expose one purpose-built dashboard data query per view. Parallelise independent server queries. | Large / medium-high |
| P-03 | High | All 76 page components declare `use client`. | More JavaScript and hydration work is sent than necessary, and server data fetching/caching benefits are largely unused. | Confirmed | Convert page/layout shells to Server Components incrementally; keep only interactive leaf components client-side. Start with dashboard and read-only tables. | Large / medium |
| P-04 | High | KPI log listing is unpaginated. An agent dashboard fetches all logs visible to the user's pod, then filters to the signed-in user and to recent weeks in the browser. | Payload, database work and browser memory grow with historical data and pod size. | Confirmed | Add server-enforced user/date filters and pagination. Return only the six-week agent summary required by the card. Add composite indexes matching the final query. | Medium / medium |
| P-05 | Medium-high | Dashboard endpoints fetch full competitions, pods, users and achievements, then derive top-10 and standings in browser loops. Admin calls are sequential. | Large payloads and repeated O(n*m) browser searches increase with company history. | Confirmed | Move top performers, pod performance and competition summaries into grouped database queries and return compact view models. | Medium-large / medium |
| P-06 | Medium-high | Competition ranking aggregates tracker logs once per competition entry. Dashboard pod comparison also performs one query per assigned pod. | Classic N+1 query growth increases latency and connection pressure. | Confirmed | Replace with grouped aggregate queries and batch user/pod joins. | Medium / low-medium |
| P-07 | Medium-high | Existing standalone output is 87 MB, but Docker copies the full 985 MB `node_modules` directory, including platform-specific build tooling and Prisma CLI. | Images are much larger, builds/pulls/restarts are slower, and the security surface expands. | Confirmed | Copy only standalone output and explicit runtime assets. Use a separate migration/import image or install only narrowly required runtime tools. | Medium / medium |
| P-08 | Medium | Backup/restore output tracing includes broad application source and documentation because of dynamic filesystem/process usage. Existing standalone output contains `src`, `docs`, scripts and helper assets. | Output is larger and file tracing/build analysis performs unnecessary work. | Confirmed | Isolate backup/import into explicit server-only modules or a separate service; use output-file-tracing exclusions only after runtime verification. | Medium / medium |
| P-09 | Medium | The local `.next` tree is 1.1 GB, including 776 MB of Turbopack development cache. The earlier dev process reached about 8 GB heap before crashing. | Developer restarts and recompilation can consume substantial disk/memory; the precise leak remains unproven. | Partially confirmed | Upgrade Next first, clear only generated `.next` state when the server is stopped, run controlled soaks with heap snapshots, and compare Turbopack file caching on/off. Do not simply raise the heap limit. | Medium diagnostic effort / low |
| P-10 | Medium | Several frequently joined competition tables lack explicit foreign-key indexes, including competition entries, rules, teams and score logs. Current test data is small, so impact is not yet visible. | Query plans may degrade sharply as competition history grows. | Confirmed schema; performance impact projected | Capture `EXPLAIN (ANALYZE, BUFFERS)` for production-shaped queries, then add only evidenced composite/foreign-key indexes through migrations. | Medium / low |
| R-01 | Medium | Production seeds on every application startup while the worker can concurrently run migration logic. | Startup time, race conditions and unintended default-data changes become deployment-dependent. | Confirmed | Separate one-time migration and explicit seed/bootstrap jobs from web/worker startup. | Medium / medium |

## Dependency upgrade matrix

| Package/group | Installed | Proposed target | Classification | Compatibility and security decision |
|---|---:|---:|---|---|
| Next.js | 16.2.3 | 16.2.10 | Urgent patch | Same 16.2 line; no codemod expected. Fixes the currently reported Next.js advisories. Run route/auth and image-generation regression tests. |
| React / React DOM / react-is | 19.2.5 | 19.2.7 | Patch | Upgrade together with matching React type packages. Low expected application risk. Remove direct `react-is` if confirmed unused. |
| PostCSS | 8.5.9 | 8.5.19 | Urgent patch | Fixes the reported style-stringification XSS advisory. Validate Tailwind production CSS. |
| Prisma Client, adapter and CLI | 7.7.0 | 7.8.0 | Patch, isolated batch | Keep all Prisma packages aligned. Do not accept npm's suggested downgrade to 6.19.3. The reported Hono path belongs to Prisma tooling; remove CLI/dev tooling from the web runtime and reassess the audit after upgrading. |
| Firebase Admin chain | 13.7.0 | Remove if legacy import is retired; otherwise 14.1.0 | Major | This chain accounts for critical/high protobuf and gRPC findings. Upgrade requires an import-only regression test and Node compatibility check. Prefer isolating it from the web process. |
| Tailwind CSS / Tailwind PostCSS | 4.2.2 | 4.3.2 | Minor | Test generated CSS, themes, arbitrary values and production build in its own batch. Not required for the Next security patch. |
| Tiptap extensions/core | 3.22.3 | 3.27.4 initially, then reassess | Minor | Keep every Tiptap package aligned. Re-run audit for `markdown-it` and `linkify-it`; add editor input/size limits even after upgrades because advisories concern algorithmic complexity. |
| Radix UI packages | Mixed current | Current compatible releases | Minor/patch batch | Upgrade as a UI regression batch, not with the urgent security patch. Exercise dialogs, selects, menus, focus handling and mobile navigation. |
| `@hookform/resolvers`, Zod, React Hook Form | 5.2.2 / 4.3.6 / 7.72.1 | Current compatible releases | Minor/patch batch | Upgrade together and test every form/error mapping. Not urgent. |
| `pg`, `pg-boss` | 8.20.0 / 12.15.0 | 8.22.0 / 12.26.0 | Minor/patch batch | Test database pool lifecycle, worker startup, scheduled jobs and graceful shutdown. |
| TypeScript | 5.9.3 | Remain on 5.9.x | Hold major | Do not move to TypeScript 7 as part of this programme. Upgrade only after Next.js/Prisma explicitly support it and a separate migration is planned. |
| Node.js container | floating Node 20 Alpine | Pinned supported Node 20 LTS patch by digest | Deployment | Next.js 16 requires Node 20.9+. Pin and update deliberately; scan the final image. Local Node 22 does not prove Docker parity. |

Direct dependencies with no source import found during static inspection are `@opentelemetry/api`, `@resvg/resvg-js`, `@vercel/og`, `cookie`, `html-to-image`, `lowlight`, `react-is`, and `web-push`. Some functionality is provided indirectly by `next/og`, and Resvg may be historical. Confirm with a production build and feature tests, then remove unused direct declarations. Firebase Admin is imported only by the separately spawned legacy import script rather than normal application modules.

## Authentication and API permission matrix

The table groups related routes because there are 117 API route files. Every group must ultimately have method-level integration tests; presence in the Proxy is not counted as sufficient authorisation.

| Route family | Read policy | Mutation policy observed | Assessment |
|---|---|---|---|
| `/api/auth/login`, forgot/reset | Public | Public with validation; no throttling | Needs rate limits, consistent generic responses and session revocation |
| `/api/auth/session`, logout, password, permissions | Signed-in except login/reset family | Password is self-service; permissions reads signed-in role map | Generally scoped; session lifecycle fixes required |
| `/api/users` | Admin sees all; other roles see users in their pods | Service requires effective admin | Good service-level enforcement; add explicit route policy tests |
| `/api/users/me` | Self | Self with current password for password changes | Good ownership shape; revoke sessions after credential changes |
| `/api/competitions`, drafts, entries, scores, certificates, templates | Signed-in reads | Enforcement varies between competition editor, signed-in-only and route-specific code | High-priority full matrix; score/template/draft mutations require explicit competition MANAGE policy and scope |
| `/api/achievements`, task logs, bonus logs, activities | Signed-in, sometimes pod-scoped | Several mutations require only signed-in status | Define self, pod-manager and competition-manager ownership rules explicitly |
| `/api/performance/kpi-logs` and batch | Admin/pod-scoped reads | Any signed-in user can write for arbitrary user and delete arbitrary ID | Confirmed high-severity broken object-level authorisation |
| `/api/performance/logs` legacy tracker routes | Signed-in | Mixed signed-in/admin checks | Trackers are described as removed but legacy APIs/models remain; retire or fully protect |
| `/api/pods`, campaigns | Admin/all or pod-scoped reads | Services require admin | Service enforcement is sound; permission model may be stricter than configured nav roles |
| `/api/directory/*` | Signed-in | Handler checks session and effective admin for mutations | Acceptable baseline; replace repeated bespoke checks with typed policies |
| `/api/kb/*` | Signed-in/published content | Author or effective admin in article/comment paths; category/tag checks vary | Preserve author ownership tests and standardise manage policy |
| `/api/gamification/*` | Signed-in profile/leaderboards | Admin endpoints use admin service; daily games are self-scoped | Generally strongest route-local pattern; test forged user IDs and leaderboard inputs |
| `/api/mini-games/*`, `/api/rps-games` | Signed-in | Server-calculated/self-scoped | Good design intent; retain server validation and add request limits |
| `/api/settings/backup`, import, permissions, score targets | Admin through service/handler and Proxy | Destructive administrator operations | Strong role check, but requires step-up confirmation, size limits, isolation and safe deployment semantics |
| `/api/integrations/*` | Admin through Proxy/service | Admin service checks for management APIs | External incoming endpoint needs separate secret/signature policy and Proxy exception |
| `/api/render/*`, certificate and badge images | Signed-in through Proxy | Read-only generation from request parameters | Add request-size/rate limits; keep React escaping and validate numeric/list inputs |
| `/api/search` | Signed-in through Proxy | Read-only | Scope user/contact results by permission and keep query/result limits |

## Performance remediation targets

These are proposed acceptance targets to make improvements measurable. Baselines for authenticated routes must be captured with production-shaped anonymised data before implementation.

| Area | Target |
|---|---|
| Dashboard request fan-out | One primary data request after navigation, or direct Server Component data loading; no duplicate session request |
| Authentication query cost | One session/auth-context resolution per request; no repeated role lookup inside the same request |
| Dashboard database work | No N+1 queries; fixed query count independent of pod member and competition entry count |
| Dashboard payload | Only fields and date ranges shown by the cards; no whole-history achievements/KPI transfer |
| API bounds | Pagination or hard server limits on every potentially growing collection |
| Warm API latency | p95 below 250 ms locally with a production-shaped dataset for dashboard summary endpoints |
| Dashboard server response | p95 below 500 ms locally for the data-bearing signed-in response, excluding browser/network variance |
| Client JavaScript | Reduce dashboard route JavaScript by at least 30% from a recorded pre-change browser trace |
| Runtime memory | Production RSS reaches a plateau during a 60-minute mixed-request soak; less than 10% growth after warm-up |
| Development memory | Four-hour representative edit/navigation soak remains below an agreed machine-specific ceiling and does not trend monotonically |
| Runtime image | Do not copy the 985 MB full dependency tree; target an image based on standalone output plus explicit runtime tools/assets |

### Controlled memory investigation

1. Commit or temporarily shelve unrelated work before diagnostics; record Node, Next, macOS/OrbStack and architecture versions.
2. Upgrade to the patched Next.js version before treating any dev-server profile as current.
3. Start from a stopped server and generated-cache cleanup, then record RSS, heap used, external memory and active handles every 30 seconds.
4. Run three separate 60-minute cases: idle; repeated dashboard navigation; repeated edits that trigger recompilation. Do not restore backups during these cases.
5. Capture heap snapshots near 1 GB, 2 GB and before the configured safety stop. Compare retained object classes and module/key accumulators.
6. Repeat against the standalone production server using the same request mix. If only development grows, focus on Turbopack/SWC tracing and watchers; if both grow, focus on application caches, SSE clients, jobs and query result retention.
7. Run a separate backup/import case because file tracing, large buffers and child-process output accumulation are distinct risks.

## Proposed implementation batches

### Batch 1: emergency dependency and deployment safety

- Upgrade Next.js to 16.2.10, React packages to 19.2.7 and PostCSS to 8.5.19.
- Remove automatic `db push`, automatic seed and migration races; add a one-shot migration job that fails closed.
- Require externally supplied secrets and pin a supported Node image patch/digest.
- Add regression tests proving protected routes remain protected when requested with Next.js prefetch/segment headers and encoded dynamic paths.

Rollback: retain the previous image and database backup; application rollback must not reverse an already applied schema migration without a reviewed down/restore procedure.

### Batch 2: authorisation and session hardening

- Fix KPI log write/delete ownership and add method-level route policies for all competition, achievement, task, bonus and legacy performance mutations.
- Correct secure-cookie configuration, revoke sessions after password changes/resets, and add login/reset throttling.
- Add same-origin mutation checks and staged browser security headers.
- Run the complete role/method matrix for admin, campaign manager, pod manager, team leader, competition runner, agent and multi-role users.

Rollback: feature flags may relax new headers or route aggregation, but must not restore known broken object-level authorisation.

### Batch 3: container, backup and dependency isolation

- Run web and worker as non-root, slim standalone output, and move Prisma/Firebase/import/backup tooling into explicit jobs or images.
- Add upload/decompression limits, safe temporary files, cleanup, step-up confirmation and structured audit logging.
- Remove unused packages; upgrade or isolate Firebase Admin, Prisma tooling and Tiptap chains, then re-run production-image scanning.

Rollback: keep the old operational backup/import job available only to administrators during validation; do not re-enable destructive automatic migration behaviour.

### Batch 4: dashboard and query performance

- Convert dashboard shells to Server Components and return compact per-view summaries.
- Consolidate auth context, cache permission definitions safely, aggregate standings in PostgreSQL, and eliminate N+1 queries.
- Add server-side filters/pagination and evidence-based indexes.
- Record browser, API, query and memory baselines before and after each sub-change.

Rollback: preserve old response shapes behind temporary compatibility adapters until both dashboards pass parity checks.

### Batch 5: incremental Server Component conversion and observability

- Convert read-only page shells from Client Components in high-traffic order.
- Add privacy-conscious request timing, query-count, worker-lag, error-rate and memory metrics.
- Establish automated dependency scanning, container scanning and a monthly patch cadence.

## Verification checklist

For every batch:

- `npm run typecheck` passes.
- A clean `npm ci` and production `npm run build` pass on the pinned Docker Node version.
- Prisma client generation and `prisma migrate deploy` pass against an empty database and a restored production-shaped backup; schema drift is checked and no `db push` is used.
- `npm audit --omit=dev` and a scan of the final runtime image are recorded, with reachability notes for any accepted advisory.
- Authentication tests cover missing, malformed, expired and revoked cookies plus role changes during a session.
- The route matrix tests every exposed method for unauthenticated, insufficient-role, correct-role, wrong-owner and correct-owner requests.
- Browser tests cover login, reset, multi-role dashboard switching, admin/agent dashboards, competitions, performance, mini-games, KB editor, directory and Teams administration.
- Headers and CSP are checked on HTML, API, image and streaming responses.
- Backup/restore tests cover valid files, wrong extensions, oversized compressed files, decompression bombs, interrupted restores, cleanup and rollback.
- Performance tests record p50/p95 response time, query count, response bytes, browser JavaScript and memory before and after.
- A 60-minute production soak and four-hour development soak meet the plateau criteria before deployment.
- Deployment rehearsal verifies migration failure stops the release without changing schema or starting the new application.

## Sources and limitations

- Next.js 16 upgrade requirements and Node 20.9 minimum: <https://nextjs.org/docs/app/guides/upgrading/version-16>
- Next.js 16.2 release performance context: <https://nextjs.org/blog/next-16-2>
- Current Next.js and transitive vulnerability references were captured from `npm audit` on 15 July 2026. Principal Next.js advisories include <https://github.com/advisories/GHSA-26hh-7cqf-hhc6>, <https://github.com/advisories/GHSA-492v-c6pp-mqqv>, <https://github.com/advisories/GHSA-c4j6-fc7j-m34r>, and <https://github.com/advisories/GHSA-8h8q-6873-q5fj>.
- Critical protobuf dependency advisory: <https://github.com/advisories/GHSA-xq3m-2v4x-88gg>.
- No production host, Portainer configuration, reverse proxy, firewall, TLS certificate, production secrets or production database was inspected.
- No destructive test, exploit attempt, password guess, backup restore, migration or production request was performed.
- The isolated response sample covered only public/unauthenticated paths. Authenticated performance targets require a dedicated test account and production-shaped anonymised data during implementation.
- Static unused-dependency findings must be confirmed by a clean build and feature regression tests because dynamic imports and operational scripts can evade simple source searches.
