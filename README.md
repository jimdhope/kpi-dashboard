# KPI Quest V3.2

A competition tracking and performance management application built with Next.js, Prisma, and PostgreSQL.

## Local Development Setup

### 1. Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Update the `.env.local` file with your database URL and other required environment variables.

### 2. Start Database

```bash
docker compose up -d
```

Or if using a managed PostgreSQL service, ensure your database is running and accessible.

### 3. Install Dependencies

```bash
npm install
```

### 4. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

### 5. Run the App

```bash
npm run dev
```

The app will be available at `http://localhost:9103` (or the port specified in your .env.local).

### 6. (Optional) Background Worker

Run the background worker in a separate terminal when you need Teams outbound deliveries processed:

```bash
npm run jobs:work
```

---

## First Login

After a fresh installation, use the default admin credentials:

- **Email:** admin@kpiquest.local
- **Password:** KPIQuest2024!

You will be prompted to change your password on first login.

---

## Data Import

To import data from your Firebase Firestore database:

1. Navigate to `/settings/data-import` in your browser
2. Upload your Firebase service account JSON file (download from Firebase Console → Project Settings → Service Accounts → Generate New Private Key)
3. Click "Import from Firebase"

The import will pull:
- Users (mapped from Firebase UIDs)
- Pods (linked to campaigns)
- Competitions (published status)
- Competition Rules
- Daily Achievements
- Tracker KPIs and Logs
- Pod Memberships

**After import**, run the password reset script to ensure all users must change their password on first login:

```bash
npx tsx scripts/reset-passwords.ts
```

---

## Docker Deployment

### Using Docker Compose (Recommended for Local Development)

```bash
# Build and start all services (PostgreSQL + App)
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

The app will be available at `http://localhost:9103`

### Using Docker Directly

```bash
# Build the image
docker build -t kpi-quest:latest .

# Run the container
docker run -d \
  --name kpi-quest \
  -p 9103:9103 \
  -e DATABASE_URL="postgresql://postgres:postgres@host:5432/kpi_quest_v3" \
  kpi-quest:latest
```

---

## Pull from GitHub Container Registry

On a new server, you can pull the pre-built image:

```bash
# Login to GHCR (if not already logged in)
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull the latest image
docker pull ghcr.io/jimdhope/kpi-dashboard/app:latest

# Run the container
docker run -d \
  --name kpi-quest \
  -p 9103:9103 \
  -e DATABASE_URL="postgresql://postgres:postgres@host:5432/kpi_quest_v3" \
  ghcr.io/jimdhope/kpi-dashboard/app:latest
```

---

## Features

- **Campaigns & Pods** - Organize agents into teams and campaigns
- **Competitions** - Create and run weekly competitions with custom rules
- **Daily Achievement Logging** - Track agent performance daily
- **Trackers** - KPI tracking with leaderboards
- **Teams Integration** - Send daily scores and notifications via Microsoft Teams
- **Activity Logging** - Full audit trail of all system actions

---

## Tech Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** PostgreSQL
- **Authentication:** Custom session-based auth
- **Notifications:** Microsoft Teams webhooks