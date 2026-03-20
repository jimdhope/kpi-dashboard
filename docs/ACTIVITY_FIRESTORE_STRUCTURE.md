# Activity History Firestore Structure

## Overview

The Activity History feature tracks agent activities in Firestore using a subcollection pattern for efficient querying and real-time updates.

## Firestore Collection Structure

```
agents/
  {agentId}/
    activities/
      {activityId}/
```

### Collection: `agents/{agentId}/activities`

Each activity document contains the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto-generated document ID |
| `agentId` | string | The agent's ID (same as parent document) |
| `type` | string (enum) | The type of activity (see Activity Types below) |
| `timestamp` | Timestamp | When the activity occurred |
| `title` | string | Human-readable activity title |
| `description` | string | Optional detailed description |
| `metadata` | object | Activity-specific data (varies by type) |
| `category` | string | Category for filtering (competitions, scores, kpis, games, profile) |

## Activity Types

### Competition Activities
- `competition_joined` - Agent joined a competition
- `competition_started` - Competition started
- `competition_completed` - Competition ended

### Score Activities
- `score_logged` - Score was logged
- `achievement_earned` - Achievement was earned
- `milestone_reached` - Milestone was reached
- `badge_earned` - Badge was earned

### KPI Activities
- `kpi_updated` - KPI value was updated
- `kpi_goal_reached` - KPI goal was achieved

### Game Activities
- `game_played` - A game was played
- `game_won` - A game was won

### Profile Activities
- `profile_updated` - Profile was updated

## Metadata by Activity Type

### Competition Activities
```typescript
{
  competitionId: string;
  competitionName: string;
  teamName?: string;
  finalScore?: number;    // For completed
  rank?: number;          // For completed
}
```

### Score Activities
```typescript
{
  ruleId?: string;
  ruleName?: string;
  points: number;
  value?: number;
  competitionId?: string;
}
```

### KPI Activities
```typescript
{
  kpiId: string;
  kpiName: string;
  previousValue?: number;
  newValue: number;
  targetValue?: number;
}
```

### Game Activities
```typescript
{
  gameId: string;
  gameName: string;
  result?: 'win' | 'loss' | 'draw';
  score?: number;
}
```

## API Usage

### Using the Custom Hook

```typescript
import { useAgentActivities } from '@/hooks/useAgentActivities';

// Basic usage
const { activities, isLoading, error, categoryCounts } = useAgentActivities(agentId);

// With filtering
const { activities } = useAgentActivities(agentId, {
  category: 'competitions',
  dateRange: { start: new Date('2024-01-01'), end: new Date() },
  limitCount: 50,
  realtime: true, // Real-time updates (default: true)
});

// Paginated version
const { activities, isLoading, total, hasMore, nextPage, prevPage } = usePaginatedActivities(agentId, {
  page: 1,
  pageSize: 20,
});
```

### Logging Activities

```typescript
import { activityLoggers } from '@/lib/firestore/activities';

// Log various activities
await activityLoggers.logCompetitionJoined(agentId, compId, 'Q1 Sprint');
await activityLoggers.logScoreLogged(agentId, ruleId, 'Great Service', 10, 1);
await activityLoggers.logKpiUpdated(agentId, kpiId, 'Tickets', 50, 65, 100);
await activityLoggers.logGameWon(agentId, 'rps', 'Rock Paper Scissors', 10);
```

## Firestore Security Rules

Add these rules to your Firestore security rules to protect activity data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    match /agents/{agentId}/activities/{activityId} {
      // Agents can only read their own activities
      allow read: if request.auth != null && request.auth.uid == agentId;
      
      // Only allow activity creation through the API (not directly)
      allow create: if false;
      allow update, delete: if false;
    }
    
  }
}
```

## Composite Indexes

For optimal query performance, create these composite indexes in Firebase Console:

1. **Activities by timestamp (descending)**
   - Collection: `agents/{agentId}/activities`
   - Fields: `timestamp` (Descending)

2. **Activities by category and timestamp**
   - Collection: `agents/{agentId}/activities`
   - Fields: `category` (Ascending), `timestamp` (Descending)

3. **Activities by type and timestamp**
   - Collection: `agents/{agentId}/activities`
   - Fields: `type` (Ascending), `timestamp` (Descending)

## Performance Considerations

- Activities use client-side filtering for real-time mode to provide instant UI updates
- Server-side filtering is used when `realtime: false` is set
- Default limit of 500 activities for client-side filtering to balance performance
- Real-time listeners (`onSnapshot`) automatically handle offline mode

## Migration from Mock Data

To migrate from mock data to real Firestore data:

1. Ensure the agent is authenticated
2. Replace `generateMockActivities()` calls with `useAgentActivities()` hook
3. Start adding activity logging to relevant actions (see integration points below)

## Integration Points

Add activity logging to these actions:

- ✅ RPS Game played/won (`/app/(app)/mini-games/rps/page.tsx`)
- ⬜ Daily achievements logged (`/app/(app)/trackers/log/page.tsx`)
- ⬜ Additional KPIs logged (`/app/(app)/performance/log/page.tsx`)
- ⬜ Competition joined/completed
- ⬜ Profile updates
- ⬜ Achievements earned
