# KPI Quest — Gamification Implementation Plan

## Overview

Gamification is **competitions-only**. All XP, levels, streaks, badges, and leaderboards derive solely from competition performance. No other app features feed into it.

### Core Principles

- **XP = competition points + rank bonuses** — the existing `DailyAchievement.points` system is the XP source
- **Evaluation runs at competition end** — no real-time gamification logic
- **SVG → PNG badge pipeline** — same pattern as certificates: user-designed SVG templates with `{{VARIABLES}}` → rendered to PNG on download
- **Monthly/yearly leaderboards** — calendar-based, competition scores only, auto-badge + admin manual celebration
- **Badges are cosmetic** — recognition only, no XP attached
- **No weekly KPI badges** — dropped from scope

---

## Phase 1: Database + Backend Services + Evaluation API

### 1.1 Prisma Schema Additions

Add to `prisma/schema.prisma`:

```prisma
// ──────────────────────────────────────────────
// Gamification Models
// ──────────────────────────────────────────────

model AgentProfile {
  id        String   @id @default(cuid())
  userId    String   @unique
  totalXp   Int      @default(0)
  level     Int      @default(1)
  title     String?  // "Rookie" | "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  badges    AgentBadge[]
  results   CompetitionResult[]
  streaks   Streak[]
}

model Badge {
  id          String   @id @default(cuid())
  key         String   @unique  // e.g. "first_win", "monthly_champion"
  name        String            // "First Blood", "Monthly Champion"
  description String
  icon        String            // Lucide icon name for UI display
    category    String            // "competition" | "streak" | "monthly"
  svgPath     String?           // "badges/templates/first_win.svg"
  criteria    Json              // Badge evaluation rules
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  agents      AgentBadge[]
}

model AgentBadge {
  id             String       @id @default(cuid())
  agentProfileId String
  badgeId        String
  context        Json?        // { competitionId?, rank?, week?, month?, year?, ruleName? }
  earnedAt       DateTime     @default(now())

  agentProfile   AgentProfile @relation(fields: [agentProfileId], references: [id], onDelete: Cascade)
  badge          Badge        @relation(fields: [badgeId], references: [id], onDelete: Cascade)

  @@unique([agentProfileId, badgeId])
  @@index([earnedAt])
}

model CompetitionResult {
  id             String       @id @default(cuid())
  agentProfileId String
  competitionId  String
  rank           Int
  totalScore     Int
  xpEarned       Int          // totalScore + rank bonus
  wasPresent     Boolean      @default(true)
  createdAt      DateTime     @default(now())

  agentProfile   AgentProfile @relation(fields: [agentProfileId], references: [id], onDelete: Cascade)

  @@unique([agentProfileId, competitionId])
  @@index([agentProfileId])
  @@index([competitionId])
  @@index([xpEarned])
}

model Streak {
  id             String       @id @default(cuid())
  agentProfileId String
  type           String       // "win" | "podium"
  currentCount   Int          @default(0)
  longestCount   Int          @default(0)
  lastDate       DateTime?
  updatedAt      DateTime     @updatedAt

  agentProfile   AgentProfile @relation(fields: [agentProfileId], references: [id], onDelete: Cascade)

  @@unique([agentProfileId, type])
}

model XpTransaction {
  id          String   @id @default(cuid())
  userId      String
  amount      Int
  source      String   // "competition_score" | "rank_bonus"
  sourceId    String?  // competitionId
  description String?
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([createdAt])
}
```

### 1.2 Level Thresholds

```typescript
const LEVEL_THRESHOLDS = [
  { minXp: 0,      title: "Rookie" },
  { minXp: 500,    title: "Bronze" },
  { minXp: 1_500,  title: "Silver" },
  { minXp: 3_500,  title: "Gold" },
  { minXp: 7_000,  title: "Platinum" },
  { minXp: 12_000, title: "Diamond" },
];
```

### 1.3 Rank Bonus XP

| Rank | Bonus XP |
|---|---|
| 1st | +100 |
| 2nd | +50 |
| 3rd | +25 |

### 1.4 Services

#### `src/server/services/gamification-service.ts`

Core evaluation engine. Single entry point:

```typescript
evaluateCompetitionEnd(competitionId: string): Promise<EvaluationSummary>
```

Steps:
1. Load competition with rules, teams, DailyAchievements
2. Aggregate DailyAchievement per agent → compute totalScore per agent
3. Assign dense ranks
4. Create `CompetitionResult` for each participant
5. Compute xpEarned = totalScore + rankBonus
6. Create `XpTransaction` for each: one `competition_score`, one `rank_bonus`
7. Load/create `AgentProfile` for each agent → update totalXp + recalculate level/title
8. Update `Streak` records (win/podium)
9. Evaluate badge criteria → award new badges via `badge-service.ts`
10. Log activities for badge earns, level-ups
11. Return summary

