'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useSyncExternalStore, useRef } from 'react';
import { 
  Trophy, Target, Users, AlertCircle, Award, 
  TrendingUp, CheckCircle, Clock, MessageSquare, Zap
} from 'lucide-react';
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
  getDocs,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '@/lib/firebase';

// Notification types
export type NotificationType = 
  | 'competition_reminder'
  | 'score_achievement'
  | 'team_update'
  | 'system_alert';

// Notification priority
export type NotificationPriority = 'low' | 'medium' | 'high';

// Notification interface
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

// Icon mapping for notification types
export const notificationIcons: Record<NotificationType, React.ElementType> = {
  competition_reminder: Trophy,
  score_achievement: Award,
  team_update: Users,
  system_alert: AlertCircle,
};

// Color mapping for notification types
export const notificationColors: Record<NotificationType, { bg: string; icon: string; border: string }> = {
  competition_reminder: { bg: 'bg-amber-500/20', icon: 'text-amber-500', border: 'border-amber-500/30' },
  score_achievement: { bg: 'bg-emerald-500/20', icon: 'text-emerald-500', border: 'border-emerald-500/30' },
  team_update: { bg: 'bg-blue-500/20', icon: 'text-blue-500', border: 'border-blue-500/30' },
  system_alert: { bg: 'bg-red-500/20', icon: 'text-red-500', border: 'border-red-500/30' },
};

// Priority colors
export const priorityColors: Record<NotificationPriority, string> = {
  low: 'bg-gray-400',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
};

// Storage key for localStorage fallback
const STORAGE_KEY = 'kpi-quest-notifications';
const FALLBACK_STORAGE_KEY = 'kpi-quest-notifications-fallback';

// Demo notifications for testing (used when Firestore is unavailable)
const createDemoNotifications = (): Notification[] => {
  const now = new Date();
  return [
    {
      id: `demo-${Date.now()}-1`,
      type: 'competition_reminder',
      title: 'Weekly Sales Challenge',
      message: 'Don\'t forget! The Weekly Sales Challenge ends tomorrow at midnight.',
      timestamp: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
      read: false,
      priority: 'high',
      actionUrl: '/competitions',
    },
    {
      id: `demo-${Date.now()}-2`,
      type: 'score_achievement',
      title: 'New Personal Best!',
      message: 'Congratulations! You\'ve achieved your highest monthly score of 98 points.',
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
      read: false,
      priority: 'medium',
      actionUrl: '/agent/competitions',
    },
    {
      id: `demo-${Date.now()}-3`,
      type: 'team_update',
      title: 'Team Leaderboard Update',
      message: 'Your team "Alpha Squad" has moved up to 3rd place!',
      timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000), // 5 hours ago
      read: true,
      priority: 'medium',
      actionUrl: '/competitions/dashboard',
    },
    {
      id: `demo-${Date.now()}-4`,
      type: 'system_alert',
      title: 'Scheduled Maintenance',
      message: 'System maintenance scheduled for Sunday 2:00 AM - 4:00 AM UTC.',
      timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
      read: true,
      priority: 'low',
    },
    {
      id: `demo-${Date.now()}-5`,
      type: 'score_achievement',
      title: 'Achievement Unlocked',
      message: 'You\'ve earned the "Consistent Performer" badge!',
      timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      read: true,
      priority: 'low',
      actionUrl: '/agent/profile',
    },
  ];
};

// Context interface
interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: Error | null;
  isUsingFirestore: boolean;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  getNotificationsByType: (type: NotificationType) => Notification[];
  getUnreadNotifications: () => Notification[];
}

// Create context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Provider props
interface NotificationProviderProps {
  children: React.ReactNode;
  /** Override to use localStorage only (useful for testing or offline-only mode) */
  useLocalStorageOnly?: boolean;
}

/**
 * NotificationProvider - Provides notification state management
 * 
 * Uses Firestore for real-time notifications when:
 * 1. User is authenticated
 * 2. useLocalStorageOnly is false (default)
 * 
 * Falls back to localStorage when Firestore is unavailable
 */
