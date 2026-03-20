/**
 * Activity Types for Agent Activity History
 * 
 * This module defines the types and interfaces for the agent activity tracking system.
 * Currently uses mock/placeholder data since backend decision is pending.
 */

// Activity type enumeration
export enum ActivityType {
  // Tracker activities (Phase 2)
  TRACKER_CREATED = 'tracker_created',
  TRACKER_ENTRY_LOGGED = 'tracker_entry_logged',
  TRACKER_MILESTONE = 'tracker_milestone',
  
  // Competition activities (enhanced)
  COMPETITION_JOINED = 'competition_joined',
  COMPETITION_COMPLETED = 'competition_completed',
  COMPETITION_STARTED = 'competition_started',
  COMPETITION_WON = 'competition_won',
  COMPETITION_SCORE_LOGGED = 'competition_score_logged',
  COMPETITION_MILESTONE = 'competition_milestone',
  COMPETITION_ABSENT = 'competition_absent',
  
  // Score activities
  SCORE_LOGGED = 'score_logged',
  ACHIEVEMENT_EARNED = 'achievement_earned',
  MILESTONE_REACHED = 'milestone_reached',
  
  // KPI activities (enhanced)
  KPI_CREATED = 'kpi_created',
  KPI_UPDATED = 'kpi_updated',
  KPI_GOAL_REACHED = 'kpi_goal_reached',
  KPI_GOAL_ACHIEVED = 'kpi_goal_achieved',
  KPI_TREND_IMPROVED = 'kpi_trend_improved',
  
  // Game activities (enhanced)
  GAME_PLAYED = 'game_played',
  GAME_WON = 'game_won',
  GAME_HIGH_SCORE = 'game_high_score',
  GAME_ACHIEVEMENT = 'game_achievement',
  
  // General activities
  PROFILE_UPDATED = 'profile_updated',
  BADGE_EARNED = 'badge_earned',
}

// Activity type display information with icons and colors
export const ActivityTypeConfig: Record<ActivityType, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}> = {
  // Tracker activities
  [ActivityType.TRACKER_CREATED]: {
    label: 'Tracker Created',
    icon: 'Target',
    color: 'text-teal-500',
    bgColor: 'bg-teal-500/20',
  },
  [ActivityType.TRACKER_ENTRY_LOGGED]: {
    label: 'Tracker Entry Logged',
    icon: 'CheckCircle',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/20',
  },
  [ActivityType.TRACKER_MILESTONE]: {
    label: 'Tracker Milestone',
    icon: 'Flag',
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
  },
  // Competition activities
  [ActivityType.COMPETITION_JOINED]: {
    label: 'Joined Competition',
    icon: 'Trophy',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
  },
  [ActivityType.COMPETITION_COMPLETED]: {
    label: 'Competition Completed',
    icon: 'Trophy',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
  },
  [ActivityType.COMPETITION_STARTED]: {
    label: 'Competition Started',
    icon: 'Trophy',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
  },
  [ActivityType.COMPETITION_WON]: {
    label: 'Competition Won',
    icon: 'Crown',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/20',
  },
  [ActivityType.COMPETITION_SCORE_LOGGED]: {
    label: 'Competition Score Logged',
    icon: 'Target',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
  },
  [ActivityType.COMPETITION_MILESTONE]: {
    label: 'Competition Milestone',
    icon: 'Flag',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
  },
  [ActivityType.COMPETITION_ABSENT]: {
    label: 'Competition Absent',
    icon: 'CalendarX',
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/20',
  },
  // Score activities
  [ActivityType.SCORE_LOGGED]: {
    label: 'Score Logged',
    icon: 'Target',
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
  },
  [ActivityType.ACHIEVEMENT_EARNED]: {
    label: 'Achievement Earned',
    icon: 'Award',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/20',
  },
  [ActivityType.MILESTONE_REACHED]: {
    label: 'Milestone Reached',
    icon: 'TrendingUp',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/20',
  },
  // KPI activities
  [ActivityType.KPI_CREATED]: {
    label: 'KPI Created',
    icon: 'BarChart3',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/20',
  },
  [ActivityType.KPI_UPDATED]: {
    label: 'KPI Updated',
    icon: 'BarChart3',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/20',
  },
  [ActivityType.KPI_GOAL_REACHED]: {
    label: 'KPI Goal Reached',
    icon: 'Target',
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
  },
  [ActivityType.KPI_GOAL_ACHIEVED]: {
    label: 'KPI Goal Achieved',
    icon: 'CheckCircle',
    color: 'text-green-600',
    bgColor: 'bg-green-600/20',
  },
  [ActivityType.KPI_TREND_IMPROVED]: {
    label: 'KPI Trend Improved',
    icon: 'TrendingUp',
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
  },
  // Game activities
  [ActivityType.GAME_PLAYED]: {
    label: 'Game Played',
    icon: 'Gamepad2',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/20',
  },
  [ActivityType.GAME_WON]: {
    label: 'Game Won',
    icon: 'Swords',
    color: 'text-red-500',
    bgColor: 'bg-red-500/20',
  },
  [ActivityType.GAME_HIGH_SCORE]: {
    label: 'Game High Score',
    icon: 'Star',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
  },
  [ActivityType.GAME_ACHIEVEMENT]: {
    label: 'Game Achievement',
    icon: 'Trophy',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/20',
  },
  // Profile activities
  [ActivityType.PROFILE_UPDATED]: {
    label: 'Profile Updated',
    icon: 'User',
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/20',
  },
  [ActivityType.BADGE_EARNED]: {
    label: 'Badge Earned',
    icon: 'Medal',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/20',
  },
};

