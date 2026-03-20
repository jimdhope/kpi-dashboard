/**
 * Firestore Activities Module
 * 
 * Provides helper functions for managing agent activities in Firestore.
 * Uses flat collection pattern: activities/{activityId} with agentId field
 * 
 * Phase 2 Enhancements:
 * - Rich message generation with templates
 * - Agent name and recorder attribution
 * - Tracker, Competition, KPI, and Game activity logging
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryConstraint,
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import { doc as docRef } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { ActivityType, AgentActivity, ActivityCategory } from '@/types/activity';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * Rich message parameters for template building
 */
export interface RichMessageParams {
  agentName: string;
  entityName: string;
  value?: string | number;
  points?: number;
  recorderName?: string;
}

/**
 * Log activity options
 */
export interface LogActivityOptions {
  agentName?: string;
  recorderId?: string;
  recorderName?: string;
  autoGenerateRichMessage?: boolean;
  value?: string | number;
}

/**
 * Rich message templates by activity type
 */
const RICH_MESSAGE_TEMPLATES: Record<ActivityType, string> = {
  // Tracker activities
  [ActivityType.TRACKER_CREATED]: '{{agentName}} created tracker "{{entityName}}"',
  [ActivityType.TRACKER_ENTRY_LOGGED]: '{{agentName}} logged {{value}} on "{{entityName}}"{{#if recorderName}} (by {{recorderName}}){{/if}}',
  [ActivityType.TRACKER_MILESTONE]: '{{agentName}} reached milestone "{{value}}" on "{{entityName}}"',
  
  // Competition activities
  [ActivityType.COMPETITION_JOINED]: '{{agentName}} joined competition "{{entityName}}"',
  [ActivityType.COMPETITION_COMPLETED]: '{{agentName}} completed competition "{{entityName}}"',
  [ActivityType.COMPETITION_STARTED]: '{{agentName}} started competition "{{entityName}}"',
  [ActivityType.COMPETITION_WON]: '{{agentName}} won competition "{{entityName}}"!',
  [ActivityType.COMPETITION_SCORE_LOGGED]: '{{agentName}} logged {{points}} points on "{{entityName}}"{{#if recorderName}} (by {{recorderName}}){{/if}}',
  [ActivityType.COMPETITION_MILESTONE]: '{{agentName}} reached milestone "{{value}}" on "{{entityName}}"',
  [ActivityType.COMPETITION_ABSENT]: '{{agentName}} was absent from "{{entityName}}"{{#if recorderName}} (logged by {{recorderName}}){{/if}}',
  
  // Score activities
  [ActivityType.SCORE_LOGGED]: '{{agentName}} logged {{points}} points{{#if entityName}} for "{{entityName}}"{{/if}}{{#if recorderName}} (by {{recorderName}}){{/if}}',
  [ActivityType.ACHIEVEMENT_EARNED]: '{{agentName}} earned achievement "{{entityName}}" (+{{points}} pts)',
  [ActivityType.MILESTONE_REACHED]: '{{agentName}} reached milestone "{{entityName}}" (+{{points}} pts)',
  [ActivityType.BADGE_EARNED]: '{{agentName}} earned badge "{{entityName}}"',
  
  // KPI activities
  [ActivityType.KPI_CREATED]: '{{agentName}} created KPI "{{entityName}}"',
  [ActivityType.KPI_UPDATED]: '{{agentName}} updated KPI "{{entityName}}" to {{value}}',
  [ActivityType.KPI_GOAL_REACHED]: '{{agentName}} reached goal on "{{entityName}}"! (+{{points}} pts)',
  [ActivityType.KPI_GOAL_ACHIEVED]: '{{agentName}} achieved goal on "{{entityName}}"! (+{{points}} pts)',
  [ActivityType.KPI_TREND_IMPROVED]: '{{agentName}} improved trend on "{{entityName}}" - {{value}}',
  
  // Game activities
  [ActivityType.GAME_PLAYED]: '{{agentName}} played "{{entityName}}"',
  [ActivityType.GAME_WON]: '{{agentName}} won "{{entityName}}" with {{value}} points!',
  [ActivityType.GAME_HIGH_SCORE]: '{{agentName}} achieved high score of {{value}} on "{{entityName}}"',
  [ActivityType.GAME_ACHIEVEMENT]: '{{agentName}} unlocked "{{value}}" on "{{entityName}}"',
  
  // Profile activities
  [ActivityType.PROFILE_UPDATED]: '{{agentName}} updated profile',
};

