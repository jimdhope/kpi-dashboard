# Developer & Technical Reference

Welcome to the **KPI Quest Developer and Technical Reference**. This document provides a comprehensive technical breakdown of KPI Quest (v3.5.2) to assist engineers in maintaining, debugging, extending, and deploying the platform.

---

## 🛠️ Technology Stack & Architecture

KPI Quest is built upon a high-performance, modern React and Node.js ecosystem designed for real-time responsiveness and data isolation.

```
┌────────────────────────────────────────────────────────┐
│               Next.js App Router (v16)                 │
│      React 19 Server Components & Client Hydration     │
└───────────────────────────┬────────────────────────────┘
                            │  Custom Cookie Auth
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Service Layer                        │
│     Stateless Business Modules & Domain Logic          │
└───────────────────────────┬────────────────────────────┘
                            │  ORM / Database Queries
                            ▼
┌────────────────────────────────────────────────────────┐
│             Prisma ORM (v7) / PostgreSQL               │
└────────────────────────────────────────────────────────┘
```

* **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide icons, Recharts (for dashboards & performance tracking graphs), Tiptap editor suite.
* **Backend:** Next.js Server Components, API routes (`/api/...`), and Server Actions for mutation requests.
* **Database & ORM:** Prisma ORM with a PostgreSQL relational database.
* **Asynchronous Tasks:** Queue processing and automated scheduler via `pg-boss` (utilizing native PostgreSQL queues) powered by a lightweight TSX background worker.
* **Image Synthesis:** `@vercel/og` engine producing visual card leaderboards using dynamic JSX components.

---

## 📂 Codebase Directory Layout

Here is a map of the file hierarchy:

```
kpi-dashboard/
├── .db-dump/                   # Staging or development database dumps
├── docs/                       # Project documentation
├── prisma/
│   ├── schema.prisma           # Core relational schema definitions
│   └── seed.ts                 # Role and administrator seed definitions
├── public/                     # Static media, icons, manifest, and service-worker
├── scripts/                    # Maintenance and CLI administration utilities
└── src/
    ├── app/                    # Next.js App Router
    │   ├── (admin)/            # Route Group: Admin, gamification, and configuration
    │   ├── (agent)/            # Route Group: Specialized agent landing & gamification
    │   ├── (app)/              # Route Group: General platform (directory, tools, KB)
    │   ├── (auth)/             # Route Group: Authentication layouts
    │   ├── (public)/           # Route Group: Public unauthenticated directories/pods
    │   ├── api/                # Next.js API Routes (JSON endpoints)
    │   ├── globals.css         # Main styles and Tiptap custom definitions
    │   └── layout.tsx          # Root HTML frame
    ├── components/             # React visual components (admin, activity, tools, ui)
    ├── hooks/                  # Custom shared React hooks (toast notifications)
    ├── lib/                    # Shared TypeScript contracts, helpers, and utilities
    └── server/                 # Dedicated Server Layer
        ├── auth/               # Session encryption, cookie creation, passwords
        ├── jobs/               # Background task workers (pg-boss scheduling)
        ├── repositories/       # Data Access Object pattern wrapping Prisma queries
        └── services/           # Business domain managers (stateless service layer)
```

---

## 🔐 Session Authentication & Access Control (RBAC)

KPI Quest implements a custom, secure cookie-based session verification engine rather than heavy external OAuth clients.

### 1. Verification Flow
1. The client sends a login request to `/api/auth/login`.
2. The server verifies password hashes (`bcryptjs`) against the database record, generates an unguessable high-entropy `sessionToken`, and saves its SHA-256 hash in the `Session` table.
3. The server sets a secure, HTTP-only cookie containing the token: `kpiq_v3_session`.
4. On subsequent requests, Server Components and API Routes extract the cookie and query `authService.getCurrentSession()` to verify validity, checking `expiresAt` directly inside the database.

### 2. Guarding Pages & API Endpoints
Security checks are implemented using stateless authorization guards located at `src/server/services/authorization.ts`:
* **`requireAdminUser()`**: Confirms the authenticated user holds the `"admin"` role, throwing an exception if unauthorized.
* **`requireCompetitionEditor()`**: Confirms roles match either `"admin"`, `"campaignManager"`, `"podManager"`, `"teamLeader"`, or `"competitionRunner"`.

**Example Page Guard:**
```typescript
import { authService } from "@/server/services/auth-service";
import { requireAdminUser } from "@/server/services/authorization";

export default async function AdminPage() {
  // Ensure user is authenticated and is an admin
  const user = await requireAdminUser();

  return (
    <div>Welcome {user.name} to the Control Room!</div>
  );
}
```

---

## 🗄️ Detailed Database Model Analysis

Our Prisma model schema (`prisma/schema.prisma`) represents a multi-tenant layout isolating Campaigns and Pods.

