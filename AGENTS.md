# KPI Quest - AI Agent Documentation

## Project Overview
- **Name:** KPI Quest
- **Version:** 3.5.2
- **Stack:** Next.js 16, React, TypeScript, Tailwind CSS, Prisma, PostgreSQL
- **Location:** `/var/www/kpi-dashboard`
- **Port:** 9103

## Developer Commands

```bash
npm run dev      # Start dev server (port 9103)
npm run build   # Production build
npm run start   # Start production server
npm run typecheck  # Type check only (no lint)
npm run db:generate  # Generate Prisma client
npm run db:push     # Push schema to DB
npm run db:seed     # Seed database
npm run db:import   # Import from Firebase
npm run jobs:work   # Run background worker
```

**Note:** No lint script exists - run `typecheck` for validation.

## Key Configuration

### Database
- PostgreSQL at `localhost:5432`
- Database name: `kpi_quest_v3`
- User: `postgres` / Password: `postgres`
- Prisma schema: `prisma/schema.prisma`

### Session
- Cookie name: `kpiq_v3_session`
- Secret in `.env.local`

### Service
- Systemd service: `kpi-dashboard`
- Restart: `systemctl restart kpi-dashboard`

## Important Conventions

### Routes
- Route groups in `src/app/`: `(app)`, `(admin)`, `(agent)`, `(public)`, `(auth)`
- API routes in `src/app/api/`
- Pages use React Server Components by default, add `'use client'` for client components

### UI Components
- UI components in `src/components/ui/`
- Use `Card`, `Button`, `Input`, `Select`, `Dialog` from shadcn-ui
- Glass card styling: `glass-card` class with frosted glass effect
- Use `useToast` hook for notifications

### Authentication
- Middleware in `src/middleware.ts` checks `kpiq_v3_session` cookie
- Auth service at `src/server/services/auth-service.ts`

### Database Operations
- Use Prisma client from `src/server/db/client`
- Prisma client generated with: `DATABASE_URL=... npx prisma generate`

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
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kpi_quest_v3 npx prisma db push
```

### Default Admin
- Email: `admin@kpi-quest.local`
- Password: `admin123!` (set via `SEED_ADMIN_PASSWORD` env var in seed)

## Known Pages
- Dashboard: `/dashboard`
- Directory: `/directory`
- Knowledge Base: `/knowledge-base`
- Competitions: `/competitions`
- Trackers: `/trackers`
- Performance: `/performance`
- Settings: `/settings/general`

## Tiptap Editor
- Rich text editor component at `src/components/kb/tiptap-editor.tsx`
- Custom styles in `globals.css` under `.tiptap-editor` class

## Session Planning (2026-06-28)

### Implementation Backlog (Phased)

#### Phase 0 — Auth & Onboarding (START HERE)
```
1. npm install nodemailer @types/nodemailer
2. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, PUBLIC_URL to .env.local
3. Create src/server/services/email-service.ts (Nodemailer)
4. Create src/server/repositories/password-reset-repository.ts
5. Add forgot/reset/change-password methods to auth-service.ts
6. Create POST /api/auth/password  (change password while logged in)
7. Create POST /api/auth/forgot-password
8. Create POST /api/auth/reset-password
9. Create src/app/reset-password/page.tsx (token param, new password form)
10. Create src/middleware.ts (check kpiq_v3_session cookie, redirect if missing)
```

#### Phase 1 — Legacy Route Cleanup
```
1. Delete src/app/competitions/ (empty dirs + orphaned competitions-log-form.tsx)
2. Remove flat teams routes: settings/teams-webhooks, settings/teams-automations, settings/teams-scheduled
3. Create /settings/teams/scheduled page (fix broken nav link)
4. Add /settings/teams/workflows to settings nav
5. Delete empty (auth)/layout.tsx if unused
```

#### Phase 2 — In-App Notifications
```
1. Create src/server/repositories/notification-repository.ts
2. Create src/server/services/notification-service.ts (CRUD, unread count)
3. Create GET /api/notifications, POST /api/notifications/[id]/read, POST /api/notifications/read-all
4. Create src/components/notification-bell.tsx (unread badge + dropdown)
5. Wire NotificationBell into app-navbar.tsx and the agent layout/navbar
6. Wire notification creation into gamification-service events (badge_earned, level_up, streak_milestone, etc.)
7. Remove placeholder "Notifications" from breadcrumbs.tsx if applicable
```

#### Phase 3 — Gamification Implementation
- Follow GAMIFICATION_PLAN.md (Prisma models → services → admin UI → agent UI)
- Install @resvg/resvg-js for SVG→PNG badge rendering
- Event → notification wiring happens here

#### Phase 4 — Public Docs Pages
- Create (public)/docs/ with admin guide, agent guide, and API reference

### Known Issues & Gaps
| Issue | Severity |
|---|---|
| `/api/auth/password` doesn't exist (profile page calls it) | HIGH |
| `/api/auth/forgot-password` doesn't exist (forgot page calls it) | HIGH |
| No `/reset-password` page or API | HIGH |
| No `src/middleware.ts` (referenced in AGENTS.md but missing) | HIGH |
| `/settings/teams/scheduled` in nav returns 404 | HIGH |
| `src/app/competitions/` is empty (no page.tsx, orphaned component) | MEDIUM |
| Duplicate teams routes (flat + nested) | MEDIUM |
| No notification bell/dropdown in either navbar | MEDIUM |
| `(auth)/layout.tsx` has no pages inside it | LOW |
| `/settings/teams/workflows` exists but not in nav | LOW |
| No email service for password reset | HIGH (blocker) |