/**
 * Build a rich message from a template
 */
export function buildRichMessage(
  type: ActivityType,
  params: RichMessageParams
): string {
  const template = RICH_MESSAGE_TEMPLATES[type];
  
  if (!template) {
    return `${params.agentName} performed action on ${params.entityName}`;
  }
  
  let message = template
    .replace(/\{\{agentName\}\}/g, params.agentName)
    .replace(/\{\{entityName\}\}/g, params.entityName)
    .replace(/\{\{value\}\}/g, String(params.value ?? ''))
    .replace(/\{\{points\}\}/g, String(params.points ?? 0))
    .replace(/\{\{recorderName\}\}/g, params.recorderName ?? '');
  
  // Handle conditional blocks {{#if field}}...{{/if}}
  message = message.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, field, content) => {
    const fieldValue = params[field as keyof RichMessageParams];
    return fieldValue ? content : '';
  });
  
  return message;
}

/**
 * Firestore document structure for activities
 */
export interface FirestoreActivity {
  id?: string;
  agentId: string;
  type: ActivityType;
  timestamp: Timestamp;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  category: ActivityCategory;
  richMessage?: string;
  agentName?: string;
  recorderId?: string;
  recorderName?: string;
}

/**
 * Custom converter for Activity documents
 */
const activityConverter: FirestoreDataConverter<FirestoreActivity> = {
  toFirestore(activity: FirestoreActivity): DocumentData {
    return {
      agentId: activity.agentId,
      type: activity.type,
      timestamp: activity.timestamp,
      title: activity.title,
      description: activity.description || null,
      metadata: activity.metadata || {},
      category: activity.category,
      richMessage: activity.richMessage || null,
      agentName: activity.agentName || null,
      recorderId: activity.recorderId || null,
      recorderName: activity.recorderName || null,
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions
  ): FirestoreActivity {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      agentId: data.agentId,
      type: data.type as ActivityType,
      timestamp: data.timestamp as Timestamp,
      title: data.title,
      description: data.description,
      metadata: data.metadata || {},
      category: data.category,
      richMessage: data.richMessage,
      agentName: data.agentName,
      recorderId: data.recorderId,
      recorderName: data.recorderName,
    };
  },
};

/**
 * Get the flat activities collection reference
 * Uses flat collection pattern: activities/{activityId} with agentId field
 */
export function getActivitiesCollection() {
  return collection(db, 'activities').withConverter(activityConverter);
}

/**
 * Get the activities subcollection reference for an agent (DEPRECATED - kept for backward compatibility)
 * Now returns flat activities collection - agentId filtering is done via query
 */
export function getAgentActivitiesCollection(agentId: string) {
  // Return flat collection - caller should add where('agentId', '==', agentId) filter
  return getActivitiesCollection();
}

/**
 * Get agent name from Firestore users collection
 */
export async function getAgentName(agentId: string): Promise<string> {
  try {
    const userDocRef = docRef(db, 'users', agentId);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData?.name || 'Unknown Agent';
    }
    
    // Fallback: try agents collection
    const agentDocRef = docRef(db, 'agents', agentId);
    const agentDoc = await getDoc(agentDocRef);
    
    if (agentDoc.exists()) {
      const agentData = agentDoc.data();
      return agentData?.name || agentData?.displayName || 'Unknown Agent';
    }
    
    return 'Unknown Agent';
  } catch (error) {
    console.error(`Error fetching agent name for ${agentId}:`, error);
    return 'Unknown Agent';
  }
}

/**
 * Get current user info for recorder attribution
 * Returns null if no user is authenticated
 */
export function getRecorderInfo(): { id: string; name: string } | null {
  const user = auth?.currentUser;
  
  if (!user) {
    return null;
  }
  
  // Return basic info; name will be fetched separately if needed
  return {
    id: user.uid,
    name: user.displayName || user.email || 'Unknown User',
  };
}

/**
 * Get current authenticated user asynchronously
 */
export async function getCurrentUserAsync(): Promise<{ id: string; name: string } | null> {
  return new Promise((resolve) => {
    if (!auth) {
      resolve(null);
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      
      if (!user) {
        resolve(null);
        return;
      }
      
      resolve({
        id: user.uid,
        name: user.displayName || user.email || 'Unknown User',
      });
    });
  });
}