// Activity category for filtering
export type ActivityCategory = 'all' | 'trackers' | 'competitions' | 'scores' | 'kpis' | 'games' | 'profile';

// Map activity types to categories
export const ActivityTypeCategories: Record<ActivityType, ActivityCategory> = {
  // Tracker activities
  [ActivityType.TRACKER_CREATED]: 'trackers',
  [ActivityType.TRACKER_ENTRY_LOGGED]: 'trackers',
  [ActivityType.TRACKER_MILESTONE]: 'trackers',
  // Competition activities
  [ActivityType.COMPETITION_JOINED]: 'competitions',
  [ActivityType.COMPETITION_COMPLETED]: 'competitions',
  [ActivityType.COMPETITION_STARTED]: 'competitions',
  [ActivityType.COMPETITION_WON]: 'competitions',
  [ActivityType.COMPETITION_SCORE_LOGGED]: 'competitions',
  [ActivityType.COMPETITION_MILESTONE]: 'competitions',
  [ActivityType.COMPETITION_ABSENT]: 'competitions',
  // Score activities
  [ActivityType.SCORE_LOGGED]: 'scores',
  [ActivityType.ACHIEVEMENT_EARNED]: 'scores',
  [ActivityType.MILESTONE_REACHED]: 'scores',
  [ActivityType.BADGE_EARNED]: 'scores',
  // KPI activities
  [ActivityType.KPI_CREATED]: 'kpis',
  [ActivityType.KPI_UPDATED]: 'kpis',
  [ActivityType.KPI_GOAL_REACHED]: 'kpis',
  [ActivityType.KPI_GOAL_ACHIEVED]: 'kpis',
  [ActivityType.KPI_TREND_IMPROVED]: 'kpis',
  // Game activities
  [ActivityType.GAME_PLAYED]: 'games',
  [ActivityType.GAME_WON]: 'games',
  [ActivityType.GAME_HIGH_SCORE]: 'games',
  [ActivityType.GAME_ACHIEVEMENT]: 'games',
  // Profile activities
  [ActivityType.PROFILE_UPDATED]: 'profile',
};

// Category display labels
export const ActivityCategoryLabels: Record<ActivityCategory, string> = {
  all: 'All Activities',
  trackers: 'Trackers',
  competitions: 'Competitions',
  scores: 'Scores & Achievements',
  kpis: 'KPIs',
  games: 'Mini Games',
  profile: 'Profile',
};

// Message template field types
export type MessageTemplateField = 'agentName' | 'entityName' | 'value' | 'points' | 'recorderName';

