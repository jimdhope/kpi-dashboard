# KPI Quest - AI Agent Documentation

## Project Overview
- **Name:** KPI Quest
- **Version:** 3.5.1
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