/**
 * Transform Firestore activity to the AgentActivity type used in the UI
 */
export function transformFirestoreActivity(firestoreActivity: FirestoreActivity): AgentActivity {
  const transformed = {
    id: firestoreActivity.id!,
    agentId: firestoreActivity.agentId,
    type: firestoreActivity.type,
    timestamp: firestoreActivity.timestamp?.toDate() || new Date(),
    title: firestoreActivity.title,
    description: firestoreActivity.description,
    metadata: firestoreActivity.metadata || {},
  } as AgentActivity;
  
  // Add richMessage if present (Phase 2)
  if (firestoreActivity.richMessage) {
    (transformed as any).richMessage = firestoreActivity.richMessage;
  }
  
  return transformed;
}

/**
 * Create an activity log entry
 */
export async function logActivity(
  agentId: string,
  type: ActivityType,
  title: string,
  metadata: Record<string, unknown> = {},
  description?: string,
  options?: LogActivityOptions
): Promise<string> {
  const activitiesRef = getAgentActivitiesCollection(agentId);
  
  // Get agent name if not provided
  let resolvedAgentName = options?.agentName;
  if (!resolvedAgentName) {
    resolvedAgentName = await getAgentName(agentId);
  }
  
  // Get recorder info if not provided
  const resolvedRecorderId = options?.recorderId;
  const resolvedRecorderName = options?.recorderName;
  
  // Generate rich message automatically if enabled
  let richMessage: string | undefined;
  if (options?.autoGenerateRichMessage !== false) {
    const entityName = (metadata?.trackerName as string) || 
                       (metadata?.competitionName as string) || 
                       (metadata?.kpiName as string) || 
                       (metadata?.gameName as string) || 
                       (metadata?.ruleName as string) || 
                       (metadata?.achievementName as string) || 
                       title;
    
    // Use value from options if provided, otherwise fall back to metadata
    const resolvedValue = options?.value ?? (metadata?.value as string | number | undefined);
    
    richMessage = buildRichMessage(type, {
      agentName: resolvedAgentName,
      entityName,
      value: resolvedValue,
      points: metadata?.points as number | undefined,
      recorderName: resolvedRecorderName,
    });
  }
  
  const activityData: FirestoreActivity = {
    agentId,
    type,
    timestamp: Timestamp.now(),
    title,
    description,
    metadata,
    category: getCategoryForActivityType(type),
    richMessage,
    agentName: resolvedAgentName,
    recorderId: resolvedRecorderId,
    recorderName: resolvedRecorderName,
  };
  
  const docRef = await addDoc(activitiesRef, activityData);
  console.log(`Activity logged: ${type} for agent ${agentId}`, docRef.id);
  
  return docRef.id;
}

/**
 * Get category for an activity type
 */
function getCategoryForActivityType(type: ActivityType): ActivityCategory {
  switch (type) {
    // Tracker activities
    case ActivityType.TRACKER_CREATED:
    case ActivityType.TRACKER_ENTRY_LOGGED:
    case ActivityType.TRACKER_MILESTONE:
      return 'trackers';
    // Competition activities (including enhanced)
    case ActivityType.COMPETITION_JOINED:
    case ActivityType.COMPETITION_COMPLETED:
    case ActivityType.COMPETITION_STARTED:
    case ActivityType.COMPETITION_WON:
    case ActivityType.COMPETITION_SCORE_LOGGED:
    case ActivityType.COMPETITION_MILESTONE:
    case ActivityType.COMPETITION_ABSENT:
      return 'competitions';
    // Score activities
    case ActivityType.SCORE_LOGGED:
    case ActivityType.ACHIEVEMENT_EARNED:
    case ActivityType.MILESTONE_REACHED:
    case ActivityType.BADGE_EARNED:
      return 'scores';
    // KPI activities (including enhanced)
    case ActivityType.KPI_CREATED:
    case ActivityType.KPI_UPDATED:
    case ActivityType.KPI_GOAL_REACHED:
    case ActivityType.KPI_GOAL_ACHIEVED:
    case ActivityType.KPI_TREND_IMPROVED:
      return 'kpis';
    // Game activities (including enhanced)
    case ActivityType.GAME_PLAYED:
    case ActivityType.GAME_WON:
    case ActivityType.GAME_HIGH_SCORE:
    case ActivityType.GAME_ACHIEVEMENT:
      return 'games';
    // Profile activities
    case ActivityType.PROFILE_UPDATED:
      return 'profile';
    default:
      return 'profile';
  }
}

