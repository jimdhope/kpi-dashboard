# Activity Logging Audit Report - KPI Quest

**Audit Date:** April 1, 2026  
**Auditor:** Automated Code Analysis  
**Scope:** All application areas in `src/server/services/` and `src/server/actions/`

---

## Executive Summary

The Activity Logging system in KPI Quest has a solid foundation with 27 defined activity types across 6 categories. However, only **7 services** currently import and call `activityService`, with many activity types defined but never invoked.

**Key Findings:**
- ✅ **7 services** actively log activities
- ⚠️ **20 activity types** are defined but not being called  
- 🔴 **Multiple application areas** completely lack activity logging

---

## 1. Area-by-Area Status

### 1.1 Competitions

**Service Files Involved:**
- `src/server/services/competition-service.ts`
- `src/server/services/competition-entry-service.ts`

**Current Activity Logging:**
| Action | Method Called | Status |
|--------|---------------|--------|
| Join competition | `logCompetitionJoined` | ✅ Implemented |
| Log score | `logCompetitionScoreLogged` | ✅ Implemented |
| Mark absent | `logCompetitionAbsent` | ✅ Implemented |

**Missing Activity Logging:**
| Action | Expected Method | Priority |
|--------|-----------------|----------|
| Competition created | `logCompetitionStarted` | HIGH |
| Competition completed | `logCompetitionCompleted` | HIGH |
| Competition won | `logCompetitionWon` | HIGH |
| Competition milestone | `logCompetitionMilestone` | MEDIUM |

**Notes:**
- `competitionService.createCompetition()` (line 122-145) creates competitions but does NOT log activity
- `competitionService.updateCompetition()` (line 147-209) updates competitions but does NOT log activity
- No logic exists to trigger `logCompetitionCompleted` or `logCompetitionWon` when competitions end

---

### 1.2 Trackers

**Service Files Involved:**
- `src/server/services/tracker-service.ts`

**Current Activity Logging:**
| Action | Method Called | Status |
|--------|---------------|--------|
| Create tracker | `logTrackerCreated` | ✅ Implemented |
| Log entry | `logTrackerEntryLogged` | ✅ Implemented |

**Missing Activity Logging:**
| Action | Expected Method | Priority |
|--------|-----------------|----------|
| Tracker milestone reached | `logTrackerMilestone` | MEDIUM |
| Tracker deleted | N/A - consider new type | LOW |

**Notes:**
- Milestone detection logic would need to be added to trigger `logTrackerMilestone`
- No delete activity needed (trackers are admin-only)

---

### 1.3 KPIs / Performance

**Service Files Involved:**
- `src/server/services/kpi-service.ts`
- `src/server/services/kpi-log-service.ts`
- `src/server/services/performance-service.ts`

**Current Activity Logging:**
| Action | Method Called | Status |
|--------|---------------|--------|
| Create KPI | `logKpiCreated` | ✅ Implemented |
| Log KPI value | `logKpiUpdated` | ✅ Implemented |

**Missing Activity Logging:**
| Action | Expected Method | Priority |
|--------|-----------------|----------|
| KPI goal reached | `logKpiGoalReached` | HIGH |
| KPI goal achieved | `logKpiGoalAchieved` | HIGH |
| KPI trend improved | `logKpiTrendImproved` | MEDIUM |
| Direct performance log (performance-service.ts) | `logKpiUpdated` | HIGH |

**Notes:**
- `performance-service.ts` does NOT import activityService at all
- KPI goal/trend detection logic is not implemented anywhere
- All performance logging goes directly to database without activity tracking

---

### 1.4 Mini Games

**Service Files Involved:**
- `src/server/actions/games.ts`

**Current Activity Logging:**
| Action | Method Called | Status |
|--------|---------------|--------|
| Win game | `logGameWon` | ✅ Implemented |
| Play game (loss/draw) | `logGamePlayed` | ✅ Implemented |

**Missing Activity Logging:**
| Action | Expected Method | Priority |
|--------|-----------------|----------|
| Set high score | `logGameHighScore` | MEDIUM |
| Game achievement unlocked | `logGameAchievement` | MEDIUM |

**Notes:**
- No logic exists to track or trigger high scores
- No game-specific achievements system implemented yet
- RPS game is the only game currently implemented

---

### 1.5 Achievements & Milestones

**Service Files Involved:**
- None - no service imports `logAchievementEarned`, `logMilestoneReached`, or `logBadgeEarned`

**Current Activity Logging:**
- NONE - no achievements logging exists

**Missing Activity Logging:**
| Action | Expected Method | Priority |
|--------|-----------------|----------|
| Achievement earned | `logAchievementEarned` | HIGH |
| Milestone reached | `logMilestoneReached` | HIGH |
| Badge earned | `logBadgeEarned` | MEDIUM |

**Notes:**
- Activity types are defined in `activity-service.ts` but never called
- No achievement system exists in any service layer
- Would need to implement achievement tracking logic

---

### 1.6 Leaderboards

**Service Files Involved:**
- `src/server/services/competition-service.ts` (getLeaderboard)
- `src/server/services/dashboard-service.ts` (uses leaderboard)

**Current Activity Logging:**
- NONE - leaderboard rankings are retrieved but no activity is logged

**Missing Activity Logging:**
| Action | Expected Method | Priority |
|--------|-----------------|----------|
| Rank position change | Not defined | LOW |

**Notes:**
- Leaderboard data is displayed but position changes are not tracked
- Would need new activity types like `leaderboard_ranked` or `rank_improved`

---

### 1.7 Campaigns

**Service Files Involved:**
- `src/server/services/campaign-service.ts`

**Current Activity Logging:**
- NONE - campaigns created/updated without activity tracking

