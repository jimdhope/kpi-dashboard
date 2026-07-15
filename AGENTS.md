# KPI Quest - AI Agent Documentation

<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before changing Next.js routing, rendering, caching, Proxy, Route Handlers,
Server Actions, configuration, or deployment behaviour, find and read the
complete relevant App Router documentation in
`node_modules/next/dist/docs/01-app/`. These bundled docs match the installed
Next.js version and are the source of truth; do not replace them separately.

<!-- END:nextjs-agent-rules -->

## Project Overview
- **Name:** KPI Quest
- **Version:** 3.5.2
- **Stack:** Next.js 16, React, TypeScript, Tailwind CSS, Prisma, PostgreSQL
- **Local workspace:** `/Users/jim/Projects/KPI Quest`
- **Production location:** `/var/www/kpi-dashboard`
- **Port:** 9103

## Developer Commands

```bash
npm run dev      # Start dev server (port 9103)
npm run build   # Production build
npm run start   # Start production server
npm run typecheck  # Type check only (no lint)
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Create/apply a migration in local development
npm run db:push     # Push schema to DB
npm run db:seed     # Seed database
npm run jobs:work   # Run background worker
```

**Note:** No lint script exists. Run `typecheck` and a production build for
validation. Use `db:push` only for disposable local prototyping; committed
migrations are required for application schema changes.

## Key Configuration

### Database
- PostgreSQL at `localhost:5432`
- Database name: `kpi_quest_v3`
- User: `postgres` / Password: `postgres`
- Prisma schema: `prisma/schema.prisma`

### Session
- Cookie name: `kpiq_v3_session`
- Local secret in `.env.local`
- Production `SESSION_COOKIE_SECRET` must be explicitly set and contain at
  least 32 characters

### Deploy
- **Portainer stack:** `migration-bundle` at `/home/ubuntu/migration-bundle/docker-compose.yml`
- **Docker Hub image:** `jimdhope/kpi-dashboard:latest`
- **Required production variables:** `POSTGRES_PASSWORD`,
  `SESSION_COOKIE_SECRET`
- Database migrations fail closed during container startup. Never add a
  fallback to `prisma db push`, `--accept-data-loss`, or automatic reset.
- Production seeding is disabled by default. Set `RUN_SEED_ON_STARTUP=true`
  only for an intentional initial seed; never enable it during a normal
  production deployment.
- **Rebuild & deploy:**
  ```bash
  cd /var/www/kpi-dashboard
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kpi_quest_v3 npx prisma generate
  npm run build
  docker build -t jimdhope/kpi-dashboard:latest .
  docker push jimdhope/kpi-dashboard:latest
  docker compose -p migration-bundle -f /home/ubuntu/migration-bundle/docker-compose.yml pull
  docker compose -p migration-bundle -f /home/ubuntu/migration-bundle/docker-compose.yml up -d
  ```
- **Fast build (skip npm install):**
  ```bash
  # Temporarily remove node_modules/.next from .dockerignore, then:
  docker build -t jimdhope/kpi-dashboard:latest -f Dockerfile.fast .
  ```
  Fast images are a local/deployment optimisation and must receive the same
  migration and smoke-test validation as the standard image.

## Important Conventions

### Routes
- Route groups in `src/app/`: `(app)`, `(admin)`, `(agent)`, `(public)`, `(auth)`
- API routes in `src/app/api/`
- Pages use React Server Components by default, add `'use client'` for client components
- Keep `'use client'` boundaries as narrow as possible. Fetch database data
  directly from server-side services in Server Components rather than calling
  the app's own Route Handlers.

### UI Components
- UI components in `src/components/ui/`
- Use `Card`, `Button`, `Input`, `Select`, `Dialog` from shadcn-ui
- Glass card styling: `glass-card` class with frosted glass effect
- Use `useToast` hook for notifications

### Authentication
- Next.js 16 Proxy entry point: `src/proxy.ts`
- Auth service at `src/server/services/auth-service.ts`
- Proxy is for fast, optimistic request checks and redirects. Do not treat it
  as the definitive authorization layer or add slow/unbounded data fetching.
- Every Route Handler, Server Action, and service mutation must independently
  authenticate the caller and enforce role, ownership, and resource access.
- Treat Server Actions and Route Handlers as public request boundaries:
  validate all client-controlled input at runtime (prefer Zod), return only the
  fields required by the UI, and never rely on TypeScript types for validation.
- Keep database, session, secrets, and privileged business logic in
  server-only repositories/services. Add `import "server-only"` where a module
  must never enter a client bundle.

### Database Operations
- Use Prisma client from `src/server/db/client`
- Prisma client generated with: `DATABASE_URL=... npx prisma generate`
- For schema changes, update `prisma/schema.prisma`, create and commit a Prisma
  migration, then validate and generate the client. Production uses
  `prisma migrate deploy`.
- Never use `prisma db push --accept-data-loss`, reset, or destructive migration
  commands against production.

### Select Components
- **Important:** Never use empty string `""` as a SelectItem value - causes runtime error
- Use sentinel values like `"all"` or `"none"` instead
- When clearing selection, convert to empty string in onValueChange handler

### Custom Properties for Nav Items
- Nav items support `openInNewTab?: boolean` to open in new tab
- Used in `app-navbar.tsx` and `nav-dropdown.tsx`

## Common Tasks

### Rebuild After Changes
```bash
cd /var/www/kpi-dashboard
npm run build
systemctl restart kpi-dashboard
```

### Database Changes
```bash
# After schema.prisma changes
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kpi_quest_v3 npx prisma generate
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kpi_quest_v3 npx prisma migrate dev --name <descriptive_name>
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kpi_quest_v3 npx prisma validate
npm run typecheck
npm run build
```

Review the generated SQL before committing it. Apply committed migrations in
production with `prisma migrate deploy` through the container entrypoint.

### Default Admin
- Email: `admin@kpi-quest.local`
- Password is supplied through `SEED_ADMIN_PASSWORD` for an intentional local
  or initial seed. Do not document or rely on a production default password.

## Known Pages
- Dashboard: `/dashboard`
- Directory: `/directory`
- Knowledge Base: `/knowledge-base`
- Competitions: `/competitions`
- Performance: `/performance`
- Settings: `/settings/general`

## Required Validation

Before handing off application changes, run checks proportional to the change.
For framework, authentication, database, dependency, or deployment changes,
the minimum is:

```bash
npm run typecheck
npm run build
npm audit --omit=dev
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kpi_quest_v3 npx prisma validate
```

Also verify affected permissions and user roles, confirm migrations against
local test data, and smoke-test the standard production Docker image when
Docker or deployment files change. Do not mutate or scan production without
separate permission.

## Tiptap Editor
- Rich text editor component at `src/components/kb/tiptap-editor.tsx`
- Custom styles in `globals.css` under `.tiptap-editor` class