/**
 * Query constraints builder for activities
 */
export function buildActivityQueryConstraints(
  options: {
    category?: ActivityCategory;
    dateRange?: { start: Date; end: Date };
    types?: ActivityType[];
    limitCount?: number;
  } = {}
): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];
  
  // Always order by timestamp descending (newest first)
  constraints.push(orderBy('timestamp', 'desc'));
  
  // Filter by category if specified
  if (options.category && options.category !== 'all') {
    constraints.push(where('category', '==', options.category));
  }
  
  // Filter by date range if specified
  if (options.dateRange) {
    constraints.push(
      where('timestamp', '>=', Timestamp.fromDate(options.dateRange.start)),
      where('timestamp', '<=', Timestamp.fromDate(options.dateRange.end))
    );
  }
  
  // Filter by activity types if specified
  if (options.types && options.types.length > 0) {
    constraints.push(where('type', 'in', options.types));
  }
  
  // Limit results if specified
  if (options.limitCount) {
    constraints.push(limit(options.limitCount));
  }
  
  return constraints;
}

/**
 * Fetch activities for an agent with optional filtering
 * Uses flat activities collection with agentId field filtering
 */
export async function fetchAgentActivities(
  agentId: string,
  options: {
    category?: ActivityCategory;
    dateRange?: { start: Date; end: Date };
    types?: ActivityType[];
    limitCount?: number;
  } = {}
): Promise<AgentActivity[]> {
  const activitiesRef = getActivitiesCollection();
  const constraints: QueryConstraint[] = [where('agentId', '==', agentId)];
  
  // Add other constraints
  const otherConstraints = buildActivityQueryConstraints(options);
  
  const q = query(activitiesRef, ...constraints, ...otherConstraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => transformFirestoreActivity(doc.data()));
}

/**
 * Activity logging helper functions for common actions
 * Phase 2 includes enhanced logging with rich messages and recorder attribution
 */
