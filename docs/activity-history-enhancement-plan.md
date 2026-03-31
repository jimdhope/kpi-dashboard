# Activity History Enhancement Plan
## KPI-Quest-2 Activity System Evolution

---

## 1. Summary of Current State

### 1.1 Activity Type System
**Location**: `src/types/activity.ts`

**Existing Activity Types** (11 total):
| Category | Type | Title |
|----------|------|-------|
| Competitions | `competition_joined` | "Joined Competition" |
| | `competition_completed` | "Competition Completed" |
| | `competition_started` | "Competition Started" |
| Scores | `score_logged` | "Score Logged" |
| | `achievement_earned` | "Achievement Earned" |
| | `milestone_reached` | "Milestone Reached" |
| | `badge_earned` | "Badge Earned" |
| KPIs | `kpi_updated` | "KPI Updated" |
| | `kpi_goal_reached` | "KPI Goal Reached!" |
| Games | `game_played` | "Played a Game" |
| | `game_won` | "Won a Game!" |
| Profile | `profile_updated` | "Profile Updated" |

### 1.2 Current Activity Document Structure
**Firestore Path**: `agents/{agentId}/activities/{activityId}`

```typescript
interface FirestoreActivity {
  id?: string;
  agentId: string;
  type: ActivityType;
  timestamp: Timestamp;
  title: string;           // Current: Generic title like "Joined Competition"
  description?: string;
  metadata?: Record<string, unknown>;
  category: ActivityCategory;
}
```

### 1.3 Activity Logging Functions
**Location**: `src/lib/firestore/activities.ts`

Current logger functions exist for:
- `logCompetitionJoined`, `logCompetitionCompleted`, `logCompetitionStarted`
- `logScoreLogged`, `logAchievementEarned`, `logMilestoneReached`
- `logKpiUpdated`, `logKpiGoalReached`
- `logGamePlayed`, `logGameWon`
- `logBadgeEarned`, `logProfileUpdated`

### 1.4 UI Components
**Locations**:
- `src/components/activity/ActivityItem.tsx` - Individual activity display
- `src/components/activity/ActivityTimeline.tsx` - Container with filters

**Current Display**:
- Uses generic `title` field (e.g., "Joined Competition")
- Shows metadata in expandable section
- No agent names or recorder attribution in the main title

---

## 2. Proposed Changes

### 2.1 Data Model Evolution

#### New Fields for Activity Document
```typescript
interface EnhancedFirestoreActivity {
  // Existing fields
  id?: string;
  agentId: string;
  type: ActivityType;
  timestamp: Timestamp;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  category: ActivityCategory;

  // NEW: Rich message support
  richMessage?: string;                    // Pre-formatted rich message
  richMessageTemplate?: MessageTemplate;    // Template used for this message

  // NEW: Denormalized agent info (for display without joins)
  agentName?: string;                      // e.g., "John Smith"

  // NEW: Recorder info (when someone else logs on behalf of agent)
  recorderId?: string;                     // Who logged this activity
  recorderName?: string;                   // e.g., "Admin User"
}
```

#### Message Template Enum
```typescript
export enum MessageTemplate {
  // Agent actions (no recorder)
  AGENT_ACTION = 'agent_action',           // "[Agent] did [action] in [context]"
  
  // Recorder actions (someone logged on behalf)
  RECORDER_ACTION = 'recorder_action',     // "[Agent] did [action] - recorded by [Recorder]"
  
  // System-generated
  SYSTEM_EVENT = 'system_event',           // "[System] generated [event]"
}
```

### 2.2 Activity Type Expansion

#### New Activity Types to Add

**Competitions** (extend existing):
| Type | Template | Rich Message Format |
|------|----------|---------------------|
| `competition_won` | Agent Action | "[Agent] won [Competition]!" |
| `competition_score_logged` | Agent Action | "[Agent] logged [X points] in [Competition]" |
| `competition_milestone` | Agent Action | "[Agent] hit [milestone] in [Competition]" |

