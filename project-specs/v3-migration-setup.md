# V3 Migration Project Setup Specification

## Current Infrastructure
- **Framework**: Next.js 14.x (using App Router).
- **ORM**: Prisma 6.x.
- **Database**: PostgreSQL with standard relational schema (schema.prisma).
- **Authentication**: Custom session-based using cookies and `AppUser` model.
- **Roles**: Admin, CampaignManager, PodManager, TeamLeader, CompetitionRunner, Agent.

## Core Services
- **Teams Intergration**: Webhooks, Automations, Templates.
- **Resource Hierarchy**: Campaign -> Pod -> Member.
- **Data Capture**: Tracker Log, Competition Entry, Activity.

## Goal
Achieve full feature parity with the legacy V2 codebase in the v3 folder. Once at parity, data migration and final cut-over will occur.

## Key Constraints
- All work must be in the `v3/` directory.
- Use `src/lib/contracts.ts` for all shared types.
- Follow the repository/service layer pattern (e.g. `src/server/repositories`, `src/server/services`).
- Maintain RBAC permissions as defined in `src/server/services/authorization.ts`.