// Activity message templates for generating rich messages
export const ActivityMessageTemplates: Record<ActivityType, {
  template: string;
  requiresRecorder: boolean;
  fields: MessageTemplateField[];
}> = {
  // Tracker activities
  [ActivityType.TRACKER_CREATED]: {
    template: "{agentName} created a new tracker: {entityName}",
    requiresRecorder: true,
    fields: ['agentName', 'entityName', 'recorderName'],
  },
  [ActivityType.TRACKER_ENTRY_LOGGED]: {
    template: "{agentName} logged an entry for {entityName}",
    requiresRecorder: true,
    fields: ['agentName', 'entityName', 'recorderName'],
  },
  [ActivityType.TRACKER_MILESTONE]: {
    template: "{agentName} reached a milestone in {entityName}: {value}",
    requiresRecorder: false,
    fields: ['agentName', 'entityName', 'value'],
  },
  
  // Competition activities
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
  [ActivityType.COMPETITION_STARTED]: {
    template: "{agentName} started {entityName}",
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
    fields: ['agentName', 'entityName', 'points'],
  },
  [ActivityType.COMPETITION_MILESTONE]: {
    template: "{agentName} reached a milestone in {entityName}: {value}",
    requiresRecorder: false,
    fields: ['agentName', 'entityName', 'value'],
  },
  [ActivityType.COMPETITION_ABSENT]: {
    template: "{agentName} was absent from {entityName}",
    requiresRecorder: false,
    fields: ['agentName', 'entityName'],
  },
  
  // Score activities
  [ActivityType.SCORE_LOGGED]: {
    template: "{agentName} logged {points} points",
    requiresRecorder: false,
    fields: ['agentName', 'points'],
  },
  [ActivityType.ACHIEVEMENT_EARNED]: {
    template: "{agentName} earned an achievement: {entityName}",
    requiresRecorder: false,
    fields: ['agentName', 'entityName'],
  },
  [ActivityType.MILESTONE_REACHED]: {
    template: "{agentName} reached milestone: {entityName}",
    requiresRecorder: false,
    fields: ['agentName', 'entityName'],
  },
  [ActivityType.BADGE_EARNED]: {
    template: "{agentName} earned badge: {entityName}",
    requiresRecorder: false,
    fields: ['agentName', 'entityName'],
  },
  
  // KPI activities
  [ActivityType.KPI_CREATED]: {
    template: "{agentName} created KPI: {entityName}",
    requiresRecorder: false,
    fields: ['agentName', 'entityName'],
  },
  [ActivityType.KPI_UPDATED]: {
    template: "{agentName} updated KPI {entityName} to {value}",
    requiresRecorder: false,
    fields: ['agentName', 'entityName', 'value'],
  },
  [ActivityType.KPI_GOAL_REACHED]: {
    template: "{agentName} reached goal for {entityName}!",
    requiresRecorder: false,
    fields: ['agentName', 'entityName'],
  },
  [ActivityType.KPI_GOAL_ACHIEVED]: {
    template: "{agentName} achieved KPI goal: {entityName}",
    requiresRecorder: false,
    fields: ['agentName', 'entityName'],
  },
  [ActivityType.KPI_TREND_IMPROVED]: {
    template: "{agentName}'s KPI trend improved: {entityName}",
    requiresRecorder: false,
    fields: ['agentName', 'entityName'],
  },
  
  // Game activities
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
    template: "{agentName} set a high score in {entityName}: {value}",
    requiresRecorder: false,
    fields: ['agentName', 'entityName', 'value'],
  },
  [ActivityType.GAME_ACHIEVEMENT]: {
    template: "{agentName} unlocked achievement in {entityName}: {value}",
    requiresRecorder: false,
    fields: ['agentName', 'entityName', 'value'],
  },
  
  // Profile activities
  [ActivityType.PROFILE_UPDATED]: {
    template: "{agentName} updated their profile",
    requiresRecorder: false,
    fields: ['agentName'],
  },
};

// Base activity interface
export interface BaseActivity {
  id: string;
  agentId: string;
  type: ActivityType;
  timestamp: Date;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  // NEW: Enhanced fields for richer activity display
  richMessage?: string;           // Pre-formatted rich message
  agentName?: string;             // Denormalized agent name
  recorderId?: string;            // Who logged this activity
  recorderName?: string;          // Recorder's name
}

// Competition activity types
export interface CompetitionActivity extends BaseActivity {
  type: ActivityType.COMPETITION_JOINED | ActivityType.COMPETITION_COMPLETED | ActivityType.COMPETITION_STARTED;
  metadata: {
    competitionId: string;
    competitionName: string;
    teamName?: string;
    finalScore?: number;
    rank?: number;
  };
}

// Score activity types
export interface ScoreActivity extends BaseActivity {
  type: ActivityType.SCORE_LOGGED | ActivityType.ACHIEVEMENT_EARNED | ActivityType.MILESTONE_REACHED | ActivityType.BADGE_EARNED;
  metadata: {
    ruleId?: string;
    ruleName?: string;
    points: number;
    value?: number;
    competitionId?: string;
  };
}