**Trackers** (NEW category):
| Type | Template | Rich Message Format |
|------|----------|---------------------|
| `tracker_created` | Agent Action | "[Agent] set up [Tracker Name]" |
| `tracker_entry_logged` | Recorder Action | "[Agent] logged [value] on [Tracker] - recorded by [Recorder]" |
| `tracker_milestone` | Agent Action | "[Agent] hit [milestone] on [Tracker]" |

**Performance** (extend KPI category):
| Type | Template | Rich Message Format |
|------|----------|---------------------|
| `kpi_created` | Agent Action | "[Agent] created KPI [Name]" |
| `kpi_goal_achieved` | Agent Action | "[Agent] achieved goal on [KPI]!" |
| `kpi_trend_improved` | Agent Action | "[Agent] improved [KPI] trend" |

**Mini Games** (extend existing):
| Type | Template | Rich Message Format |
|------|----------|---------------------|
| `game_high_score` | Agent Action | "[Agent] set a new high score in [Game]: [score]" |
| `game_achievement` | Agent Action | "[Agent] earned [Achievement] in [Game]" |

### 2.3 Complete Activity Type Registry

```typescript
export enum ActivityType {
  // Competition activities
  COMPETITION_JOINED = 'competition_joined',
  COMPETITION_COMPLETED = 'competition_completed',
  COMPETITION_STARTED = 'competition_started',
  COMPETITION_WON = 'competition_won',                    // NEW
  COMPETITION_SCORE_LOGGED = 'competition_score_logged',  // NEW
  COMPETITION_MILESTONE = 'competition_milestone',        // NEW
  
  // Score activities
  SCORE_LOGGED = 'score_logged',
  ACHIEVEMENT_EARNED = 'achievement_earned',
  MILESTONE_REACHED = 'milestone_reached',
  BADGE_EARNED = 'badge_earned',
  
  // Tracker activities (NEW)
  TRACKER_CREATED = 'tracker_created',
  TRACKER_ENTRY_LOGGED = 'tracker_entry_logged',
  TRACKER_MILESTONE = 'tracker_milestone',
  
  // KPI activities
  KPI_UPDATED = 'kpi_updated',
  KPI_GOAL_REACHED = 'kpi_goal_reached',
  KPI_CREATED = 'kpi_created',                          // NEW
  KPI_GOAL_ACHIEVED = 'kpi_goal_achieved',              // NEW
  KPI_TREND_IMPROVED = 'kpi_trend_improved',            // NEW
  
  // Game activities
  GAME_PLAYED = 'game_played',
  GAME_WON = 'game_won',
  GAME_HIGH_SCORE = 'game_high_score',                  // NEW
  GAME_ACHIEVEMENT = 'game_achievement',                // NEW
  
  // Profile activities
  PROFILE_UPDATED = 'profile_updated',
}
```

### 2.4 Rich Message Templates Configuration