export function NotificationProvider({ children, useLocalStorageOnly = false }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isUsingFirestore, setIsUsingFirestore] = useState(false);
  
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const authUnsubscribeRef = useRef<(() => void) | null>(null);

  // Subscribe to auth state
  useEffect(() => {
    const auth = getAuth();
    
    authUnsubscribeRef.current = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setIsUsingFirestore(false);
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      }
    });

    return () => {
      if (authUnsubscribeRef.current) {
        authUnsubscribeRef.current();
      }
    };
  }, []);

  // Subscribe to Firestore notifications when user is authenticated
  useEffect(() => {
    // Skip if localStorage only mode or no user
    if (useLocalStorageOnly || !userId) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setIsUsingFirestore(false);
      return;
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
        setIsUsingFirestore(true);
      },
      (err) => {
        console.error('Error subscribing to notifications:', err);
        setError(err);
        setLoading(false);
        setIsUsingFirestore(false);
        // Fall back to localStorage
        loadFromLocalStorage();
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [userId, useLocalStorageOnly]);

  // Load from localStorage (fallback)
  const loadFromLocalStorage = useCallback(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const notificationsWithDates = parsed.map((n: Notification) => ({
          ...n,
          timestamp: new Date(n.timestamp),
        }));
        setNotifications(notificationsWithDates);
      } catch (err) {
        console.error('Failed to parse notifications from localStorage:', err);
        const demo = createDemoNotifications();
        setNotifications(demo);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
      }
    } else {
      const demo = createDemoNotifications();
      setNotifications(demo);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
    }
    setLoading(false);
  }, []);

  // Initialize: load from localStorage while waiting for auth
  useEffect(() => {
    if (!userId && !isUsingFirestore) {
      loadFromLocalStorage();
    }
  }, [userId, isUsingFirestore, loadFromLocalStorage]);

  // Save to localStorage when using fallback
  useEffect(() => {
    if (!isUsingFirestore && notifications.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    }
  }, [notifications, isUsingFirestore]);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Add a new notification
  const addNotification = useCallback(async (
    notification: Omit<Notification, 'id' | 'timestamp' | 'read'>
  ) => {
    if (useLocalStorageOnly || !userId) {
      // Use localStorage
      const newNotification: Notification = {
        ...notification,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        read: false,
      };
      setNotifications(prev => [newNotification, ...prev]);
      return;
    }

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
      await addDoc(notificationsRef, {
        ...newNotification,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error adding notification:', err);
      // Fall back to localStorage
      const newNotification: Notification = {
        ...notification,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        read: false,
      };
      setNotifications(prev => [newNotification, ...prev]);
    }
  }, [userId, useLocalStorageOnly]);

  // Mark notification as read
  const markAsRead = useCallback(async (id: string) => {
    if (useLocalStorageOnly || !userId) {
      // Use localStorage
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
      return;
    }

    try {
      const notificationRef = doc(db, 'users', userId, 'notifications', id);
      await updateDoc(notificationRef, { read: true });
    } catch (err) {
      console.error('Error marking notification as read:', err);
      // Fall back to localStorage
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
    }
  }, [userId, useLocalStorageOnly]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (useLocalStorageOnly || !userId) {
      // Use localStorage
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      return;
    }

    try {
      const notificationsRef = collection(db, 'users', userId, 'notifications');
      const unreadQuery = query(notificationsRef, where('read', '==', false));
      const snapshot = await getDocs(unreadQuery);

      if (snapshot.empty) return;

      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      // Fall back to localStorage
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  }, [userId, useLocalStorageOnly]);

  // Delete a notification
  const deleteNotification = useCallback(async (id: string) => {
    if (useLocalStorageOnly || !userId) {
      // Use localStorage
      setNotifications(prev => prev.filter(n => n.id !== id));
      return;
    }

    try {
      const notificationRef = doc(db, 'users', userId, 'notifications', id);
      await deleteDoc(notificationRef);
    } catch (err) {
      console.error('Error deleting notification:', err);
      // Fall back to localStorage
      setNotifications(prev => prev.filter(n => n.id !== id));
    }
  }, [userId, useLocalStorageOnly]);

  // Clear all notifications
  const clearAllNotifications = useCallback(async () => {
    if (useLocalStorageOnly || !userId) {
      // Use localStorage
      setNotifications([]);
      return;
    }

    try {
      const notificationsRef = collection(db, 'users', userId, 'notifications');
      const snapshot = await getDocs(notificationsRef);

      if (snapshot.empty) return;

      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
    } catch (err) {
      console.error('Error clearing all notifications:', err);
      // Fall back to localStorage
      setNotifications([]);
    }
  }, [userId, useLocalStorageOnly]);

  // Get notifications by type
  const getNotificationsByType = useCallback((type: NotificationType) => {
    return notifications.filter(n => n.type === type);
  }, [notifications]);

  // Get unread notifications
  const getUnreadNotifications = useCallback(() => {
    return notifications.filter(n => !n.read);
  }, [notifications]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    loading,
    error,
    isUsingFirestore,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    getNotificationsByType,
    getUnreadNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// Hook to use notifications
export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

// Utility function to format relative time
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

// Utility function to format full date
export function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Export helper function to create notifications from anywhere in the app
// This is useful for triggering notifications from different parts of the application
export async function createNotification(
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

// Export helper to create notifications for multiple users
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

  const batch = writeBatch(db);
  const docRefs: { userId: string; ref: ReturnType<typeof doc> }[] = [];

  for (const userId of userIds) {
    const notificationsRef = collection(db, 'users', userId, 'notifications');
    const docRef = doc(notificationsRef);
    
    batch.set(docRef, {
      ...newNotification,
      createdAt: serverTimestamp(),
    });
    
    docRefs.push({ userId, ref: docRef });
  }

  await batch.commit();
  
  return docRefs.map((item) => item.ref.id);
}

// Notification trigger helpers
export const NotificationTriggers = {
  competitionStarted: async (userId: string, competitionData: {
    name: string;
    competitionId: string;
    endDate?: Date;
  }) => {
    return createNotification(userId, {
      type: 'competition_reminder',
      title: 'Competition Started!',
      message: `"${competitionData.name}" has begun. Let the games begin!`,
      priority: 'high',
      actionUrl: `/competitions/${competitionData.competitionId}`,
      metadata: { competitionId: competitionData.competitionId },
    });
  },

  scoreLogged: async (userId: string, scoreData: {
    score: number;
    competitionId: string;
    competitionName: string;
  }) => {
    return createNotification(userId, {
      type: 'score_achievement',
      title: 'Score Logged Successfully',
      message: `Your score of ${scoreData.score} has been recorded for "${scoreData.competitionName}".`,
      priority: 'low',
      actionUrl: `/competitions/${scoreData.competitionId}`,
      metadata: { competitionId: scoreData.competitionId, score: scoreData.score },
    });
  },

  teamUpdate: async (userId: string, teamData: {
    teamName: string;
    newPosition: number;
    competitionId: string;
  }) => {
    return createNotification(userId, {
      type: 'team_update',
      title: 'Team Leaderboard Update',
      message: `Your team "${teamData.teamName}" has moved to position #${teamData.newPosition}`,
      priority: teamData.newPosition <= 3 ? 'high' : 'medium',
      actionUrl: `/competitions/${teamData.competitionId}/dashboard`,
      metadata: { teamName: teamData.teamName, position: teamData.newPosition },
    });
  },

  achievementEarned: async (userId: string, achievementData: {
    achievementName: string;
    badge?: string;
    competitionId?: string;
  }) => {
    return createNotification(userId, {
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

  systemAlert: async (userId: string, alertData: {
    title: string;
    message: string;
    priority?: NotificationPriority;
  }) => {
    return createNotification(userId, {
      type: 'system_alert',
      title: alertData.title,
      message: alertData.message,
      priority: alertData.priority || 'high',
    });
  },

  competitionReminder: async (userId: string, reminderData: {
    competitionName: string;
    competitionId: string;
    hoursRemaining: number;
  }) => {
    return createNotification(userId, {
      type: 'competition_reminder',
      title: 'Competition Ending Soon!',
      message: `"${reminderData.competitionName}" ends in ${reminderData.hoursRemaining} hours. Final push!`,
      priority: reminderData.hoursRemaining <= 24 ? 'high' : 'medium',
      actionUrl: `/competitions/${reminderData.competitionId}`,
      metadata: { competitionId: reminderData.competitionId },
    });
  },
};
