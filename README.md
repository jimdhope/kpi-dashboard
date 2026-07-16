# KPI Quest 3.6.0

KPI Quest is a role-aware performance and engagement platform for teams. It combines KPI tracking, competitions, pods, achievements, daily mini-games, shared knowledge and practical workplace tools in one responsive workspace.

## Highlights

- **Role-aware dashboards** for agents, managers and administrators at one dashboard URL
- **KPI performance** with daily results, targets, trends, breakdowns and leaderboards
- **Competitions** with configurable rules, live standings, pods and winner certificates
- **Engagement** through achievements, levels and daily mini-games
- **Team resources** including a knowledge base, directory, call flows and calculators
- **Microsoft Teams workflows** for competition messages, scoring and scheduled updates
- **Installable PWA** with a branded offline fallback and no offline storage of private data
- **Safe operations** with role-based permissions, audit activity, backups and fail-closed migrations

## What’s new in 3.6.0

- Unified the admin and agent dashboard experience, including authorised view switching for multi-role users.
- Added Daily Word, Higher or Lower and three Daily Sudoku difficulties alongside Rock Paper Scissors.
- Added an installable, online-first PWA and installation guidance for supported browsers and devices.
- Introduced a consistent dark glass design system across dashboards and application pages.
- Improved dashboard query behaviour, navigation permissions, security headers and production container safety.
- Removed the unused in-app notification system while preserving Microsoft Teams integrations and gamification awards.
- Strengthened deployment safeguards with committed Prisma migrations, fail-closed startup and explicit production seeding.

## Roles

| Role | Primary experience |
| --- | --- |
| Agent | Personal KPI performance, competition standings, pod highlights, achievements and games |
| Manager roles | Team performance and operational workflows permitted by assigned permissions |
| Administrator | Organisation-wide dashboards, configuration, users, reports, integrations and backups |

Navigation and server-side access checks are permission-aware. Multi-role users can switch between dashboard views they are authorised to use.

## Technology

- Next.js 16 and React 19
- TypeScript and Tailwind CSS
- Prisma 7 with PostgreSQL 16
- Better Auth database sessions, password recovery and optional passkeys
- `pg-boss` background worker
- Docker/Portainer-compatible production image

## Architecture

The Next.js application serves the user interface and authenticated request handlers. Prisma connects the app to PostgreSQL, while a separate worker process handles queued and scheduled work. The PWA service worker is deliberately limited to the offline shell, branding and immutable framework assets; authenticated HTML, APIs, sessions and mutations are never cached.

## Local development

### Requirements

- Node.js 22.15 or newer
- PostgreSQL 16
- npm

Copy the environment template and provide local values:

```bash
cp .env.example .env.local
npm ci
npm run db:generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

KPI Quest runs at `http://localhost:9103`. Seeding is intentional: set a strong `SEED_ADMIN_PASSWORD` before running it. Start the background worker separately when testing scheduled or queued workflows:

```bash
npm run jobs:work
```

`npm run db:push` is reserved for disposable local prototypes. Application schema changes require a reviewed, committed Prisma migration.

## Environment variables

| Variable | Purpose | Production requirement |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `BETTER_AUTH_SECRET` | Protects Better Auth sessions and challenges | Required; at least 32 characters |
| `BETTER_AUTH_URL` | Canonical authentication origin | Required HTTPS production origin |
| `PASSKEY_RP_ID` | WebAuthn relying-party domain | Required; hostname only |
| `POSTGRES_PASSWORD` | Password used by the Docker PostgreSQL service | Required for Docker deployment |
| `PUBLIC_URL` | Public application origin and email-link base | Set to the deployed HTTPS origin |
| `ENCRYPTION_KEY` | Protects encrypted integration values | Required when encrypted integrations are used |
| `SEED_ADMIN_EMAIL` | Initial administrator email | Used only during intentional seeding |
| `SEED_ADMIN_PASSWORD` | Initial administrator password | Required for intentional seeding; never use a default |
| `RUN_SEED_ON_STARTUP` | Enables container startup seeding | Leave unset or `false` for normal upgrades |
| `RUN_AUTH_CUTOVER` | Runs the one-time Better Auth account cutover after migrations | Set to `true` for the cutover deployment only |
| `CUTOVER_ADMIN_EMAIL` | Administrator receiving temporary cutover access | Supply only for the cutover deployment |
| `CUTOVER_ADMIN_TEMP_PASSWORD` | One-use administrator password | Unique, 8–128 characters; remove immediately after cutover |
| `CUTOVER_RESUME` | Fills only missing credential accounts after an inspected interrupted run | Leave `false`; use only for a verified recovery |

