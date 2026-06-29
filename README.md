# KPI Quest V3.5.2

A competition tracking and performance management application built with Next.js, Prisma, and PostgreSQL.

---

## What's New in V3.5.2

### Bug Fixes
- Fixed Teams daily scores card: emojis now display correctly (hybrid rule lookup)
- Fixed Teams standings to show cumulative competition totals
- Fixed agent score to display today's score (not cumulative) in the table
- Fixed emoji key legend showing competition rules (not mixed achievement data)
- Fixed daily targets showing effective target (daily × active days × agents)

### Bug Fixes (V3.5.1)
- Fixed competition creation not saving rules to database
- Fixed competition dashboard not showing stats for new competitions
- Fixed Reports page showing single day target instead of cumulative target
- Fixed competition draft saving with invalid campaign ID

### Features (V3.5)
- **Backup & Restore** - Export all data (competitions, trackers, KB, directory) as JSON, restore from backup, clear all data
- **MS Teams Webhook Hashtag Scoring** - Agents can post hashtags like #Smart in Teams to auto-log scores to competitions/trackers
- **Role-Based Dashboards** - Automatic redirect to appropriate dashboard based on role (admin, teamLeader, competitionRunner, agent)

---

## Prerequisites

- **Node.js** 20.x or higher
- **PostgreSQL** 14.x or higher
- **Linux server** (tested on Ubuntu) with systemd

---

## Server Setup (Native Installation)

This guide covers installing KPI Quest without Docker.

### 1. Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Create Database and User

```bash
# Create database
sudo -u postgres psql -c "CREATE DATABASE kpi_quest_v3;"

# Create user and grant privileges
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE kpi_quest_v3 TO postgres;"
sudo -u postgres psql -d kpi_quest_v3 -c "GRANT ALL ON SCHEMA public TO postgres;"
```

### 3. Clone the Repository

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/jimdhope/kpi-dashboard.git kpi-dashboard
cd kpi-dashboard
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Configure Environment

Copy `.env.example` to `.env.local` and update:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kpi_quest_v3
SESSION_COOKIE_SECRET=your-secret-key-change-in-production
APP_URL=http://localhost:9103
SEED_ADMIN_EMAIL=admin@kpiquest.local
SEED_ADMIN_PASSWORD=admin123!
ENCRYPTION_KEY=your-32-character-encryption-key
```

### 6. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

### 7. Create systemd Service

Create `/etc/systemd/system/kpi-dashboard.service`:

```ini
[Unit]
Description=KPI Quest Dashboard
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/kpi-dashboard
Environment="NODE_ENV=production"
Environment="PORT=9103"
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 8. Set Permissions and Start

```bash
# Set ownership
sudo chown -R www-data:www-data /var/www/kpi-dashboard
sudo chmod -R 755 /var/www/kpi-dashboard

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable kpi-dashboard
sudo systemctl start kpi-dashboard
```

### 9. Verify Installation

```bash
# Check service status
sudo systemctl status kpi-dashboard

# Test the application
curl http://localhost:9103
```

---

## First Login

After a fresh installation, use the default admin credentials:

- **Email:** admin@kpiquest.local
- **Password:** admin123!

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

**After import**, run the password reset script:

```bash
cd /var/www/kpi-dashboard
npx tsx scripts/reset-passwords.ts
```

---

## Useful Commands

```bash
# Restart the service
sudo systemctl restart kpi-dashboard

# View logs
sudo journalctl -u kpi-dashboard -f

# Stop the service
sudo systemctl stop kpi-dashboard
```

---

## Features

- **Directory** - Contact management with search, filters by type/company/department. Add contacts via modal with typed company, department, and comma-separated tags
- **Knowledge Base** - Article management with rich text editor (Tiptap), typed categories and tags, single-column browse view
- **Competitions** - Create weekly competitions with custom KPI rules and leaderboards
- **Performance Tracking** - Campaign-wide KPI tracking with real-time dashboards
- **Daily Trackers** - Log daily KPIs and track trends over time
- **Useful Tools** - Calculator tools for instalment plans, energy usage, meter readings, and more
- **Mini-Games** - Rock Paper Scissors game for team engagement
- **Pod Management** - Organize agents into teams with role-based access
- **Activity Logging** - Full audit trail of all system actions

---

## Tech Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** PostgreSQL
- **Authentication:** Custom session-based auth

---

## Development (Local)

If running locally for development:

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# (Optional) Run background worker
npm run jobs:work
```

The app will be available at `http://localhost:9103`
