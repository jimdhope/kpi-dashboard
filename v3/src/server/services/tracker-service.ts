import { trackerRepository } from "@/server/repositories/tracker-repository";
import { activityService } from "@/server/services/activity-service";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";

export const trackerService = {
  async logPerformanceEntry(input: {
    trackerKpiId: string;
    userId: string;
    value: number;
    description?: string;
  }) {
    // Current user validation
    const currentUser = await authService.requireCurrentUser();
    const targetUserId = input.userId || currentUser.id;

    // Log the raw data
    const log = await trackerRepository.logValue({
      trackerKpiId: input.trackerKpiId,
      userId: targetUserId,
      value: input.value,
    });

    // Create a rich activity log for the feed
    const kpis = await trackerRepository.listKpis();
    const kpiName = kpis.find(k => k.id === input.trackerKpiId)?.name || "KPI";

    await activityService.logAgentAction({
      type: "tracker_entry_logged",
      title: `Logged ${input.value} performance for ${kpiName}`,
      description: input.description,
      metadata: {
        trackerKpiId: input.trackerKpiId,
        value: input.value,
        kpiName,
      },
      userId: targetUserId, // attribution to the agent
    });

    return log;
  },

  async getPersonalOverview() {
    const user = await authService.requireCurrentUser();
    const logs = await trackerRepository.listUserLogs(user.id, 5);
    const kpis = await trackerRepository.listKpis();

    // Map logs to detailed overview
    return {
      recentLogs: logs.map(l => ({
        id: l.id,
        kpiName: l.trackerKpi.name,
        value: l.value.toNumber(),
        date: l.loggedAt.toISOString(),
      })),
      availableKpis: kpis.map(k => ({
        id: k.id,
        name: k.name,
        unit: k.unit,
      })),
    };
  },

  async listTrackers(campaignId?: string) {
    await authService.requireAdmin();
    return trackerRepository.listKpis(campaignId);
  },

  async updateTracker(id: string, payload: any) {
    await authService.requireAdmin();
    return prisma.trackerKpi.update({
      where: { id },
      data: payload,
    });
  },

  async createTracker(payload: any) {
    await authService.requireAdmin();
    return prisma.trackerKpi.create({
      data: payload,
    });
  },

  async deleteTracker(id: string) {
    await authService.requireAdmin();
    return prisma.trackerKpi.delete({
      where: { id },
    });
  },
};
