import { performanceRepository } from "@/server/repositories/performance-repository";
import { podRepository } from "@/server/repositories/pod-repository";
import { trackerRepository } from "@/server/repositories/tracker-repository";
import { authService } from "@/server/services/auth-service";
import { teamsAutomationService } from "@/server/services/teams-automation-service";
import { teamsEventService } from "@/server/services/teams-event-service";

export const performanceService = {
  async listLogs() {
    await authService.requireCurrentUser();
    return performanceRepository.listLogs();
  },

  async createLog(input: { trackerKpiId: string; value: number; loggedAt?: string | null }) {
    const currentUser = await authService.requireCurrentUser();
    const createdLog = await performanceRepository.createLog({
      trackerKpiId: input.trackerKpiId,
      userId: currentUser.id,
      value: input.value,
      loggedAt: input.loggedAt ? new Date(input.loggedAt) : undefined,
    });

    const [tracker, podWebhookIds, podIds] = await Promise.all([
      trackerRepository.findById(input.trackerKpiId),
      podRepository.listOutgoingWebhookIdsForUser(currentUser.id),
      podRepository.listPodIdsForUser(currentUser.id),
    ]);

    const webhookIds = [
      tracker?.campaign?.outgoingWebhookId ?? null,
      ...podWebhookIds,
    ].filter((value): value is string => Boolean(value));

    await teamsEventService.queueDeliveries({
      webhookIds,
      title: "Performance logged",
      text: `${currentUser.name} logged ${createdLog.value} for ${createdLog.trackerName}.`,
      facts: [
        { name: "User", value: currentUser.name },
        { name: "Tracker", value: createdLog.trackerName },
        { name: "Value", value: String(createdLog.value) },
        { name: "Campaign", value: tracker?.campaign?.name ?? "Unassigned" },
      ],
    });

    await teamsAutomationService.dispatchTriggeredAutomations({
      trigger: "performanceLogged",
      campaignIds: tracker?.campaign?.id ? [tracker.campaign.id] : [],
      podIds,
      context: {
        userId: currentUser.id,
        userName: currentUser.name,
        trackerId: createdLog.trackerKpiId,
        trackerName: createdLog.trackerName,
        trackerValue: String(createdLog.value),
        campaignId: tracker?.campaign?.id ?? "",
        campaignName: tracker?.campaign?.name ?? "Unassigned",
      },
    });

    return createdLog;
  },

  async getOverview() {
    await authService.requireCurrentUser();
    return performanceRepository.getOverview();
  },

  // KPI Log functions
  async listKpiLogs(filters?: { podId?: string; startDate?: string; endDate?: string }) {
    await authService.requireCurrentUser();
    return performanceRepository.listKpiLogs(filters);
  },

  async createKpiLog(input: { kpiId: string; userId?: string; value: number; date: Date; loggedAt?: string | null }) {
    const currentUser = await authService.requireCurrentUser();
    return performanceRepository.createKpiLog({
      kpiId: input.kpiId,
      userId: input.userId || currentUser.id,
      value: input.value,
      date: input.date,
      loggedAt: input.loggedAt ? new Date(input.loggedAt) : undefined,
    });
  },
};
