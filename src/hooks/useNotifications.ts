'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc,
  addDoc,
  serverTimestamp,
  where,
  Unsubscribe,
  Timestamp,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '@/lib/firebase';
import type { NotificationType, NotificationPriority } from '@/components/notifications/notificationStore';

// Re-export the Notification type from notificationStore
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: NotificationPriority;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

// Firestore notification document structure
interface FirestoreNotification {
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: Timestamp;
  link?: string;
  priority: NotificationPriority;
  metadata?: Record<string, unknown>;
}

// Extended return type with loading and error states
interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: Error | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => Promise<string | null>;
  refreshNotifications: () => void;
}

/**
 * Custom hook for real-time notifications from Firestore.
 * 
 * Subscribes to the user's notifications subcollection at:
 * users/{userId}/notifications
 * 
 * Provides real-time updates via onSnapshot.
 */
export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const authUnsubscribeRef = useRef<(() => void) | null>(null);
  const isInitializedRef = useRef(false);

  // Subscribe to auth state
  useEffect(() => {
    const auth = getAuth();
    
    authUnsubscribeRef.current = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setNotifications([]);
        setLoading(false);
      }
    });

    return () => {
      if (authUnsubscribeRef.current) {
        authUnsubscribeRef.current();
      }
    };
  }, []);

  // Subscribe to notifications collection
  useEffect(() => {
    if (!userId) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    setLoading(true);
    setError(null);

    // Query notifications for this user, ordered by creation time (newest first)
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    const notificationsQuery = query(
      notificationsRef,
      orderBy('createdAt', 'desc')
    );

    // Subscribe to real-time updates
    unsubscribeRef.current = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notificationsData: Notification[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as FirestoreNotification;
          return {
            id: docSnap.id,
            type: data.type,
            title: data.title,
            message: data.message,
            timestamp: data.createdAt?.toDate() || new Date(),
            read: data.read ?? false,
            priority: data.priority,
            actionUrl: data.link,
            metadata: data.metadata,
          };
        });

        setNotifications(notificationsData);
        setLoading(false);
        isInitializedRef.current = true;
      },
      (err) => {
        console.error('Error subscribing to notifications:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [userId]);

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Mark a notification as read
  const markAsRead = useCallback(
    async (id: string): Promise<void> => {
      if (!userId) return;

      try {
        const notificationRef = doc(db, 'users', userId, 'notifications', id);
        await updateDoc(notificationRef, {
          read: true,
        });
      } catch (err) {
        console.error('Error marking notification as read:', err);
        throw err;
      }
    },
    [userId]
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async (): Promise<void> => {
    if (!userId) return;

    try {
      const notificationsRef = collection(db, 'users', userId, 'notifications');
      const unreadQuery = query(notificationsRef, where('read', '==', false));
      const snapshot = await getDocs(unreadQuery);

      if (snapshot.empty) return;

      // Use batch write for efficiency
      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      throw err;
    }
  }, [userId]);

  // Delete a notification
  const deleteNotification = useCallback(
    async (id: string): Promise<void> => {
      if (!userId) return;

      try {
        const notificationRef = doc(db, 'users', userId, 'notifications', id);
        await deleteDoc(notificationRef);
      } catch (err) {
        console.error('Error deleting notification:', err);
        throw err;
      }
    },
    [userId]
  );

  // Clear all notifications
  const clearAllNotifications = useCallback(async (): Promise<void> => {
    if (!userId) return;

    try {
      const notificationsRef = collection(db, 'users', userId, 'notifications');
      const snapshot = await getDocs(notificationsRef);

      if (snapshot.empty) return;

      // Use batch delete for efficiency
      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
    } catch (err) {
      console.error('Error clearing all notifications:', err);
      throw err;
    }
  }, [userId]);

  // Add a new notification
  const addNotification = useCallback(
    async (
      notification: Omit<Notification, 'id' | 'timestamp' | 'read'>
    ): Promise<string | null> => {
      if (!userId) return null;

      try {
        const notificationsRef = collection(db, 'users', userId, 'notifications');
        const newNotification: Omit<FirestoreNotification, 'createdAt'> = {
          type: notification.type,
          title: notification.title,
          message: notification.message,
          read: false,
          priority: notification.priority,
          link: notification.actionUrl,
          metadata: notification.metadata,
        };

        const docRef = await addDoc(notificationsRef, {
          ...newNotification,
          createdAt: serverTimestamp(),
        });

        return docRef.id;
      } catch (err) {
        console.error('Error adding notification:', err);
        throw err;
      }
    },
    [userId]
  );

  // Force refresh (re-subscribe)
  const refreshNotifications = useCallback(() => {
    // Trigger a re-subscription by toggling userId
    if (userId) {
      const currentUserId = userId;
      setUserId(null);
      // Small delay to ensure cleanup
      setTimeout(() => setUserId(currentUserId), 100);
    }
  }, [userId]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    addNotification,
    refreshNotifications,
  };
}

/**
 * Create a notification for a specific user.
 * This is a server-side friendly function that can be called from anywhere.
 * 
 * @param userId - The target user's ID
 * @param notification - The notification data (without id, timestamp, read)
 * @returns The created notification ID
 */
export async function createNotificationForUser(
  userId: string,
  notification: {
    type: NotificationType;
    title: string;
    message: string;
    priority: NotificationPriority;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<string> {
  const notificationsRef = collection(db, 'users', userId, 'notifications');
  
  const newNotification: Omit<FirestoreNotification, 'createdAt'> = {
    type: notification.type,
    title: notification.title,
    message: notification.message,
    read: false,
    priority: notification.priority,
    link: notification.actionUrl,
    metadata: notification.metadata,
  };

  const docRef = await addDoc(notificationsRef, {
    ...newNotification,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Create notifications for multiple users (e.g., competition participants).
 * Uses batch writes for efficiency.
 * 
 * @param userIds - Array of target user IDs
 * @param notification - The notification data
 * @returns Array of created notification IDs
 */
export async function createNotificationsForUsers(
  userIds: string[],
  notification: {
    type: NotificationType;
    title: string;
    message: string;
    priority: NotificationPriority;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<string[]> {
  if (userIds.length === 0) return [];

  const newNotification: Omit<FirestoreNotification, 'createdAt'> = {
    type: notification.type,
    title: notification.title,
    message: notification.message,
    read: false,
    priority: notification.priority,
    link: notification.actionUrl,
    metadata: notification.metadata,
  };

  // For small batches, use a simple approach
  // For large batches, you might want to chunk this
  
  // Firebase batch limit is 500 operations
  const batch = writeBatch(db);
  const docRefs: { userId: string; ref: ReturnType<typeof doc> }[] = [];

  for (const userId of userIds) {
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    const docRef = doc(notificationsRef); // Auto-generate ID
    
    batch.set(docRef, {
      ...newNotification,
      createdAt: serverTimestamp(),
    });
    
    docRefs.push({ userId, ref: docRef });
  }

  await batch.commit();
  
  // Extract IDs after batch commit
  return docRefs.map((item) => item.ref.id);
}

/**
 * Notification trigger helper functions.
 * Use these in relevant parts of the app to create notifications.
 */
export const NotificationTriggers = {
  /**
   * Trigger when a competition starts (for participants)
   */
  competitionStarted: async (userId: string, competitionData: {
    name: string;
    competitionId: string;
    endDate?: Date;
  }) => {
    return createNotificationForUser(userId, {
      type: 'competition_reminder',
      title: 'Competition Started!',
      message: `"${competitionData.name}" has begun. Let the games begin!`,
      priority: 'high',
      actionUrl: `/competitions/${competitionData.competitionId}`,
      metadata: { competitionId: competitionData.competitionId },
    });
  },

  /**
   * Trigger when scores are logged successfully
   */
  scoreLogged: async (userId: string, scoreData: {
    score: number;
    competitionId: string;
    competitionName: string;
  }) => {
    return createNotificationForUser(userId, {
      type: 'score_achievement',
      title: 'Score Logged Successfully',
      message: `Your score of ${scoreData.score} has been recorded for "${scoreData.competitionName}".`,
      priority: 'low',
      actionUrl: `/competitions/${scoreData.competitionId}`,
      metadata: { competitionId: scoreData.competitionId, score: scoreData.score },
    });
  },

  /**
   * Trigger when a team update occurs (e.g., team leaderboard change)
   */
  teamUpdate: async (userId: string, teamData: {
    teamName: string;
    newPosition: number;
    competitionId: string;
  }) => {
    const positionEmoji = teamData.newPosition <= 3 ? '🎉' : '';
    return createNotificationForUser(userId, {
      type: 'team_update',
      title: 'Team Leaderboard Update',
      message: `Your team "${teamData.teamName}" has moved to position #${teamData.newPosition}${positionEmoji}`,
      priority: teamData.newPosition <= 3 ? 'high' : 'medium',
      actionUrl: `/competitions/${teamData.competitionId}/dashboard`,
      metadata: { teamName: teamData.teamName, position: teamData.newPosition },
    });
  },

  /**
   * Trigger when an achievement is earned
   */
  achievementEarned: async (userId: string, achievementData: {
    achievementName: string;
    badge?: string;
    competitionId?: string;
  }) => {
    return createNotificationForUser(userId, {
      type: 'score_achievement',
      title: 'Achievement Unlocked!',
      message: `You've earned the "${achievementData.achievementName}" badge!`,
      priority: 'medium',
      actionUrl: achievementData.competitionId 
        ? `/competitions/${achievementData.competitionId}` 
        : '/agent/profile',
      metadata: { achievementName: achievementData.achievementName },
    });
  },

  /**
   * Trigger a system alert
   */
  systemAlert: async (userId: string, alertData: {
    title: string;
    message: string;
    priority?: NotificationPriority;
  }) => {
    return createNotificationForUser(userId, {
      type: 'system_alert',
      title: alertData.title,
      message: alertData.message,
      priority: alertData.priority || 'high',
    });
  },

  /**
   * Competition reminder (e.g., ending soon)
   */
  competitionReminder: async (userId: string, reminderData: {
    competitionName: string;
    competitionId: string;
    hoursRemaining: number;
  }) => {
    return createNotificationForUser(userId, {
      type: 'competition_reminder',
      title: 'Competition Ending Soon!',
      message: `"${reminderData.competitionName}" ends in ${reminderData.hoursRemaining} hours. Final push!`,
      priority: reminderData.hoursRemaining <= 24 ? 'high' : 'medium',
      actionUrl: `/competitions/${reminderData.competitionId}`,
      metadata: { competitionId: reminderData.competitionId },
    });
  },
};