// KPI activity types
export interface KpiActivity extends BaseActivity {
  type: ActivityType.KPI_UPDATED | ActivityType.KPI_GOAL_REACHED;
  metadata: {
    kpiId: string;
    kpiName: string;
    previousValue?: number;
    newValue: number;
    targetValue?: number;
  };
}

// Game activity types
export interface GameActivity extends BaseActivity {
  type: ActivityType.GAME_PLAYED | ActivityType.GAME_WON;
  metadata: {
    gameId: string;
    gameName: string;
    result?: 'win' | 'loss' | 'draw';
    score?: number;
  };
}

// Profile activity types
export interface ProfileActivity extends BaseActivity {
  type: ActivityType.PROFILE_UPDATED;
  metadata: {
    fieldsUpdated: string[];
  };
}

// Tracker activity types (Phase 2)
export interface TrackerActivity extends BaseActivity {
  type: ActivityType.TRACKER_CREATED | ActivityType.TRACKER_ENTRY_LOGGED | ActivityType.TRACKER_MILESTONE;
  metadata: {
    trackerId: string;
    trackerName: string;
    value?: number;
    milestone?: string;
    recorderId?: string;
    recorderName?: string;
  };
}

// Enhanced Competition activity types (Phase 2)
export interface EnhancedCompetitionActivity extends BaseActivity {
  type: ActivityType.COMPETITION_WON | ActivityType.COMPETITION_SCORE_LOGGED | ActivityType.COMPETITION_MILESTONE | ActivityType.COMPETITION_ABSENT;
  metadata: {
    competitionId: string;
    competitionName: string;
    points?: number;
    milestone?: string;
    recorderId?: string;
    recorderName?: string;
  };
}

// Enhanced KPI activity types (Phase 2)
export interface EnhancedKpiActivity extends BaseActivity {
  type: ActivityType.KPI_CREATED | ActivityType.KPI_TREND_IMPROVED;
  metadata: {
    kpiId: string;
    kpiName: string;
    improvement?: string;
  };
}

// Enhanced Game activity types (Phase 2)
export interface EnhancedGameActivity extends BaseActivity {
  type: ActivityType.GAME_HIGH_SCORE | ActivityType.GAME_ACHIEVEMENT;
  metadata: {
    gameId: string;
    gameName: string;
    score?: number;
    achievementName?: string;
  };
}

// Union type for all activities
export type AgentActivity = 
  | CompetitionActivity 
  | ScoreActivity 
  | KpiActivity 
  | GameActivity 
  | ProfileActivity
  | TrackerActivity
  | EnhancedCompetitionActivity
  | EnhancedKpiActivity
  | EnhancedGameActivity;

// Activity filter options
export interface ActivityFilterOptions {
  category?: ActivityCategory;
  dateRange?: {
    start: Date;
    end: Date;
  };
  types?: ActivityType[];
  searchQuery?: string;
}

// Pagination options
export interface PaginationOptions {
  page: number;
  pageSize: number;
  total?: number;
}

// Activity list response
export interface ActivityListResponse {
  activities: AgentActivity[];
  pagination: PaginationOptions;
  hasMore: boolean;
}

// Date range presets
export type DateRangePreset = 'all' | 'today' | 'week' | 'month' | 'quarter';

// Helper function to get activities by category
export function getActivitiesByCategory(
  activities: AgentActivity[],
  category: ActivityCategory
): AgentActivity[] {
  if (category === 'all') return activities;
  return activities.filter(activity => ActivityTypeCategories[activity.type] === category);
}

// Helper function to filter activities by date range
export function filterActivitiesByDateRange(
  activities: AgentActivity[],
  start: Date,
  end: Date
): AgentActivity[] {
  return activities.filter(activity => {
    const timestamp = new Date(activity.timestamp);
    return timestamp >= start && timestamp <= end;
  });
}

// Helper function to paginate activities
export function paginateActivities(
  activities: AgentActivity[],
  page: number,
  pageSize: number
): { activities: AgentActivity[]; total: number; hasMore: boolean } {
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedActivities = activities.slice(startIndex, endIndex);
  
  return {
    activities: paginatedActivities,
    total: activities.length,
    hasMore: endIndex < activities.length,
  };
}
