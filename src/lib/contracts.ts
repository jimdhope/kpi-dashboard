export const USER_ROLES = [
  "admin",
  "campaignManager",
  "podManager",
  "teamLeader",
  "competitionRunner",
  "agent",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ADMIN_ROLES: UserRole[] = ["admin"];

export const COMPETITION_EDITOR_ROLES: UserRole[] = [
  "admin",
  "campaignManager",
  "podManager",
  "teamLeader",
  "competitionRunner",
];

export interface AppUser {
  id: string;
  firebaseUid?: string | null;
  email: string;
  name: string;
  roles: UserRole[];
  podIds?: string[];  // Pod memberships for the user
  avatarUrl?: string | null;
  avatarInitials?: string | null;
  avatarBgColor?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionPayload {
  authenticated: boolean;
  user: AppUser | null;
  expiresAt: string | null;
}

export const NOTIFICATION_TYPES = [
  "competition_reminder",
  "score_achievement",
  "team_update",
  "system_alert",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_PRIORITIES = ["low", "medium", "high"] as const;

export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export const TEAMS_WEBHOOK_DIRECTIONS = ["incoming", "outgoing"] as const;

export type TeamsWebhookDirection = (typeof TEAMS_WEBHOOK_DIRECTIONS)[number];

export const TEAMS_CHANNEL_CATEGORIES = ["daily_summary", "leaderboard", "alert", "campaign", "custom"] as const;

export type TeamsChannelCategory = (typeof TEAMS_CHANNEL_CATEGORIES)[number];

export const TEAMS_AUTOMATION_TRIGGERS = [
  "incomingWebhookReceived",
  "performanceLogged",
  "competitionScoreLogged",
] as const;

export type TeamsAutomationTrigger = (typeof TEAMS_AUTOMATION_TRIGGERS)[number];

export const TEAMS_AUTOMATION_SCOPES = ["global", "campaign", "pod"] as const;

export type TeamsAutomationScope = (typeof TEAMS_AUTOMATION_SCOPES)[number];

export const TEAMS_AUTOMATION_MODES = ["event", "oneTime", "recurring"] as const;

export type TeamsAutomationMode = (typeof TEAMS_AUTOMATION_MODES)[number];

export const TEAMS_AUTOMATION_CONDITION_EVENTS = [
  "performanceLogged",
  "competitionScoreLogged",
] as const;

export type TeamsAutomationConditionEvent = (typeof TEAMS_AUTOMATION_CONDITION_EVENTS)[number];

export const TEAMS_AUTOMATION_CONDITION_METRICS = ["count", "totalValue"] as const;

export type TeamsAutomationConditionMetric = (typeof TEAMS_AUTOMATION_CONDITION_METRICS)[number];

export const TEAMS_AUTOMATION_DELIVERY_FORMATS = [
  "messageCard",
  "adaptiveCard",
  "adaptiveCardWithImage",
] as const;

export type TeamsAutomationDeliveryFormat = (typeof TEAMS_AUTOMATION_DELIVERY_FORMATS)[number];

// Human-readable labels for UI display
export const TEAMS_CHANNEL_CATEGORY_LABELS: Record<TeamsChannelCategory, string> = {
  daily_summary: "Daily Summary",
  leaderboard: "Leaderboard",
  alert: "Alert",
  campaign: "Campaign",
  custom: "Custom",
};

export const TEAMS_WEBHOOK_DIRECTION_LABELS: Record<TeamsWebhookDirection, string> = {
  incoming: "Incoming",
  outgoing: "Outgoing",
};

export const TEAMS_AUTOMATION_TRIGGER_LABELS: Record<TeamsAutomationTrigger, string> = {
  incomingWebhookReceived: "Incoming Webhook Received",
  performanceLogged: "Performance Logged",
  competitionScoreLogged: "Competition Score Logged",
};

export const TEAMS_AUTOMATION_SCOPE_LABELS: Record<TeamsAutomationScope, string> = {
  global: "Global (All)",
  campaign: "Specific Campaign",
  pod: "Specific Pod",
};

export const TEAMS_AUTOMATION_MODE_LABELS: Record<TeamsAutomationMode, string> = {
  event: "When Event Happens",
  oneTime: "One Time",
  recurring: "Recurring Schedule",
};

export const TEAMS_AUTOMATION_CONDITION_METRIC_LABELS: Record<TeamsAutomationConditionMetric, string> = {
  count: "Number of Events",
  totalValue: "Total Value",
};

export const TEAMS_AUTOMATION_DELIVERY_FORMAT_LABELS: Record<TeamsAutomationDeliveryFormat, string> = {
  messageCard: "Simple Message Card",
  adaptiveCard: "Adaptive Card",
  adaptiveCardWithImage: "Adaptive Card with Image",
};

export const TEAMS_REPEAT_INTERVALS = [
  { value: 60, label: "Every hour" },
  { value: 240, label: "Every 4 hours" },
  { value: 480, label: "Every 8 hours" },
  { value: 1440, label: "Daily" },
  { value: 10080, label: "Weekly" },
] as const;

// Options for "activity within X minutes" condition (shorter intervals)
export const TEAMS_ACTIVITY_INTERVALS = [
  { value: 5, label: "5 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
] as const;

// Options for recurring schedule intervals
export const TEAMS_RECURRING_INTERVALS = [
  { value: 15, label: "Every 15 minutes" },
  { value: 30, label: "Every 30 minutes" },
  { value: 60, label: "Every hour" },
  { value: 180, label: "Every 3 hours" },
  { value: 360, label: "Every 6 hours" },
  { value: 720, label: "Every 12 hours" },
  { value: 1440, label: "Daily" },
  { value: 10080, label: "Weekly" },
] as const;

// Leaderboard data for Teams workflow preview
export interface DashboardLeaderboard {
  competitionId: string;
  name: string;
  rankings: Array<{
    id: string;
    competitionId: string;
    userId: string;
    userName: string;
    score: number;
    rank: number;
    isCurrent: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface TeamStandingsData {
  teams: Array<{
    id: string;
    name: string;
    emoji?: string;
    score: number;
    rank: number;
  }>;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  actionUrl: string | null;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface AppCampaign {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  incomingWebhookId: string | null;
  outgoingWebhookId: string | null;
  incomingWebhookName: string | null;
  outgoingWebhookName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppPod {
  id: string;
  campaignId: string | null;
  campaignName: string | null;
  incomingWebhookId: string | null;
  outgoingWebhookId: string | null;
  incomingWebhookName: string | null;
  outgoingWebhookName: string | null;
  name: string;
  description: string | null;
  memberCount: number;
  members: PodMemberSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface PodMemberSummary {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
}

export interface PodMembershipOption {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  podIds: string[];
}

export interface DashboardSummary {
  user: AppUser;
  assignedPods: AppPod[];
  recentActivities: ActivityRecord[];
  dailyKpiSum: number;
  podComparisons?: Array<{
    id: string;
    name: string;
    dailyScore: number;
  }>;
  leaderboard?: any;
  metrics: {
    campaigns: number;
    pods: number;
    users: number;
  } | null;
}

export interface TrackerKpiRecord {
  id: string;
  campaignId: string | null;
  campaignName: string | null;
  name: string;
  unit: string | null;
  targetValue: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface KpiRecord {
  id: string;
  name: string;
  initials: string;
  type: "number" | "percentage" | "scoreOutOf";
  maxValue: number | null;
  sortOrder: "desc" | "asc";
  passFailCriteriaEnabled: boolean;
  passFailOperator: "gte" | "lte" | null;
  passFailValue: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface KpiLogRecord {
  id: string;
  kpiId: string;
  kpiName: string;
  kpiInitials: string;
  userId: string | null;
  userName: string | null;
  value: number;
  loggedAt: string;
  createdAt: string;
}

export interface PerformanceLogRecord {
  id: string;
  trackerKpiId: string;
  trackerName: string;
  userId: string | null;
  userName: string | null;
  value: number;
  loggedAt: string;
  createdAt: string;
}

export interface PerformanceTrackerSummary {
  trackerId: string;
  trackerName: string;
  unit: string | null;
  targetValue: number | null;
  totalValue: number;
  logCount: number;
}

export interface PerformanceUserSummary {
  userId: string;
  userName: string;
  totalValue: number;
  logCount: number;
}

export interface PerformanceOverview {
  logs: PerformanceLogRecord[];
  trackerSummaries: PerformanceTrackerSummary[];
  userSummaries: PerformanceUserSummary[];
}

export interface CompetitionRuleRecord {
  id: string;
  title: string;
  points: number;
}

export interface CompetitionTeamRecord {
  id: string;
  name: string;
}

export interface CompetitionEntryRecord {
  id: string;
  userId: string | null;
  userName: string | null;
  score: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompetitionRecord {
  id: string;
  name: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  rules: CompetitionRuleRecord[];
  teams: CompetitionTeamRecord[];
  entries: CompetitionEntryRecord[];
}

export interface CompetitionSummary {
  competitionId: string;
  competitionName: string;
  totalEntries: number;
  topScore: number;
  leaderboard: CompetitionEntryRecord[];
}

export interface ReportsOverview {
  generatedAt: string;
  metrics: {
    campaigns: number;
    activeCampaigns: number;
    pods: number;
    memberships: number;
    users: number;
    trackers: number;
    performanceLogs: number;
    competitions: number;
    competitionEntries: number;
    notifications: number;
    unreadNotifications: number;
  };
  topTrackers: PerformanceTrackerSummary[];
  topPerformers: PerformanceUserSummary[];
  competitions: CompetitionSummary[];
  campaignBreakdown: Array<{
    campaignId: string;
    campaignName: string;
    podCount: number;
    trackerCount: number;
  }>;
  notificationBreakdown: Array<{
    type: NotificationType;
    total: number;
    unread: number;
  }>;
}

export interface TeamsWebhookRecord {
  id: string;
  name: string;
  friendlyName: string | null;
  direction: TeamsWebhookDirection;
  url: string;
  description: string | null;
  category: TeamsChannelCategory | null;
  testStatus: string | null;
  lastTestedAt: string | null;
  lastPostAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamsAutomationFactTemplate {
  name: string;
  valueTemplate: string;
}

export interface TeamsAutomationRecord {
  id: string;
  name: string;
  trigger: TeamsAutomationTrigger;
  scope: TeamsAutomationScope;
  mode: TeamsAutomationMode;
  deliveryFormat: TeamsAutomationDeliveryFormat;
  messageTemplateId: string | null;
  messageTemplateName: string | null;
  messageTemplateVersion: number | null;
  campaignId: string | null;
  campaignName: string | null;
  podId: string | null;
  podName: string | null;
  outgoingWebhookId: string;
  outgoingWebhookName: string;
  titleTemplate: string;
  messageTemplate: string;
  facts: TeamsAutomationFactTemplate[];
  adaptiveCardJson: string | null;
  imageTitleTemplate: string | null;
  imageSubtitleTemplate: string | null;
  imageMetricTemplate: string | null;
  imageFooterTemplate: string | null;
  imageAccentColor: string | null;
  oneTimeAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  windowStartTime: string | null;
  windowEndTime: string | null;
  quietStartTime: string | null;
  quietEndTime: string | null;
  repeatEveryMinutes: number | null;
  batchWindowMinutes: number | null;
  cooldownMinutes: number | null;
  conditionEvent: TeamsAutomationConditionEvent | null;
  conditionMetric: TeamsAutomationConditionMetric | null;
  conditionLookbackMinutes: number | null;
  conditionMinimumCount: number | null;
  conditionMinimumValue: number | null;
  onlyIfNewData: boolean;
  conditionActivityWithinMinutes: number | null;
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamsMessageTemplateRecord {
  id: string;
  name: string;
  category: TeamsChannelCategory | null;
  version: number;
  deliveryFormat: TeamsAutomationDeliveryFormat;
  titleTemplate: string;
  messageTemplate: string;
  facts: TeamsAutomationFactTemplate[];
  adaptiveCardJson: string | null;
  imageTitleTemplate: string | null;
  imageSubtitleTemplate: string | null;
  imageMetricTemplate: string | null;
  imageFooterTemplate: string | null;
  imageAccentColor: string | null;
  variationsJson: Record<string, unknown> | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamsIncomingEventRecord {
  id: string;
  endpointId: string;
  endpointName: string;
  payloadPreview: string;
  createdAt: string;
}

export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function hasAdminAccess(roles: UserRole[]): boolean {
  return roles.some(isAdminRole);
}

export function isCompetitionEditor(roles: UserRole[]): boolean {
  return roles.some((role) => COMPETITION_EDITOR_ROLES.includes(role));
}

export interface ActivityRecord {
  id: string;
  userId: string | null;
  userName: string | null;
  type: string;
  title: string;
  description: string | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;

  // Enhanced fields
  agentName: string | null;
  recorderId: string | null;
  recorderName: string | null;
  richMessage: string | null;
}

export interface RpsGameResult {
  playerThrow: "rock" | "paper" | "scissors";
  opponentThrow: "rock" | "paper" | "scissors";
  result: "win" | "loss" | "draw";
  cooldownSeconds: number;
}

// ============================================================================
// Activity Types (V2 Replica)
// ============================================================================

export const ACTIVITY_TYPES = [
  // Tracker activities
  'tracker_created',
  'tracker_entry_logged',
  'tracker_milestone',
  // Competition activities
  'competition_joined',
  'competition_completed',
  'competition_started',
  'competition_won',
  'competition_score_logged',
  'competition_milestone',
  'competition_absent',
  // Score activities
  'score_logged',
  'achievement_earned',
  'milestone_reached',
  'badge_earned',
  // KPI activities
  'kpi_created',
  'kpi_updated',
  'kpi_goal_reached',
  'kpi_goal_achieved',
  'kpi_trend_improved',
  // Game activities
  'game_played',
  'game_won',
  'game_high_score',
  'game_achievement',
  // Profile activities
  'profile_updated',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

// Activity category for filtering
export type ActivityCategory = 'all' | 'trackers' | 'competitions' | 'scores' | 'kpis' | 'games' | 'profile';

// Map activity types to categories
export const ACTIVITY_TYPE_CATEGORIES: Record<ActivityType, ActivityCategory> = {
  // Tracker activities
  tracker_created: 'trackers',
  tracker_entry_logged: 'trackers',
  tracker_milestone: 'trackers',
  // Competition activities
  competition_joined: 'competitions',
  competition_completed: 'competitions',
  competition_started: 'competitions',
  competition_won: 'competitions',
  competition_score_logged: 'competitions',
  competition_milestone: 'competitions',
  competition_absent: 'competitions',
  // Score activities
  score_logged: 'scores',
  achievement_earned: 'scores',
  milestone_reached: 'scores',
  badge_earned: 'scores',
  // KPI activities
  kpi_created: 'kpis',
  kpi_updated: 'kpis',
  kpi_goal_reached: 'kpis',
  kpi_goal_achieved: 'kpis',
  kpi_trend_improved: 'kpis',
  // Game activities
  game_played: 'games',
  game_won: 'games',
  game_high_score: 'games',
  game_achievement: 'games',
  // Profile activities
  profile_updated: 'profile',
};

// Category display labels
export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  all: 'All Activities',
  trackers: 'Trackers',
  competitions: 'Competitions',
  scores: 'Scores & Achievements',
  kpis: 'KPIs',
  games: 'Mini Games',
  profile: 'Profile',
};

// Activity type display information with icons and colors
export const ACTIVITY_TYPE_CONFIG: Record<ActivityType, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}> = {
  // Tracker activities
  tracker_created: {
    label: 'Tracker Created',
    icon: 'Target',
    color: 'text-teal-500',
    bgColor: 'bg-teal-500/20',
  },
  tracker_entry_logged: {
    label: 'Tracker Entry Logged',
    icon: 'CheckCircle',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/20',
  },
  tracker_milestone: {
    label: 'Tracker Milestone',
    icon: 'Flag',
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
  },
  // Competition activities
  competition_joined: {
    label: 'Joined Competition',
    icon: 'Trophy',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
  },
  competition_completed: {
    label: 'Competition Completed',
    icon: 'Trophy',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
  },
  competition_started: {
    label: 'Competition Started',
    icon: 'Trophy',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
  },
  competition_won: {
    label: 'Competition Won',
    icon: 'Crown',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/20',
  },
  competition_score_logged: {
    label: 'Competition Score Logged',
    icon: 'Target',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
  },
  competition_milestone: {
    label: 'Competition Milestone',
    icon: 'Flag',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
  },
  competition_absent: {
    label: 'Competition Absent',
    icon: 'CalendarX',
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/20',
  },
  // Score activities
  score_logged: {
    label: 'Score Logged',
    icon: 'Target',
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
  },
  achievement_earned: {
    label: 'Achievement Earned',
    icon: 'Award',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/20',
  },
  milestone_reached: {
    label: 'Milestone Reached',
    icon: 'TrendingUp',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/20',
  },
  badge_earned: {
    label: 'Badge Earned',
    icon: 'Medal',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/20',
  },
  // KPI activities
  kpi_created: {
    label: 'KPI Created',
    icon: 'BarChart3',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/20',
  },
  kpi_updated: {
    label: 'KPI Updated',
    icon: 'BarChart3',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/20',
  },
  kpi_goal_reached: {
    label: 'KPI Goal Reached',
    icon: 'Target',
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
  },
  kpi_goal_achieved: {
    label: 'KPI Goal Achieved',
    icon: 'CheckCircle',
    color: 'text-green-600',
    bgColor: 'bg-green-600/20',
  },
  kpi_trend_improved: {
    label: 'KPI Trend Improved',
    icon: 'TrendingUp',
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
  },
  // Game activities
  game_played: {
    label: 'Game Played',
    icon: 'Gamepad2',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/20',
  },
  game_won: {
    label: 'Game Won',
    icon: 'Swords',
    color: 'text-red-500',
    bgColor: 'bg-red-500/20',
  },
  game_high_score: {
    label: 'Game High Score',
    icon: 'Star',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
  },
  game_achievement: {
    label: 'Game Achievement',
    icon: 'Trophy',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/20',
  },
  // Profile activities
  profile_updated: {
    label: 'Profile Updated',
    icon: 'User',
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/20',
  },
};

// Date range presets
export type DateRangePreset = 'all' | 'today' | 'week' | 'month' | 'quarter';

// Helper function to get activities by category
export function getActivitiesByCategory(
  activities: ActivityRecord[],
  category: ActivityCategory
): ActivityRecord[] {
  if (category === 'all') return activities;
  return activities.filter(
    (activity) => ACTIVITY_TYPE_CATEGORIES[activity.type as ActivityType] === category
  );
}