```typescript
export const ActivityMessageTemplates: Record<ActivityType, {
  template: string;
  requiresRecorder: boolean;
  fields: ('agentName' | 'entityName' | 'value' | 'points' | 'recorderName')[];
}> = {
  [ActivityType.COMPETITION_JOINED]: {
    template: "{agentName} joined {entityName}",
    requiresRecorder: false,
    fields: ['agentName', 'entityName'],
  },
  [ActivityType.COMPETITION_COMPLETED]: {
    template: "{agentName} completed {entityName}",
    requiresRecorder: false,
    fields: ['agentName', 'entityName'],
  },
  [ActivityType.COMPETITION_WON]: {
    template: "{agentName} won {entityName}!",
    requiresRecorder: false,
    fields: ['agentName', 'entityName'],
  },
  [ActivityType.COMPETITION_SCORE_LOGGED]: {
    template: "{agentName} logged {points} points in {entityName}",
    requiresRecorder: false,
    fields: ['agentName', 'points', 'entityName'],
  },
  [ActivityType.COMPETITION_MILESTONE]: {
    template: "{agentName} hit {value} in {entityName}",
    requiresRecorder: false,
    fields: ['agentName', 'value', 'entityName'],
  },
  [ActivityType.TRACKER_ENTRY_LOGGED]: {
    template: "{agentName} logged {value} on {entityName} - recorded by {recorderName}",
    requiresRecorder: true,
    fields: ['agentName', 'value', 'entityName', 'recorderName'],
  },
  [ActivityType.TRACKER_CREATED]: {
    template: "{agentName} set up {entityName}",
    requiresRecorder: false,
    fields: ['agentName', 'entityName'],
  },
  [ActivityType.TRACKER_MILESTONE]: {
    template: "{agentName} hit {value} on {entityName}",
    requiresRecorder: false,
    fields: ['agentName', 'value', 'entityName'],
  },
  [ActivityType.KPI_UPDATED]: {
    template: "{agentName} updated {entityName} to {value}",
    requiresRecorder: false,
    fields: ['agentName', 'entityName', 'value'],
  },
  [ActivityType.KPI_GOAL_ACHIEVED]: {
    template: "{agentName} achieved goal on {entityName}!",
    requiresRecorder: false,
    fields: ['agentName', 'entityName'],
  },
  [ActivityType.GAME_PLAYED]: {
    template: "{agentName} played {entityName}",
    requiresRecorder: false,
    fields: ['agentName', 'entityName'],
  },
  [ActivityType.GAME_WON]: {
    template: "{agentName} won {entityName}!",
    requiresRecorder: false,
    fields: ['agentName', 'entityName'],
  },
  [ActivityType.GAME_HIGH_SCORE]: {
    template: "{agentName} set a new high score in {entityName}: {points}",
    requiresRecorder: false,
    fields: ['agentName', 'entityName', 'points'],
  },
  // ... other types
};
```

---

## 3. Implementation Phases

### Phase 1: Data Model Foundation ⭐
**Duration**: ~2-3 hours
**Goal**: Establish the enhanced data model and backward compatibility

#### Tasks:
1. **Update `src/types/activity.ts`**:
   - Add new `ActivityType` enum values
   - Add `MessageTemplate` enum
   - Add new activity interfaces (`TrackerActivity`, `EnhancedCompetitionActivity`)
   - Create `ActivityMessageTemplates` configuration
   - Update `ActivityTypeConfig` with new entries

2. **Update `src/lib/firestore/activities.ts`**:
   - Extend `FirestoreActivity` interface with new fields
   - Add `buildRichMessage()` utility function
   - Create enhanced logging functions with recorder support

3. **Backward Compatibility**:
   - Migration strategy for existing activities (denormalize names on-read)
   - Ensure existing activities continue to work

#### Files to Modify:
- `src/types/activity.ts`
- `src/lib/firestore/activities.ts`

#### Files to Create:
- None (extension of existing files)

#### Dependencies:
- None (foundation work)

---

### Phase 2: Backend Logging Enhancements ⭐⭐
**Duration**: ~3-4 hours
**Goal**: Update all activity logging to use rich messages

#### Tasks:
1. **Update all existing logger functions**:
   - Add `agentName` parameter to all functions
   - Add optional `recorderId`/`recorderName` parameters
   - Auto-generate rich message using template system

2. **Add new logger functions**:
   - `logTrackerCreated(agentId, agentName, trackerId, trackerName)`
   - `logTrackerEntryLogged(agentId, agentName, trackerId, trackerName, value, recorderId?, recorderName?)`
   - `logTrackerMilestone(agentId, agentName, trackerId, trackerName, milestone)`
   - `logKpiCreated(agentId, agentName, kpiId, kpiName)`
   - `logKpiGoalAchieved(agentId, agentName, kpiId, kpiName)`
   - `logGameHighScore(agentId, agentName, gameId, gameName, score)`
   - `logGameAchievement(agentId, agentName, gameId, gameName, achievementName)`

