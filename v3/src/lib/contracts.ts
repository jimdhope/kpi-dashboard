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
  unreadNotifications: number;
  recentActivities: ActivityRecord[];
  dailyKpiSum: number;
  podComparisons?: Array<{
    id: string;
    name: string;
    dailyScore: number;
  }>;
  leaderboard?: any; // Simple type for now
  metrics: {
    campaigns: number;
    pods: number;
    users: number;
    notifications: number;
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
  direction: TeamsWebhookDirection;
  url: string;
  description: string | null;
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
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamsMessageTemplateRecord {
  id: string;
  name: string;
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
