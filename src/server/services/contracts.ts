import { AppCampaign, AppPod, AppUser, CompetitionRecord, CompetitionSummary, DashboardSummary, PerformanceLogRecord, PerformanceOverview, ReportsOverview, SessionPayload, TeamsWebhookDirection, TeamsWebhookRecord, TrackerKpiRecord, UserRole } from "@/lib/contracts";

export interface AuthServiceContract {
  login(email: string, password: string): Promise<{ sessionToken: string; expiresAt: Date; user: AppUser }>;
  logout(): Promise<void>;
  getCurrentSession(): Promise<SessionPayload>;
}

export interface UserServiceContract {
  getCurrentUser(): Promise<AppUser>;
  listUsers(): Promise<AppUser[]>;
  createUser(input: { name: string; email: string; password: string; roles: UserRole[] }): Promise<AppUser>;
  updateUser(id: string, input: { name: string; roles: UserRole[] }): Promise<AppUser>;
  deleteUser(id: string): Promise<void>;
}

export interface CampaignService {
  listCampaigns(): Promise<AppCampaign[]>;
  createCampaign(input: {
    name: string;
    description?: string | null;
    isActive: boolean;
    incomingWebhookId?: string | null;
    outgoingWebhookId?: string | null;
  }): Promise<AppCampaign>;
  updateCampaign(id: string, input: {
    name: string;
    description?: string | null;
    isActive: boolean;
    incomingWebhookId?: string | null;
    outgoingWebhookId?: string | null;
  }): Promise<AppCampaign>;
}

export interface PodService {
  listPods(): Promise<AppPod[]>;
  createPod(input: {
    campaignId?: string | null;
    incomingWebhookId?: string | null;
    outgoingWebhookId?: string | null;
    name: string;
    description?: string | null;
  }): Promise<AppPod>;
  updatePod(id: string, input: {
    campaignId?: string | null;
    incomingWebhookId?: string | null;
    outgoingWebhookId?: string | null;
    name: string;
    description?: string | null;
  }): Promise<AppPod>;
}
export interface TrackerService {
  listTrackers(): Promise<TrackerKpiRecord[]>;
  createTracker(input: { campaignId?: string | null; name: string; unit?: string | null; targetValue?: number | null }): Promise<TrackerKpiRecord>;
  updateTracker(id: string, input: { campaignId?: string | null; name: string; unit?: string | null; targetValue?: number | null }): Promise<TrackerKpiRecord>;
}
export interface CompetitionService {
  listCompetitions(): Promise<CompetitionRecord[]>;
  createCompetition(input: {
    name: string;
    description?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
    rules: { title: string; points: number }[];
    teams: { name: string }[];
  }): Promise<CompetitionRecord>;
  updateCompetition(id: string, input: {
    name: string;
    description?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
    rules: { title: string; points: number }[];
    teams: { name: string }[];
  }): Promise<CompetitionRecord>;
  logScore(input: { competitionId: string; userId?: string | null; score: number }): Promise<{ id: string; userId: string | null; userName: string | null; score: number; createdAt: string; updatedAt: string }>;
  getSummaries(): Promise<CompetitionSummary[]>;
}
export interface PerformanceService {
  listLogs(): Promise<PerformanceLogRecord[]>;
  listLogsByPodIds(podIds: string[]): Promise<PerformanceLogRecord[]>;
  deleteLog(id: string): Promise<{ success: boolean; id: string }>;
  createLog(input: { trackerKpiId: string; userId: string; value: number; loggedAt?: string | null }): Promise<PerformanceLogRecord>;
  getOverview(): Promise<PerformanceOverview>;
}
export interface TeamsWebhookService {
  listWebhooks(): Promise<TeamsWebhookRecord[]>;
  createWebhook(input: {
    name: string;
    direction: TeamsWebhookDirection;
    url: string;
    description?: string | null;
    isActive: boolean;
  }): Promise<TeamsWebhookRecord>;
  updateWebhook(id: string, input: {
    name: string;
    direction: TeamsWebhookDirection;
    url: string;
    description?: string | null;
    isActive: boolean;
  }): Promise<TeamsWebhookRecord>;
}
export interface ReportingService {
  getOverview(): Promise<ReportsOverview>;
}
export interface DashboardService {
  getDashboard(): Promise<DashboardSummary>;
}