export const activityLoggers = {
  // =========================================================================
  // TRACKER LOGGERS (Phase 2)
  // =========================================================================

  /**
   * Log when a tracker is created
   */
  logTrackerCreated: async (
    agentId: string,
    agentName: string,
    trackerId: string,
    trackerName: string
  ) => {
    return logActivity(
      agentId,
      ActivityType.TRACKER_CREATED,
      'Tracker Created',
      { trackerId, trackerName },
      undefined,
      { agentName, autoGenerateRichMessage: true }
    );
  },

  /**
   * Log when a tracker entry is logged
   */
  logTrackerEntryLogged: async (
    agentId: string,
    agentName: string,
    trackerId: string,
    trackerName: string,
    value: number,
    recorderId?: string,
    recorderName?: string
  ) => {
    return logActivity(
      agentId,
      ActivityType.TRACKER_ENTRY_LOGGED,
      'Tracker Entry Logged',
      { trackerId, trackerName, value },
      undefined,
      {
        agentName,
        recorderId,
        recorderName,
        autoGenerateRichMessage: true,
      }
    );
  },

  /**
   * Log when a tracker milestone is reached
   */
  logTrackerMilestone: async (
    agentId: string,
    agentName: string,
    trackerId: string,
    trackerName: string,
    milestone: string
  ) => {
    return logActivity(
      agentId,
      ActivityType.TRACKER_MILESTONE,
      'Tracker Milestone Reached',
      { trackerId, trackerName, milestone },
      undefined,
      { agentName, autoGenerateRichMessage: true }
    );
  },

  // =========================================================================
  // COMPETITION LOGGERS (enhanced)
  // =========================================================================

  /**
   * Log when an agent joins a competition
   */
  logCompetitionJoined: async (
    agentId: string,
    agentName: string,
    competitionId: string,
    competitionName: string,
    teamName?: string
  ) => {
    return logActivity(
      agentId,
      ActivityType.COMPETITION_JOINED,
      'Joined Competition',
      { competitionId, competitionName, teamName },
      undefined,
      { agentName, autoGenerateRichMessage: true }
    );
  },

  /**
   * Log when an agent completes a competition
   */
  logCompetitionCompleted: async (
    agentId: string,
    agentName: string,
    competitionId: string,
    competitionName: string,
    finalScore: number,
    rank: number,
    teamName?: string
  ) => {
    return logActivity(
      agentId,
      ActivityType.COMPETITION_COMPLETED,
      'Competition Completed',
      { competitionId, competitionName, finalScore, rank, teamName },
      undefined,
      { agentName, autoGenerateRichMessage: true }
    );
  },

  /**
   * Log when a competition starts
   */
  logCompetitionStarted: async (
    agentId: string,
    agentName: string,
    competitionId: string,
    competitionName: string
  ) => {
    return logActivity(
      agentId,
      ActivityType.COMPETITION_STARTED,
      'Competition Started',
      { competitionId, competitionName },
      undefined,
      { agentName, autoGenerateRichMessage: true }
    );
  },

  /**
   * Log when an agent wins a competition (enhanced)
   */
  logCompetitionWon: async (
    agentId: string,
    agentName: string,
    competitionId: string,
    competitionName: string
  ) => {
    return logActivity(
      agentId,
      ActivityType.COMPETITION_WON,
      'Won Competition!',
      { competitionId, competitionName },
      undefined,
      { agentName, autoGenerateRichMessage: true }
    );
  },

  /**
   * Log when a competition score is logged (enhanced)
   */
  logCompetitionScoreLogged: async (
    agentId: string,
    agentName: string,
    competitionId: string,
    competitionName: string,
    points: number,
    recorderId?: string,
    recorderName?: string
  ) => {
    return logActivity(
      agentId,
      ActivityType.COMPETITION_SCORE_LOGGED,
      'Competition Score Logged',
      { competitionId, competitionName, points },
      undefined,
      {
        agentName,
        recorderId,
        recorderName,
        autoGenerateRichMessage: true,
      }
    );
  },

  /**
   * Log when a competition milestone is reached (enhanced)
   */
  logCompetitionMilestone: async (
    agentId: string,
    agentName: string,
    competitionId: string,
    competitionName: string,
    milestone: string
  ) => {
    return logActivity(
      agentId,
      ActivityType.COMPETITION_MILESTONE,
      'Competition Milestone Reached',
      { competitionId, competitionName, milestone },
      undefined,
      { agentName, autoGenerateRichMessage: true }
    );
  },

  /**
   * Log when an agent is absent from a competition (enhanced)
   */
  logCompetitionAbsent: async (
    agentId: string,
    agentName: string,
    competitionId: string,
    competitionName: string,
    recorderId?: string,
    recorderName?: string
  ) => {
    return logActivity(
      agentId,
      ActivityType.COMPETITION_ABSENT,
      'Competition Absent',
      { competitionId, competitionName },
      undefined,
      {
        agentName,
        recorderId,
        recorderName,
        autoGenerateRichMessage: true,
      }
    );
  },

  // =========================================================================
  // SCORE LOGGERS
  // =========================================================================

  /**
   * Log when a score is logged
   */
  logScoreLogged: async (
    agentId: string,
    agentName: string,
    ruleId: string,
    ruleName: string,
    points: number,
    value: number = 1,
    competitionId?: string,
    recorderId?: string,
    recorderName?: string
  ) => {
    return logActivity(
      agentId,
      ActivityType.SCORE_LOGGED,
      'Score Logged',
      { ruleId, ruleName, points, value, competitionId },
      undefined,
      {
        agentName,
        recorderId,
        recorderName,
        autoGenerateRichMessage: true,
      }
    );
  },

  /**
   * Log when an achievement is earned
   */
  logAchievementEarned: async (
    agentId: string,
    agentName: string,
    achievementId: string,
    achievementName: string,
    points: number
  ) => {
    return logActivity(
      agentId,
      ActivityType.ACHIEVEMENT_EARNED,
      'Achievement Earned',
      { achievementId, achievementName, points },
      undefined,
      { agentName, autoGenerateRichMessage: true }
    );
  },

  /**
   * Log when a milestone is reached
   */
  logMilestoneReached: async (
    agentId: string,
    agentName: string,
    milestoneId: string,
    milestoneName: string,
    points: number
  ) => {
    return logActivity(
      agentId,
      ActivityType.MILESTONE_REACHED,
      'Milestone Reached',
      { milestoneId, milestoneName, points },
      undefined,
      { agentName, autoGenerateRichMessage: true }
    );
  },

  // =========================================================================
  // KPI LOGGERS (enhanced)
  // =========================================================================

  /**
   * Log when a KPI is created (enhanced)
   */
  logKpiCreated: async (
    agentId: string,
    agentName: string,
    kpiId: string,
    kpiName: string
  ) => {
    return logActivity(
      agentId,
      ActivityType.KPI_CREATED,
      'KPI Created',
      { kpiId, kpiName },
      undefined,
      { agentName, autoGenerateRichMessage: true }
    );
  },

  /**
   * Log when a KPI is updated
   */
  logKpiUpdated: async (
    agentId: string,
    agentName: string,
    kpiId: string,
    kpiName: string,
    previousValue: number,
    newValue: number,
    targetValue?: number
  ) => {
    return logActivity(
      agentId,
      ActivityType.KPI_UPDATED,
      'KPI Updated',
      { kpiId, kpiName, previousValue, newValue, targetValue, value: newValue },
      undefined,
      { agentName, autoGenerateRichMessage: true }
    );
  },

  /**
   * Log when a KPI goal is reached
   */
  logKpiGoalReached: async (
    agentId: string,
    agentName: string,
    kpiId: string,
    kpiName: string,
    targetValue: number
  ) => {
    return logActivity(
      agentId,
      ActivityType.KPI_GOAL_REACHED,
      'KPI Goal Reached!',
      { kpiId, kpiName, targetValue, points: 0 },
      undefined,
      { agentName, autoGenerateRichMessage: true }
    );
  },

  /**
   * Log when a KPI trend is improved (enhanced)
   */
  logKpiTrendImproved: async (
    agentId: string,
    agentName: string,
    kpiId: string,
    kpiName: string,
    improvement: string
  ) => {
    return logActivity(
      agentId,
      ActivityType.KPI_TREND_IMPROVED,
      'KPI Trend Improved',
      { kpiId, kpiName, improvement },
      undefined,
      { agentName, value: improvement, autoGenerateRichMessage: true }
    );
  },

  // =========================================================================
  // GAME LOGGERS (enhanced)
  // =========================================================================

  /**
   * Log when a game is played
   */
  logGamePlayed: async (
    agentId: string,
    agentName: string,
    gameId: string,
    gameName: string,
    result: 'win' | 'loss' | 'draw',
    score?: number
  ) => {
    return logActivity(
      agentId,
      ActivityType.GAME_PLAYED,
      'Played a Game',
      { gameId, gameName, result, score },
      undefined,
      { agentName, autoGenerateRichMessage: true }
    );
  },

  /**
   * Log when a game is won
   */
  logGameWon: async (
    agentId: string,
    agentName: string,
    gameId: string,
    gameName: string,
    score: number
  ) => {
    return logActivity(
      agentId,
      ActivityType.GAME_WON,
      'Won a Game!',
      { gameId, gameName, result: 'win', score, value: score },
      undefined,
      { agentName, autoGenerateRichMessage: true }
    );
  },

  /**
   * Log when a game high score is achieved (enhanced)
   */
  logGameHighScore: async (
    agentId: string,
    agentName: string,
    gameId: string,
    gameName: string,
    score: number
  ) => {
    return logActivity(
      agentId,
      ActivityType.GAME_HIGH_SCORE,
      'Game High Score!',
      { gameId, gameName, score, value: score },
      undefined,
      { agentName, autoGenerateRichMessage: true }
    );
  },

  /**
   * Log when a game achievement is unlocked (enhanced)
   */
  logGameAchievement: async (
    agentId: string,
    agentName: string,
    gameId: string,
    gameName: string,
    achievementName: string
  ) => {
    return logActivity(
      agentId,
      ActivityType.GAME_ACHIEVEMENT,
      'Game Achievement Unlocked',
      { gameId, gameName, achievementName, value: achievementName },
      undefined,
      { agentName, autoGenerateRichMessage: true }
    );
  },

  // =========================================================================
  // BADGE & PROFILE LOGGERS
  // =========================================================================

  /**
   * Log when a badge is earned
   */
  logBadgeEarned: async (
    agentId: string,
    agentName: string,
    badgeId: string,
    badgeName: string,
    points: number
  ) => {
    return logActivity(
      agentId,
      ActivityType.BADGE_EARNED,
      'Badge Earned',
      { badgeId, badgeName, points },
      undefined,
      { agentName, autoGenerateRichMessage: true }
    );
  },

  /**
   * Log when profile is updated
   */
  logProfileUpdated: async (
    agentId: string,
    agentName: string,
    fieldsUpdated: string[]
  ) => {
    return logActivity(
      agentId,
      ActivityType.PROFILE_UPDATED,
      'Profile Updated',
      { fieldsUpdated },
      undefined,
      { agentName, autoGenerateRichMessage: true }
    );
  },
};