Keep secrets outside source control. Production must use unique, randomly generated values.

## Recommended Docker deployment

The standard deployment contains three services:

- PostgreSQL for durable application data
- The KPI Quest web application
- A worker using the same application image

Create a deployment `.env` containing `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `PASSKEY_RP_ID`, then use the supplied Compose definition:

```bash
docker compose pull
docker compose up -d
```

For the Better Auth cutover, stop the old application and worker, take and verify a full backup, then make one deployment with `RUN_AUTH_CUTOVER=true`, `CUTOVER_ADMIN_EMAIL` and `CUTOVER_ADMIN_TEMP_PASSWORD` in Portainer. The web container applies the committed migrations and performs the cutover before accepting traffic. The worker does not run the cutover. Wait for the web log to confirm completion, sign in with the temporary password, and choose a new password. Then remove all three cutover variables (rather than leaving blank values) and redeploy immediately.

The cutover refuses to overwrite credential accounts. If the flag is accidentally left enabled, a later container restart fails closed until the variables are removed. `CUTOVER_RESUME=true` is reserved for a manually inspected interrupted cutover; it fills only missing credential accounts and does not overwrite existing ones.

The application container waits for PostgreSQL and runs `prisma migrate deploy` before starting. The worker waits for the upgraded application to accept connections, keeping jobs out of the migration and cutover window. Migration failures stop startup; there is no fallback to schema pushing, data-loss acceptance or database reset. Production seeding is disabled unless `RUN_SEED_ON_STARTUP=true` is deliberately supplied for an initial installation.

## Safe upgrades

1. Create a full backup in **Settings → General** and confirm it appears in the backup list.
2. Record the current application image digest and Prisma migration status.
3. Retain the previous image and backup throughout the verification period.
4. For the Better Auth release only, stop the old web and worker containers, configure the three one-time cutover variables, then pull and start the new stack. For later releases, start normally.
5. Confirm the cutover completion message, sign in as the nominated administrator, and replace the temporary password.
6. Remove the cutover variables from Portainer and redeploy immediately.
7. Smoke-test login, each dashboard role, competitions, performance, games, reports, Teams workflows and backup availability.
8. If migration or smoke checks fail, stop the new containers, restore the saved backup and restart the previous image.

Never use `prisma db push --accept-data-loss`, migration reset or automatic database reset in production.

## Backup and restore

Authorised administrators can create and restore full application backups through **Settings → General**. Restores replace application data and should only use a verified backup. Keep external copies of release backups until the associated update has passed its verification period.

## Validation

Run checks proportional to the change. Framework, authentication, database, dependency and deployment changes require at least:

```bash
npm run typecheck
npm run test:unit
npm run build
npm audit --omit=dev
npx prisma validate
npx prisma migrate status
```

Docker-related changes should also receive a standard image build and production-like smoke test before release.

## Useful commands

```bash
npm run dev          # Development server on port 9103
npm run typecheck    # TypeScript validation
npm run test:unit    # Unit tests
npm run build        # Production build
npm run jobs:work    # Background worker
npm run db:generate  # Generate Prisma Client
npm run db:migrate   # Create/apply a local development migration
npm run db:seed      # Intentional database seed
```

Additional operator and developer documentation is available in [`docs/`](docs/).
