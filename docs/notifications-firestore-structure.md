# Notifications Firestore Structure

## Overview

The notification system in KPI-Quest-2 uses Firestore for real-time notification management. Each user has their own notifications subcollection at `users/{userId}/notifications`.

## Collection Structure

### Path
```
users/{userId}/notifications/{notificationId}
```

### Document Schema

```typescript
interface FirestoreNotification {
  type: 'competition_reminder' | 'score_achievement' | 'team_update' | 'system_alert';
  title: string;              // Notification title
  message: string;            // Notification body text
  read: boolean;              // Whether notification has been read
  priority: 'low' | 'medium' | 'high';
  createdAt: Timestamp;       // Firestore server timestamp
  link?: string;              // Optional URL to navigate to
  metadata?: Record<string, unknown>;  // Additional data
}
```

## Notification Types

| Type | Icon | Color | Use Case |
|------|------|-------|----------|
| `competition_reminder` | Trophy | Amber | Competition starts/ends, reminders |
| `score_achievement` | Award | Emerald | Score logged, badges earned |
| `team_update` | Users | Blue | Team leaderboard changes |
| `system_alert` | AlertCircle | Red | Maintenance, system messages |

## Priority Levels

| Priority | Color | Behavior |
|----------|-------|----------|
| `high` | Red | Shows urgent badge, high position in list |
| `medium` | Yellow | Standard priority |
| `low` | Gray | Background notifications |

## Usage

### Client-Side: Using the Notification Hook

```typescript
import { useNotifications } from '@/components/notifications';

function MyComponent() {
  const { 
    notifications,      // Notification[]
    unreadCount,        // number
    loading,            // boolean
    error,              // Error | null
    isUsingFirestore,   // boolean - true if using real Firestore
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    addNotification
  } = useNotifications();
  
  // ...
}
```

### Server-Side: Creating Notifications

```typescript
import { createNotification, NotificationTriggers } from '@/components/notifications';

// Single user notification
await createNotification(userId, {
  type: 'competition_reminder',
  title: 'Competition Started!',
  message: 'Weekly Sales Challenge has begun.',
  priority: 'high',
  actionUrl: '/competitions/abc123'
});

// Multiple users at once (batch)
import { createNotificationsForUsers } from '@/components/notifications';

await createNotificationsForUsers(userIds, {
  type: 'team_update',
  title: 'Team Leaderboard Update',
  message: 'Your team moved to #2!',
  priority: 'medium',
  actionUrl: '/competitions/dashboard'
});
```

### Using Notification Triggers

```typescript
import { NotificationTriggers } from '@/components/notifications';

// Competition started
await NotificationTriggers.competitionStarted(userId, {
  name: 'Weekly Sales Challenge',
  competitionId: 'comp-123'
});

// Score logged
await NotificationTriggers.scoreLogged(userId, {
  score: 98,
  competitionId: 'comp-123',
  competitionName: 'Weekly Sales Challenge'
});

// Team update
await NotificationTriggers.teamUpdate(userId, {
  teamName: 'Alpha Squad',
  newPosition: 3,
  competitionId: 'comp-123'
});

// Achievement earned
await NotificationTriggers.achievementEarned(userId, {
  achievementName: 'Consistent Performer',
  competitionId: 'comp-123'
});

// System alert
await NotificationTriggers.systemAlert(userId, {
  title: 'Scheduled Maintenance',
  message: 'System maintenance Sunday 2:00 AM - 4:00 AM UTC',
  priority: 'low'
});

// Competition reminder
await NotificationTriggers.competitionReminder(userId, {
  competitionName: 'Weekly Sales Challenge',
  competitionId: 'comp-123',
  hoursRemaining: 24
});
```

## Offline Behavior

The notification system gracefully handles offline scenarios:

1. **Real-time sync**: When online, notifications sync in real-time via Firestore onSnapshot
2. **Offline fallback**: If Firestore is unavailable or user is not authenticated, falls back to localStorage
3. **Action queuing**: Write operations (mark as read, delete) have local fallbacks if Firestore fails
4. **Graceful degradation**: UI continues to work even if Firestore is unreachable

## Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own notifications
    match /users/{userId}/notifications/{notificationId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Best Practices

1. **Use triggers for common scenarios**: `NotificationTriggers` handles common notification patterns
2. **Include metadata**: Add relevant IDs/values in metadata for deep linking and analytics
3. **Set appropriate priority**: High priority for urgent items, low for informational
4. **Limit notification volume**: Too many notifications reduces engagement
5. **Provide action URLs**: Always link to relevant content when possible

## Component Integration

Notifications are automatically displayed via:
- `NotificationBell` - Bell icon in navbar with unread badge
- `NotificationDropdown` - Dropdown list of notifications
- `NotificationItem` - Individual notification display
- `/settings/notifications` - Full notification management page

All components automatically use the real-time Firestore data when available.
