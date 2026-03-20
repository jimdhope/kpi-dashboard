'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryConstraint,
  Unsubscribe,
} from 'firebase/firestore';
import { collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  AgentActivity, 
  ActivityCategory, 
  ActivityType,
  ActivityTypeCategories,
} from '@/types/activity';
import { 
  getAgentActivitiesCollection,
  FirestoreActivity,
  buildActivityQueryConstraints,
} from '@/lib/firestore/activities';

/**
 * Transform Firestore activity to the AgentActivity type
 */
function transformFirestoreActivity(firestoreActivity: FirestoreActivity): AgentActivity {
  return {
    id: firestoreActivity.id!,
    agentId: firestoreActivity.agentId,
    type: firestoreActivity.type,
    timestamp: firestoreActivity.timestamp?.toDate() || new Date(),
    title: firestoreActivity.title,
    description: firestoreActivity.description,
    metadata: firestoreActivity.metadata || {},
  } as AgentActivity;
}

/**
 * Options for the useAgentActivities hook
 */
export interface UseAgentActivitiesOptions {
  /** Filter by category */
  category?: ActivityCategory;
  /** Filter by date range */
  dateRange?: { start: Date; end: Date };
  /** Filter by specific activity types */
  types?: ActivityType[];
  /** Maximum number of activities to fetch */
  limitCount?: number;
  /** Enable real-time updates (default: true) */
  realtime?: boolean;
}

/**
 * State returned by the useAgentActivities hook
 */
export interface UseAgentActivitiesState {
  /** Array of activities */
  activities: AgentActivity[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Activity counts by category */
  categoryCounts: Record<ActivityCategory, number>;
}

/**
 * Custom hook for fetching agent activities from Firestore
 * 
 * @param agentId - The agent's ID
 * @param options - Query options for filtering activities
 * @returns State object with activities, loading state, and error
 * 
 * @example
 * ```tsx
 * const { activities, isLoading, error, categoryCounts } = useAgentActivities(agentId, {
 *   category: 'competitions',
 *   limitCount: 50,
 * });
 * ```
 */
export function useAgentActivities(
  agentId: string | null | undefined,
  options: UseAgentActivitiesOptions = {}
): UseAgentActivitiesState {
  const {
    category = 'all',
    dateRange,
    types,
    limitCount = 100,
    realtime = true,
  } = options;

  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [allActivities, setAllActivities] = useState<AgentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Build query constraints based on options
  const queryConstraints = useMemo((): QueryConstraint[] => {
    const constraints: QueryConstraint[] = [];
    
    // Always filter by agentId (flat collection)
    constraints.push(where('agentId', '==', agentId));
    
    if (realtime) {
      // For real-time, we fetch all and filter client-side for better UX
      constraints.push(orderBy('timestamp', 'desc'));
      constraints.push(limit(500)); // Reasonable limit for client-side filtering
    } else {
      // For non-real-time, apply filters to the query
      constraints.push(...buildActivityQueryConstraints({
        category,
        dateRange,
        types,
        limitCount,
      }));
    }
    
    return constraints;
  }, [agentId, category, dateRange, types, limitCount, realtime]);

  // Fetch activities from Firestore
  useEffect(() => {
    if (!agentId) {
      setActivities([]);
      setAllActivities([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    let unsubscribe: Unsubscribe | null = null;

    try {
      const activitiesRef = getAgentActivitiesCollection(agentId);
      const q = query(activitiesRef, ...queryConstraints);

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetchedActivities = snapshot.docs.map((doc) => {
            const data = doc.data() as FirestoreActivity;
            return transformFirestoreActivity(data);
          });

          setAllActivities(fetchedActivities);
          setIsLoading(false);
          setError(null);
        },
        (err) => {
          console.error('Error fetching activities:', err);
          setError(err);
          setIsLoading(false);
        }
      );
    } catch (err) {
      console.error('Error setting up activities listener:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch activities'));
      setIsLoading(false);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [agentId, queryConstraints]);

  // Apply client-side filtering for real-time mode
  const filteredActivities = useMemo(() => {
    if (!realtime) {
      return allActivities;
    }

    let filtered = allActivities;

    // Filter by category
    if (category !== 'all') {
      filtered = filtered.filter(
        (activity) => ActivityTypeCategories[activity.type] === category
      );
    }

    // Filter by date range
    if (dateRange) {
      filtered = filtered.filter((activity) => {
        const timestamp = new Date(activity.timestamp);
        return timestamp >= dateRange.start && timestamp <= dateRange.end;
      });
    }

    // Filter by types
    if (types && types.length > 0) {
      filtered = filtered.filter((activity) => types.includes(activity.type));
    }

    // Apply limit for filtered results
    if (limitCount && limitCount < filtered.length) {
      filtered = filtered.slice(0, limitCount);
    }

    return filtered;
  }, [allActivities, category, dateRange, types, limitCount, realtime]);

  // Update activities state
  useEffect(() => {
    setActivities(filteredActivities);
  }, [filteredActivities]);

  // Calculate category counts from all activities
  const categoryCounts = useMemo(() => {
    const counts: Record<ActivityCategory, number> = {
      all: allActivities.length,
      trackers: 0,
      competitions: 0,
      scores: 0,
      kpis: 0,
      games: 0,
      profile: 0,
    };

    allActivities.forEach((activity) => {
      const activityCategory = ActivityTypeCategories[activity.type];
      counts[activityCategory]++;
    });

    return counts;
  }, [allActivities]);

  return {
    activities,
    isLoading,
    error,
    categoryCounts,
  };
}

/**
 * Hook for fetching activities with pagination support
 */
export interface UsePaginatedActivitiesOptions extends UseAgentActivitiesOptions {
  /** Current page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
}

/**
 * Paginated activities state
 */
export interface UsePaginatedActivitiesState extends UseAgentActivitiesState {
  /** Total count of filtered activities */
  total: number;
  /** Whether there are more activities to load */
  hasMore: boolean;
  /** Current page number */
  page: number;
  /** Page size */
  pageSize: number;
  /** Go to next page */
  nextPage: () => void;
  /** Go to previous page */
  prevPage: () => void;
  /** Go to specific page */
  goToPage: (page: number) => void;
}

/**
 * Custom hook for fetching paginated activities
 */
export function usePaginatedActivities(
  agentId: string | null | undefined,
  options: UsePaginatedActivitiesOptions = {}
): UsePaginatedActivitiesState {
  const {
    page = 1,
    pageSize = 20,
    category = 'all',
    dateRange,
    types,
    realtime = true,
  } = options;

  const [currentPage, setCurrentPage] = useState(page);

  // Fetch all activities with the hook
  const { activities, isLoading, error, categoryCounts } = useAgentActivities(
    agentId,
    {
      category,
      dateRange,
      types,
      limitCount: 500, // Fetch more for pagination
      realtime,
    }
  );

  // Calculate pagination
  const paginatedResult = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedActivities = activities.slice(startIndex, endIndex);

    return {
      activities: paginatedActivities,
      total: activities.length,
      hasMore: endIndex < activities.length,
    };
  }, [activities, currentPage, pageSize]);

  // Navigation functions
  const nextPage = useCallback(() => {
    setCurrentPage((prev) => prev + 1);
  }, []);

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, []);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, page));
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [category, dateRange, types]);

  return {
    activities: paginatedResult.activities,
    isLoading,
    error,
    categoryCounts,
    total: paginatedResult.total,
    hasMore: paginatedResult.hasMore,
    page: currentPage,
    pageSize,
    nextPage,
    prevPage,
    goToPage,
  };
}
