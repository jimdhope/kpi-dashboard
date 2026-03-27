# KPI Quest V3

This folder contains the controlled V3 rebuild. The root app remains the legacy V2 reference; V3 develops here as an isolated Next.js monolith.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Start Postgres:

```bash
docker compose up -d
```

3. Install dependencies:

```bash
npm install
```

4. Generate the Prisma client and apply the schema:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

5. Run the app:

```bash
npm run dev
```

6. Run the background worker in a separate terminal when you want Teams outbound deliveries processed:

```bash
npm run jobs:work
```

The first milestone implemented here covers:

- app-owned login/logout/session handling
- current user/profile
- admin user management
- DB-backed notifications read path
- Prisma/Postgres foundation with repository and service layers

Current platform coverage also includes:

- campaigns, pods, memberships, trackers, performance logging, competitions, and reports
- central Teams incoming/outgoing webhook registry with campaign and pod assignment
- pg-boss-backed outbound Teams delivery for performance and competition events
- Teams automation center with inbound event capture and reusable automation rules