// =========================================================================
// STANDALONE LOGGER FUNCTIONS (Phase 2)
// These functions can be imported and used directly without the activityLoggers object
// =========================================================================

/**
 * Tracker loggers (Phase 2)
 */
export async function logTrackerCreated(
  agentId: string,
  agentName: string,
  trackerId: string,
  trackerName: string
): Promise<string> {
  return activityLoggers.logTrackerCreated(agentId, agentName, trackerId, trackerName);
}

export async function logTrackerEntryLogged(
  agentId: string,
  agentName: string,
  trackerId: string,
  trackerName: string,
  value: number,
  recorderId?: string,
  recorderName?: string
): Promise<string> {
  return activityLoggers.logTrackerEntryLogged(agentId, agentName, trackerId, trackerName, value, recorderId, recorderName);
}

export async function logTrackerMilestone(
  agentId: string,
  agentName: string,
  trackerId: string,
  trackerName: string,
  milestone: string
): Promise<string> {
  return activityLoggers.logTrackerMilestone(agentId, agentName, trackerId, trackerName, milestone);
}

/**
 * Competition loggers (enhanced)
 */
export async function logCompetitionWon(
  agentId: string,
  agentName: string,
  competitionId: string,
  competitionName: string
): Promise<string> {
  return activityLoggers.logCompetitionWon(agentId, agentName, competitionId, competitionName);
}