Additional methods:
- `getAgentProfile(userId)` — full profile with badges, streaks, results
- `getAllTimeLeaderboard(podId?)` — ranked by AgentProfile.totalXp
- `getMonthlyLeaderboard(year, month)` — XpTransaction aggregation
- `getYearlyLeaderboard(year)` — XpTransaction aggregation
- `retroactivelyEvaluateAll()` — process all past completed competitions

#### `src/server/services/badge-service.ts`

Badge evaluation logic:

```typescript
checkAndAwardBadges(agentProfileId: string, competitionResult: CompetitionResult): Promise<AwardedBadge[]>
```

Badge criteria (hardcoded in TypeScript):

| Badge Key | Criteria |
|---|---|
| `first_win` | `competitionResult.rank === 1 && !hasBadge(agent, 'first_win')` |
| `podium` | `competitionResult.rank <= 3` |
| `veteran` | `countResults(agent) >= 10` |
| `comeback_kid` | `rank improved >= 5 from previous result` |
| `score_machine` | `totalScore > highest ever in system` |
| `perfect_attendance` | `wasPresent === true (all days logged)` |
| `team_winner` | `on winning team` |
| `three_peat` | `streak('win').currentCount === 3` |
| `streak_3` | `streak('win').currentCount >= 3` |
| `streak_5` | `streak('win').currentCount >= 5` |
| `streak_10` | `streak('win').currentCount >= 10` |
| `monthly_champion` | `rank === 1 in a given month` (from monthly eval) |
| `monthly_top3` | `rank <= 3 in a given month` |
| `yearly_champion` | `rank === 1 in a given year` |

#### `src/server/services/badge-image-service.ts`

SVG → PNG rendering:

```typescript
generateBadgeImage(params: {
  badgeKey: string;
  agentName: string;
  variables: Record<string, string>;
}): Promise<Buffer>

generateBatchZip(entries: BadgeDownloadEntry[]): Promise<Buffer>
```

Pipeline:
1. Read SVG template from `public/badges/templates/<badgeKey>.svg`
2. Replace all `{{VARIABLE}}` placeholders with actual values
3. Render SVG to PNG buffer via `@resvg/resvg-js`
4. Return PNG buffer for download, or accumulate in JSZip for batch

### 1.5 Seed Data

**`prisma/seed/badges.ts`** — badge catalog seed:

```typescript
const BADGES: BadgeSeed[] = [
  { key: "first_win",         name: "First Blood",           category: "competition", svgPath: "badges/templates/first_win.svg" },
  { key: "podium",            name: "Podium Finish",         category: "competition", svgPath: "badges/templates/podium.svg" },
  { key: "veteran",           name: "Veteran",               category: "competition", svgPath: "badges/templates/veteran.svg" },
  { key: "comeback_kid",      name: "Comeback Kid",          category: "competition", svgPath: "badges/templates/comeback_kid.svg" },
  { key: "score_machine",     name: "Score Machine",         category: "competition", svgPath: "badges/templates/score_machine.svg" },
  { key: "perfect_attendance",name: "Iron Will",             category: "competition", svgPath: "badges/templates/perfect_attendance.svg" },
  { key: "team_winner",       name: "Team Player",           category: "competition", svgPath: "badges/templates/team_winner.svg" },
  { key: "three_peat",        name: "Three-Peat",            category: "streak",      svgPath: "badges/templates/three_peat.svg" },
  { key: "streak_3",          name: "On Fire",               category: "streak",      svgPath: "badges/templates/streak_3.svg" },
  { key: "streak_5",          name: "Unstoppable",           category: "streak",      svgPath: "badges/templates/streak_5.svg" },
  { key: "streak_10",         name: "Legendary",             category: "streak",      svgPath: "badges/templates/streak_10.svg" },
  { key: "monthly_champion",  name: "Monthly Champion",      category: "monthly",     svgPath: "badges/templates/monthly_champion.svg" },
  { key: "monthly_top3",      name: "Monthly All-Star",      category: "monthly",     svgPath: "badges/templates/monthly_top3.svg" },
  { key: "yearly_champion",   name: "Year-End Champion",     category: "monthly",     svgPath: "badges/templates/yearly_champion.svg" },

];
```

