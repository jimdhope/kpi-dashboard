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

    // Get KPI name
    const kpis = await trackerRepository.listKpis();
    const kpi = kpis.find(k => k.id === input.trackerKpiId);
    const kpiName = kpi?.name || "KPI";

    // Determine if this is being logged by a supervisor on behalf of an agent
    const isRecordedBySupervisor = currentUser.id !== targetUserId;

    // Get target user name for activity attribution
    const targetUser = isRecordedBySupervisor
      ? await prisma.user.findUnique({ where: { id: targetUserId }, select: { name: true } })
      : null;

    // Log detailed activity with proper attribution
    await activityService.logTrackerEntryLogged({
      trackerId: input.trackerKpiId,
      trackerName: kpiName,
      value: input.value,
      userId: targetUserId,
      userName: targetUser?.name || currentUser.name,
      ...(isRecordedBySupervisor && {
        recorderId: currentUser.id,
        recorderName: currentUser.name,
      }),
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
    const currentUser = await authService.requireCurrentUser();

    const tracker = await prisma.trackerKpi.create({
      data: payload,
    });

    // Log activity
    await activityService.logTrackerCreated({
      trackerId: tracker.id,
      trackerName: tracker.name,
      userId: currentUser.id,
      userName: currentUser.name,
    });

    return tracker;
  },

  async deleteTracker(id: string) {
    await authService.requireAdmin();
    return prisma.trackerKpi.delete({
      where: { id },
    });
  },
};
