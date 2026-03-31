# V3 Migration Task List
Project: KPI Quest V3 Migration
System: Next.js + PostgreSQL

## Phase 2: Feature Parity & Role Logic

### [] Task 2.1: Mini Games - RPS Porting
- **Agent**: Frontend Developer
- **Requirement**: Port the Rock Paper Scissors game from V2 (`v2/src/app/(app)/mini-games/rps/page.tsx`) to V3.
- **Goal**: Full parity for gameplay, UI, and integration with V3 auth/session.
- **Verification**: `npm run build` and UI visual proof.

### [] Task 2.2: Game Hub Creation
- **Agent**: Frontend Developer & ArchitectUX
- **Requirement**: Create a central destination in `src/app/games` for all V3 games.
- **Goal**: Clean UI that displays available games and connects to auth.

### [] Task 2.3: Activity Feed System - Enhanced
- **Agent**: Backend Architect
- **Requirement**: Implement the "Enhanced Activity Plan" in `v3/prisma/schema.prisma`. Add denormalized fields (`agentName`, `recorderName`, `richMessage`).
- **Goal**: Robust activity tracking with role-based visibility.

### [] Task 2.4: Agent Dashboard Refresh
- **Agent**: Frontend Developer
- **Requirement**: Build a streamlined dashboard for agents at `src/app/dashboard`.
- **Goal**: View active competitions and performance logs.

### [] Task 2.5: Manager & Lead Dashboards
- **Agent**: Frontend Developer
- **Requirement**: Build dashboards for Pod/Campaign managers.
- **Goal**: Feature parity with V2's manager-specific routes.

### [] Task 2.6: Permissions Middleware
- **Agent**: engineering-senior-developer
- **Requirement**: Finalize the middleware/logic restricting access to `/admin`, `/campaigns`, and manager subfolders.
- **Goal**: Secure RBAC system using `UserRole` from `AppUser`.

### [] Task 2.7: Notification Center
- **Agent**: Backend Architect
- **Requirement**: Implement a full notification system with an inbox at `/notifications`.
- **Goal**: Sync notification state with the `Notification` model in Prisma.

## Phase 3: Data Migration & Cut-over

### [] Task 3.1: Firebase Export Utility
- **Agent**: engineering-senior-developer
- **Requirement**: Create a script to extract all data from Firebase (Users, Activities, etc.) to JSON.

### [] Task 3.2: Prisma Import Utility
- **Agent**: engineering-senior-developer
- **Requirement**: Create a script to import JSON data into Postgres using Prisma.

### [] Task 3.3: Final Validation & Integration Testing
- **Agent**: testing-reality-checker
- **Requirement**: Cross-verify all data and features in a staging-like local build.