### 1.6 API Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/gamification/profile` | Current user's XP, level, title, badges, streaks |
| GET | `/api/gamification/leaderboard` | All-time XP leaderboard (optional podId) |
| GET | `/api/gamification/leaderboard/monthly?year=&month=` | Monthly competition leaderboard |
| GET | `/api/gamification/leaderboard/yearly?year=` | Yearly competition leaderboard |
| GET | `/api/gamification/badges` | Current user's earned badges |
| GET | `/api/gamification/badges/catalog` | All badges (earned/locked for current user) |
| GET | `/api/gamification/history` | Competition results + XpTransaction timeline |
| POST | `/api/gamification/evaluate` | Admin: evaluate a specific competition |
| POST | `/api/gamification/crown-monthly` | Admin: crown monthly champion |
| GET | `/api/gamification/badges/[badgeKey]/image` | Download badge PNG |

### 1.7 Retroactive Evaluation Script

`scripts/evaluate-all-gamification.ts`:

```typescript
// 1. Find all non-draft competitions where endsAt < now()
// 2. Sort by endsAt ascending
// 3. For each: run evaluateCompetitionEnd()
// 4. Report summary
```

Run via: `npx tsx scripts/evaluate-all-gamification.ts`

### 1.8 New Dependencies

```bash
npm install @resvg/resvg-js
```

---

## Phase 2: Admin Gamification Views

### 2.1 Additional API Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/gamification/admin/stats` | System-wide gamification stats |
| GET | `/api/gamification/admin/agents` | Paginated agent profiles search |
| GET | `/api/gamification/admin/badges/[badgeKey]/agents` | Who earned a specific badge |

### 2.2 Admin Pages (under `(app)/competitions/gamification/`)

#### Overview Dashboard

Route: `/competitions/gamification`

- Total badges awarded, active agents, competitions evaluated
- Recent badge awards (activity feed filtered to badge_earned)
- Top 5 all-time leaderboard preview
- Quick actions: evaluate pending competitions, crown monthly champ

#### All-Time Leaderboard

Route: `/competitions/gamification/leaderboard`

- Paginated table: rank, agent name, level/title, total XP, competitions completed, best rank, badges count
- Filter by pod
- Click agent → side panel or drill-in to agent profile

#### Monthly/Yearly Leaderboard

Route: `/competitions/gamification/leaderboard/monthly`
Route: `/competitions/gamification/leaderboard/yearly`

- Month/year picker (dropdowns)
- Table: rank, agent name, XP earned that month, competitions completed, badges earned
- Top 3 highlighted with medal icons
- "Crown Champion" button → awards `monthly_champion` badge + Teams post
- "Download Badges" button → ZIP of badge PNGs for top 3

#### Badge Catalog

Route: `/competitions/gamification/badges`

- Grid of all badges with name, description, category, earn count
- Click badge → see who earned it (agent list with dates)
- Earned/locked status for current month

#### Agent Profile

Route: `/competitions/gamification/agents/[id]`

- XP, level, title, progress to next level
- Badge collection (grid)
- Streak cards (win, podium)
- Competition history table
- XP timeline chart

#### Configuration

Route: `/competitions/gamification/config`

- Level threshold editing
- Rank bonus amounts
- Badge activation toggles

### 2.3 Badge Download Page

Route: `/competitions/badges`

- Select competition + pod (same pattern as certificates page)
- Displays "Badges Earned This Week" section
- Each badge shows: agent name, badge name, preview (SVG→PNG)
- Checkboxes to select individual badges
- "Download Selected" → ZIP of badge PNGs
- "Download All" → ZIP of all badges for that period

### 2.4 Certificate Page Integration

Modify `/competitions/certificates/page.tsx`:

- After generating certificates, query badges earned during that competition's date range
- New section: "Badges Earned This Week"
- Checkbox: "Also include badges in ZIP"
- When checked, badge PNGs added to ZIP in `badges/` subfolder

---

## Phase 3: Agent Gamification UI

### 3.1 Trophy UI Kit Components

```bash
npx shadcn@latest add https://ui.trophy.so/points-badge
npx shadcn@latest add https://ui.trophy.so/points-levels-timeline
npx shadcn@latest add https://ui.trophy.so/achievement-badge
npx shadcn@latest add https://ui.trophy.so/achievement-grid
npx shadcn@latest add https://ui.trophy.so/streak-card
npx shadcn@latest add https://ui.trophy.so/streak-calendar
npx shadcn@latest add https://ui.trophy.so/leaderboard-rankings
npx shadcn@latest add https://ui.trophy.so/leaderboard-podium
```

### 3.2 Agent Dashboard Enhancements

Modify `src/app/(agent)/agent/page.tsx`:

- XP bar with level + title (Trophy `PointsBadge`)
- Active win streak card (Trophy `StreakCard`)
- Latest badge earned (Trophy `AchievementBadge`)

