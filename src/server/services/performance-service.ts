import { performanceRepository } from "@/server/repositories/performance-repository";
import { podRepository } from "@/server/repositories/pod-repository";
import { trackerRepository } from "@/server/repositories/tracker-repository";
import { authService } from "@/server/services/auth-service";
import { activityService } from "@/server/services/activity-service";
import { teamsAutomationService } from "@/server/services/teams-automation-service";
import { teamsEventService } from "@/server/services/teams-event-service";
import { prisma } from "@/server/db/client";

export const performanceService = {
  async listLogs() {
    await authService.requireCurrentUser();
    return performanceRepository.listLogs();
  },

  async listLogsByPodIds(podIds: string[]) {
    await authService.requireCurrentUser();
    return performanceRepository.listLogsByPodIds(podIds);
  },

  async deleteLog(id: string) {
    await authService.requireCurrentUser();
    return performanceRepository.deleteLog(id);
  },

  async createLog(input: { trackerKpiId: string; userId: string; value: number; loggedAt?: string | null }) {
    const currentUser = await authService.requireCurrentUser();
    
    // Get the target user's name for activity logging
    const targetUser = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { name: true },
    });
    const targetUserName = targetUser?.name || currentUser.name;
    
    const createdLog = await performanceRepository.createLog({
      trackerKpiId: input.trackerKpiId,
      userId: input.userId, // Use the provided userId (the agent being logged for)
      value: input.value,
      loggedAt: input.loggedAt ? new Date(input.loggedAt) : undefined,
    });

    const [tracker, podWebhookIds, podIds] = await Promise.all([
      trackerRepository.findById(input.trackerKpiId),
      podRepository.listOutgoingWebhookIdsForUser(currentUser.id),
      podRepository.listPodIdsForUser(currentUser.id),
    ]);

    // Log activity for the tracker entry
    const isRecordedBySupervisor = currentUser.id !== input.userId;
    await activityService.logTrackerEntryLogged({
      trackerId: input.trackerKpiId,
      trackerName: createdLog.trackerName,
      value: Number(input.value),
      userId: input.userId,
      userName: targetUserName,
      ...(isRecordedBySupervisor && {
        recorderId: currentUser.id,
        recorderName: currentUser.name,
      }),
    });

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
    
    // Get the target user and KPI names for activity logging
    const [targetUser, kpi] = await Promise.all([
      input.userId ? prisma.user.findUnique({ where: { id: input.userId }, select: { name: true } }) : Promise.resolve(null),
      prisma.kpi.findUnique({ where: { id: input.kpiId }, select: { name: true } }),
    ]);
    
    const targetUserId = input.userId || currentUser.id;
    const targetUserName = targetUser?.name || currentUser.name;
    
    const createdLog = await performanceRepository.createKpiLog({
      kpiId: input.kpiId,
      userId: targetUserId,
      value: input.value,
      date: input.date,
      loggedAt: input.loggedAt ? new Date(input.loggedAt) : undefined,
    });
    
    // Log activity for the KPI value update
    await activityService.logKpiUpdated({
      kpiId: input.kpiId,
      kpiName: kpi?.name || 'Unknown KPI',
      newValue: input.value,
      userId: targetUserId,
      userName: targetUserName,
    });
    
    return createdLog;
  },
};