3. **Create helper functions**:
   - `getAgentName(agentId)` - Fetch agent name from Firestore
   - `getRecorderInfo()` - Get current user as potential recorder

#### Files to Modify:
- `src/lib/firestore/activities.ts`

#### Files to Create:
- None

#### Dependencies:
- Phase 1 complete

---

### Phase 3: UI Component Updates ⭐⭐⭐
**Duration**: ~4-5 hours
**Goal**: Update ActivityItem to render rich messages with proper formatting

#### Tasks:
1. **Update `ActivityItem.tsx`**:
   - Add agent avatar display (next to message)
   - Render rich message as main title
   - Add "recorded by" attribution badge when applicable
   - Update icon/color configuration for new activity types
   - Add avatars for new activity categories (Trackers)

2. **Update `ActivityTimeline.tsx`**:
   - Update category counts for new Tracker category
   - Ensure new activity types filter correctly

3. **Add new UI elements**:
   - Agent avatar component inline with activity
   - "Recorded by" attribution chip
   - Tracker icon for new category

#### Files to Modify:
- `src/components/activity/ActivityItem.tsx`
- `src/components/activity/ActivityTimeline.tsx`

#### Files to Create:
- None (enhancement of existing components)

#### Dependencies:
- Phase 1 & 2 complete

---

### Phase 4: Integration & Usage Updates ⭐⭐
**Duration**: ~3-4 hours
**Goal**: Update all places that call activity loggers to pass agent names

#### Tasks:
1. **Find and update all activity logger calls**:
   - RPS game (`src/app/(app)/mini-games/rps/page.tsx`)
   - Any competition-related pages
   - KPI/tracker pages (once created)
   - Profile update pages

2. **Add recorder support**:
   - Admin/manager interfaces that log on behalf of agents
   - Bulk import functionality

3. **Update mock data** (if any):
   - Any placeholder/mock activity data

#### Files to Modify (discover through grep):
- `**/*game*/**/*.tsx` - RPS game and future games
- `**/*competition*/**/*.tsx` - Competition pages
- `**/*tracker*/**/*.tsx` - Tracker pages (if exist)

#### Files to Create:
- None

#### Dependencies:
- Phase 1, 2, 3 complete

---

### Phase 5: Testing & Polish ⭐⭐
**Duration**: ~2-3 hours
**Goal**: Ensure quality and backward compatibility

#### Tasks:
1. **Test existing activities**:
   - Verify existing activities still display correctly
   - Verify backward compatibility

2. **Test new activities**:
   - Create test data for new activity types
   - Verify rich messages render correctly

3. **Edge cases**:
   - Missing agent name (fallback to "Unknown Agent")
   - Missing recorder name
   - Very long entity names (truncation)

4. **Performance**:
   - Verify denormalization doesn't slow down queries
   - Test pagination still works

#### Files to Modify:
- None (testing only)

#### Files to Create:
- None

#### Dependencies:
- All previous phases complete

---

## 4. Files Summary

### Files to Modify (7 files):

| File | Phase | Changes |
|------|-------|---------|
| `src/types/activity.ts` | 1 | New enums, interfaces, templates |
| `src/lib/firestore/activities.ts` | 1, 2 | New fields, logger functions |
| `src/components/activity/ActivityItem.tsx` | 3 | Rich message rendering, avatars |
| `src/components/activity/ActivityTimeline.tsx` | 3 | Category updates |
| `src/app/(app)/mini-games/rps/page.tsx` | 4 | Update logger calls |
| `src/app/(agent)/agent/activity/page.tsx` | 4 | May need updates |
| TBD - Competition pages | 4 | Update logger calls |

### Files to Create (0 files):
All enhancements are modifications to existing files.

---

## 5. Open Questions & Decisions

### 5.1 Display Decisions

**Q1: How should "recorded by" attribution be displayed?**
- Option A: Small text chip below the activity title
- Option B: Badge/pill next to the agent name
- Option C: Tooltip on hover
- **Recommendation**: Option A (small text with recorder avatar)