### 3.3 Agent Competitions Page

Modify `src/app/(agent)/agent/competitions/page.tsx`:

- "My Competition History" — line chart of rank vs. competition over last N
- Uses recharts (already a dependency)

### 3.4 Agent Gamification Page (new)

Route: `/agent/gamification`

**Profile Header:** XP total, level, title, progress bar (Trophy `PointsLevelsTimeline`)

**Badge Gallery:** Trophy `AchievementGrid` — earned badges + locked silhouettes with tooltips

**Streaks Card:** Win streak + all-time best (Trophy `StreakCard`), podium streak

**Leaderboards:** Current month podium (Trophy `LeaderboardPodium`), full rankings (Trophy `LeaderboardRankings`), year picker

**Competition History:** Table with competition name, rank, score, XP earned, badges

---

## SVG Template Format

Badge SVGs use `{{VARIABLE}}` placeholders. Example structure:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
  <defs>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFD700"/>
      <stop offset="100%" stop-color="#DAA520"/>
    </linearGradient>
  </defs>
  <path d="M150 30 L270 100 L270 250 L150 370 L30 250 L30 100 Z"
        fill="url(#gold)" stroke="#B8860B" stroke-width="4"/>
  <rect x="50" y="290" width="200" height="30" rx="5" fill="#8B0000"/>
  <text x="150" y="315" text-anchor="middle" font-family="Georgia" font-size="16"
        fill="white" font-weight="bold">{{AGENT_NAME}}</text>
  <text x="150" y="110" text-anchor="middle" font-family="Arial" font-size="64"
        fill="#4A0000" font-weight="bold">{{WEEK_COUNT}}</text>
  <text x="150" y="150" text-anchor="middle" font-family="Georgia" font-size="14"
        fill="#4A0000">weeks at #1</text>
  <text x="150" y="270" text-anchor="middle" font-family="Georgia" font-size="12"
        fill="#666">{{COMPETITION_NAME}}</text>
</svg>
```

### Variable Availability by Badge

| Badge | Variables |
|---|---|
| `first_win` | `{{AGENT_NAME}}`, `{{COMPETITION_NAME}}`, `{{RANK}}`, `{{DATE}}` |
| `podium` | `{{AGENT_NAME}}`, `{{COMPETITION_NAME}}`, `{{RANK}}`, `{{DATE}}` |
| `veteran` | `{{AGENT_NAME}}`, `{{COMPETITION_COUNT}}`, `{{DATE}}` |
| `comeback_kid` | `{{AGENT_NAME}}`, `{{COMPETITION_NAME}}`, `{{RANK_IMPROVEMENT}}` |
| `score_machine` | `{{AGENT_NAME}}`, `{{SCORE}}`, `{{COMPETITION_NAME}}` |
| `perfect_attendance` | `{{AGENT_NAME}}`, `{{COMPETITION_NAME}}`, `{{DATE}}` |
| `team_winner` | `{{AGENT_NAME}}`, `{{TEAM_NAME}}`, `{{COMPETITION_NAME}}` |
| `three_peat` | `{{AGENT_NAME}}`, `{{STREAK_COUNT}}`, `{{DATE}}` |
| `streak_3` / `_5` / `_10` | `{{AGENT_NAME}}`, `{{STREAK_COUNT}}` |
| `monthly_champion` | `{{AGENT_NAME}}`, `{{MONTH}}`, `{{YEAR}}` |
| `monthly_top3` | `{{AGENT_NAME}}`, `{{MONTH}}`, `{{YEAR}}`, `{{RANK}}` |
| `yearly_champion` | `{{AGENT_NAME}}`, `{{YEAR}}` |

---

## SVG Template Directory

```
public/badges/templates/
  first_win.svg
  podium.svg
  veteran.svg
  comeback_kid.svg
  score_machine.svg
  perfect_attendance.svg
  team_winner.svg
  three_peat.svg
  streak_3.svg
  streak_5.svg
  streak_10.svg
  monthly_champion.svg
  monthly_top3.svg
  yearly_champion.svg
```

The user creates these SVGs. Each maps to a `Badge` record via `svgPath`.

---

## Phase Plan Summary

| Phase | Scope | New Files | Modified Files |
|---|---|---|---|
| **1** | Prisma models + gamification-service + badge-service + badge-image-service + evaluation API + retroactive script + seed | ~18 | 1 (schema.prisma) |
| **2** | Admin gamification pages + badge download page + cert page integration | ~7 | 1 (certificates page) |
| **3** | Agent gamification page + dashboard/competitions page enhancements | ~5 | 2 (dashboard, competitions) |