### Crucial Relational Subsystems:
* **User (`User`):** Holds accounts, optional Firebase reference hashes, XP gamification points, and password metrics. Linked to role arrays via joint-table `UserRole` mapping to the `Role` master.
* **Campaign & Pod (`Campaign`, `Pod`, `PodMembership`):** Core organizational hierarchy. Users join a `Pod` via `PodMembership` records, which links to a specific `Campaign`. Webhooks can be mapped on the Campaign or Pod levels to narrow automated scopes.
* **Trackers (`TrackerKpi`, `TrackerLog`):** Ongoing numeric logs recorded by agents or webhook payloads. Logs store the raw numeric `value` and reference a `userId`.
* **Competitions (`Competition`, `CompetitionRule`, `CompetitionEntry`, `CompetitionResult`):** Holds point systems, rule definitions, and live participant entries. Results represent finalized statistics, assigning experience points (XP) and podium placements.
* **Teams Automation (`TeamsWebhookEndpoint`, `TeamsAutomation`, `TeamsMessageTemplate`):** Outbound message orchestration system. Webhooks represent API channels; templates host JSON patterns for message cards or adaptive structures; automations link triggers (like `competitionScoreLogged`) to outbound deliveries.
* **Knowledge Base & Directory (`KBArticle`, `KBCategory`, `KBVersion`, `KBComment`, `Contact`, `Company`, `Tag`):** Internal documents. Rich text editor content is saved as JSON configurations representing standard Tiptap schema objects.

---

## 🧩 Services Layer Architecture

To prevent API and page files from bloating, KPI Quest isolates database operations and formatting into a **stateless services layer** (`src/server/services/`).

### Core Service Modules:
- **`authService`:** Cookie management, token hashing, logging in/out, changing passwords, and generating secure links.
- **`competitionService`:** Manages starting competitions, verifying dates, capturing entries, adding rule templates, and generating PDF/Web certificates.
- **`teamsAutomationService`:** Message parsing, filling out card templates with variables, handling batch window queueing, and pushing payloads to Teams.
- **`gamificationService`:** Evaluates accomplishments, calculates XP thresholds, awards levels, and grants agent profile badges.
- **`backupService`:** Compiles the database into a unified JSON structure, cleans target entities, and executes restores safely.

---

## 📈 MS Teams Inbound/Outbound Automation Engine

The Microsoft Teams integration manages both inbound scoring and outbound event reporting.

### 1. Inbound Hashtag Scoring Workflow
```
[User Types "#Smart" in Teams Channel]
                     │
                     ▼
  [Forwarded to Inbound Webhook API Route]
    - `/api/integrations/teams`
                     │
                     ▼
  [Parsed by `ScoreTargetService`]
    - Matches hashtag to registered target
    - Resolves active Competition Rule or Tracker ID
                     │
                     ▼
  [Score / Performance Record Logged]
    - Increments agent score inside the DB
    - Triggers live scoreboard update
```

### 2. Dynamic Image Generation
Outbound notifications can embed dynamically generated leaderboard charts.
* Endpoint: `/api/render/teams-image` or `/api/render/kpi-card`.
* Uses Next.js OpenGraph image engine (`next/og`).
* Returns an optimized PNG synthesized on-the-fly from SVG graphics.
* Supported parameters: `title`, `subtitle`, `metric`, `footer`, and custom hexadecimal `accent` colors.

---

## 🕒 Background Workers & Scheduled Jobs

KPI Quest utilizes `pg-boss` (a high-performance PostgreSQL job queue) to handle asynchronous operations.

### Worker Initialization (`src/server/jobs/worker.ts`)
The system starts a persistent listener thread wrapping:
- **`registerTeamsWebhookWorker`**: Pulls queued outgoing card payloads from the database and forwards them to Microsoft Teams.
- **`registerTeamsAutomationScheduleWorker`**: Manages scheduled recurring postings (e.g., posting daily summaries every evening).
- **`registerGamificationEvaluationWorker`**: Periodically audits daily Achievements to award badges and re-evaluate level placements.

---

## ⚙️ Developer Commands Reference

### Dependency Installation
Always install dependencies with peer conflict bypasses due to high React 19 dependencies:
```bash
npm install --legacy-peer-deps
```

### Configuration & Local Development
Copy the example environment parameters:
```bash
cp .env.example .env.local
```
Start the development server (runs on port `9103`):
```bash
npm run dev
```
In a separate terminal, launch the background task queue worker:
```bash
npm run jobs:work
```

### Database Operations
```bash
# Generate Prisma types based on schema changes
npm run db:generate

# Push schema directly to PostgreSQL database (local/dev setup)
npm run db:push

# Create migration files (production environments)
npm run db:migrate

# Seed standard user roles and admin login
npm run db:seed

# Access interactive database browser
npm run db:studio
```

### Building & Testing
Validate code integrity by verifying TypeScript compilation:
```bash
npm run typecheck
```
Verify production Next.js compilation:
```bash
npm run build
```
Start the production server:
```bash
npm run start
```