export async function logCompetitionScoreLogged(
  agentId: string,
  agentName: string,
  competitionId: string,
  competitionName: string,
  points: number,
  recorderId?: string,
  recorderName?: string
): Promise<string> {
  return activityLoggers.logCompetitionScoreLogged(agentId, agentName, competitionId, competitionName, points, recorderId, recorderName);
}

export async function logCompetitionMilestone(
  agentId: string,
  agentName: string,
  competitionId: string,
  competitionName: string,
  milestone: string
): Promise<string> {
  return activityLoggers.logCompetitionMilestone(agentId, agentName, competitionId, competitionName, milestone);
}

export async function logCompetitionAbsent(
  agentId: string,
  agentName: string,
  competitionId: string,
  competitionName: string,
  recorderId?: string,
  recorderName?: string
): Promise<string> {
  return activityLoggers.logCompetitionAbsent(agentId, agentName, competitionId, competitionName, recorderId, recorderName);
}

/**
 * KPI loggers (enhanced)
 */
export async function logKpiCreated(
  agentId: string,
  agentName: string,
  kpiId: string,
  kpiName: string
): Promise<string> {
  return activityLoggers.logKpiCreated(agentId, agentName, kpiId, kpiName);
}

export async function logKpiUpdated(
  agentId: string,
  agentName: string,
  kpiId: string,
  kpiName: string,
  previousValue: number,
  newValue: number,
  targetValue?: number
): Promise<string> {
  return activityLoggers.logKpiUpdated(agentId, agentName, kpiId, kpiName, previousValue, newValue, targetValue);
}

export async function logKpiGoalAchieved(
  agentId: string,
  agentName: string,
  kpiId: string,
  kpiName: string
): Promise<string> {
  return activityLoggers.logKpiGoalReached(agentId, agentName, kpiId, kpiName, 0);
}

export async function logKpiTrendImproved(
  agentId: string,
  agentName: string,
  kpiId: string,
  kpiName: string,
  improvement: string
): Promise<string> {
  return activityLoggers.logKpiTrendImproved(agentId, agentName, kpiId, kpiName, improvement);
}

/**
 * Game loggers (enhanced)
 */
export async function logGameHighScore(
  agentId: string,
  agentName: string,
  gameId: string,
  gameName: string,
  score: number
): Promise<string> {
  return activityLoggers.logGameHighScore(agentId, agentName, gameId, gameName, score);
}

export async function logGameAchievement(
  agentId: string,
  agentName: string,
  gameId: string,
  gameName: string,
  achievementName: string
): Promise<string> {
  return activityLoggers.logGameAchievement(agentId, agentName, gameId, gameName, achievementName);
}