**Missing Activity Logging:**
| Action | Expected Method | Priority |
|--------|-----------------|----------|
| Campaign created | `logCampaignCreated` | MEDIUM |
| Campaign updated | `logCampaignUpdated` | MEDIUM |

**Notes:**
- No campaign activity types exist in `activity-service.ts`
- Would need to add new methods to activity-service

---

### 1.8 User Profile

**Service Files Involved:**
- `src/server/services/user-service.ts`

**Current Activity Logging:**
| Action | Method Called | Status |
|--------|---------------|--------|
| Profile updated (admin) | `logProfileUpdated` | ✅ Implemented |
| Profile updated (self) | `logProfileUpdated` | ✅ Implemented |

**Missing Activity Logging:**
- NONE for profile updates

**Notes:**
- Profile updates ARE logged when name or roles change
- User creation is NOT logged (could add)

---

## 2. Missing Activities Summary

### HIGH Priority

| Area | Missing Action | Service File(s) | Recommendation |
|------|---------------|-----------------|----------------|
| Competitions | Competition created/started | `competition-service.ts` | Add `logCompetitionStarted` to `createCompetition()` |
| Competitions | Competition completed | `competition-service.ts` | Add completion detection logic |
| Competitions | Competition won | `competition-service.ts` | Add winner detection logic |
| KPIs/Performance | Performance logged | `performance-service.ts` | Import activityService, add `logKpiUpdated` to `createLog()` |
| Achievements | Achievement earned | NEW | Implement achievement system, call `logAchievementEarned` |
| Milestones | Milestone reached | Various | Implement milestone detection logic |

### MEDIUM Priority

| Area | Missing Action | Service File(s) | Recommendation |
|------|---------------|-----------------|----------------|
| Competitions | Competition milestone | `competition-service.ts` | Add milestone detection |
| Trackers | Tracker milestone | `tracker-service.ts` | Add milestone detection |
| KPIs | KPI goal reached/achieved | NEW | Add goal detection logic |
| Games | High score | `actions/games.ts` | Add high score tracking |
| Campaigns | Campaign created/updated | `campaign-service.ts` | Add new activity types and calls |
| User | User created | `user-service.ts` | Add activity on user creation |

### LOW Priority

| Area | Missing Action | Service File(s) | Recommendation |
|------|---------------|-----------------|----------------|
| Leaderboards | Position changes | `competition-service.ts` | Consider new activity type |
| Trackers | Tracker deleted | N/A | Not needed - admin only |
| User | User deleted | `user-service.ts` | Optional |

---

## 3. Recommendations

### 3.1 Services Requiring Modification

| Priority | Service File | Changes Needed |
|----------|-------------|----------------|
| HIGH | `performance-service.ts` | Import activityService, add logging to createLog() |
| HIGH | `competition-service.ts` | Add logging for competition start, completion, win |
| MEDIUM | `tracker-service.ts` | Add milestone detection and logging |
| MEDIUM | `campaign-service.ts` | Add campaign activity types and logging |
| MEDIUM | `actions/games.ts` | Add high score detection |

### 3.2 New Activity Types to Create

If not already defined, consider adding:

| Activity Type | Category | Description |
|--------------|----------|-------------|
| `campaign_created` | competitions | When admin creates a campaign |
| `campaign_updated` | competitions | When admin updates a campaign |
| `leaderboard_rank_changed` | competitions | When user's rank changes significantly |
| `kpi_milestone_reached` | kpis | When user hits a KPI milestone |

### 3.3 Backfill Scripts

**Recommended approach:** For each area, create a one-time backfill script that queries historical data:

1. **Competitions** - Query `Competition` table, create activities for all joins/scores from last 6 weeks
2. **Trackers** - Query `TrackerLog` table, create activities for entries from last 6 weeks  
3. **KPIs** - Query `KpiLog` table, create activities from last 6 weeks
4. **Games** - Query game results, create activities from last 6 weeks
5. **Campaigns** - Query `Campaign` table for created campaigns

### 3.4 Implementation Order

1. **Phase 1 (Critical):**
   - Add performance logging to `performance-service.ts`
   - Add competition completion/winner detection to `competition-service.ts`

2. **Phase 2 (Important):**
   - Add milestone detection to trackers and KPIs
   - Add campaign activity logging
   - Add high score tracking for games

3. **Phase 3 (Nice to Have):**
   - Implement achievement system
   - Add leaderboard position change tracking
   - Backfill historical data

---

## 4. Activity Types Reference

### Defined & Being Used (7 types)
- `tracker_created` ✅
- `tracker_entry_logged` ✅
- `competition_joined` ✅
- `competition_score_logged` ✅
- `competition_absent` ✅
- `kpi_created` ✅
- `kpi_updated` ✅
- `profile_updated` ✅
- `game_won` ✅
- `game_played` ✅

### Defined But NOT Used (17 types)
- `tracker_milestone`
- `competition_started`
- `competition_completed`
- `competition_won`
- `competition_milestone`
- `score_logged`
- `achievement_earned`
- `milestone_reached`
- `badge_earned`
- `kpi_goal_reached`
- `kpi_goal_achieved`
- `kpi_trend_improved`
- `game_high_score`
- `game_achievement`

---

## Appendix: Files Analyzed

**Services with activityService import:**
- `competition-service.ts`
- `competition-entry-service.ts`
- `tracker-service.ts`
- `kpi-service.ts`
- `kpi-log-service.ts`
- `user-service.ts`
- `actions/games.ts`

**Services WITHOUT activityService (missing logging):**
- `campaign-service.ts`
- `performance-service.ts`
- `auth-service.ts`
- `dashboard-service.ts`
- `reporting-service.ts`
- `pod-service.ts`
- `certificate-service.ts`
- `teams-*-service.ts`