**Q2: Should we show the agent's avatar in every activity?**
- Pro: More personal, easier to identify
- Con: Adds visual noise, takes more space
- **Recommendation**: Show avatar for agent, not for recorder (recorder is less prominent)

**Q3: What truncation strategy for long names?**
- Entity names (competition, tracker, KPI): Max 40 chars with ellipsis
- Agent names: Max 25 chars with ellipsis
- **Recommendation**: Implement in UI layer, not stored data

### 5.2 Technical Decisions

**Q4: Denormalization Strategy**
- Store `agentName` with every activity (YES - for display without joins)
- Store `recorderName` only when different from agent (NO - always store if present)
- **Recommendation**: Always denormalize names for performance

**Q5: Backward Compatibility for Existing Activities**
- Option A: Run migration script to add `richMessage` to existing docs
- Option B: Generate on-read using helper function
- **Recommendation**: Option B initially, Option A as batch job later

**Q6: Activity Categories**
- Add new category `trackers` OR integrate into existing `scores`
- **Recommendation**: Add `trackers` as separate category for clarity

### 5.3 Scope Clarifications Needed

**Q7: Tracker System**
- Does a tracker system exist yet? If not, when will it be created?
- This affects Phase 4 integration tasks

**Q8: KPI System**
- Are KPIs currently tied to competitions only?
- Should KPI activities link to pods/teams?

**Q9: Future Mini Games**
- How many games are planned?
- Should game types be more generic or game-specific?

---

## 6. Risk Assessment

### Low Risk
- **Phase 1 (Data Model)**: Straightforward enum additions
- **Phase 5 (Testing)**: No breaking changes if backward compat maintained

### Medium Risk
- **Phase 2 (Backend)**: Need to update all logger call sites
- **Phase 3 (UI)**: Avatar sizing and layout changes

### High Risk
- **Phase 4 (Integration)**: Finding all logger call sites requires thorough grep
- **Migration**: Existing activity data won't have rich messages until read/updated

---

## 7. Next Steps

1. **User Decision Required**:
   - Review display decisions (Q1-Q3)
   - Confirm tracker system timeline (Q7)
   - Clarify KPI scope (Q8)

2. **After User Input**:
   - Begin Phase 1 implementation
   - Create detailed migration plan for existing data

3. **Optional Enhancements** (future phases):
   - Activity sharing to social/Teams
   - Activity reactions/emoji
   - Activity filtering by agent (for managers viewing team)

---

## Appendix: Complete Rich Message Templates

```
[Agent Name] joined [Competition Name]
[Agent Name] completed [Competition Name]
[Agent Name] started [Competition Name]
[Agent Name] won [Competition Name]!
[Agent Name] logged [X points] in [Competition Name]
[Agent Name] hit [milestone] in [Competition Name]

[Agent Name] set up [Tracker Name]
[Agent Name] logged [value] on [Tracker Name]
[Agent Name] logged [value] on [Tracker Name] - recorded by [Recorder Name]
[Agent Name] hit [milestone] on [Tracker Name]

[Agent Name] created KPI [KPI Name]
[Agent Name] updated [KPI Name] to [value]
[Agent Name] achieved goal on [KPI Name]!
[Agent Name] improved [KPI Name] trend

[Agent Name] logged [value] points for [Rule Name]
[Agent Name] earned [Achievement Name]
[Agent Name] reached [Milestone Name]
[Agent Name] earned [Badge Name]

[Agent Name] played [Game Name]
[Agent Name] won [Game Name]!
[Agent Name] set a new high score in [Game Name]: [score]
[Agent Name] earned [Achievement] in [Game Name]

[Agent Name] updated their profile
```

---

*Plan created: Based on research of src/types/activity.ts, src/lib/firestore/activities.ts, src/components/activity/, src/services/user.ts, src/app/(app)/mini-games/*
