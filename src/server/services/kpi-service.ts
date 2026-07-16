import { kpiRepository } from "@/server/repositories/kpi-repository";
import { authService } from "@/server/services/auth-service";
import { activityService } from "@/server/services/activity-service";
import { requireResourceAccess } from "@/server/services/authorization";

export const kpiService = {
  async list() {
    await authService.requireCurrentUser();
    return kpiRepository.list();
  },

  async getById(id: string) {
    await authService.requireCurrentUser();
    return kpiRepository.getById(id);
  },

  async create(payload: {
    name: string;
    initials: string;
    type: string;
    maxValue?: number | null;
    sortOrder?: string;
    passFailCriteriaEnabled?: boolean;
    passFailOperator?: string | null;
    passFailValue?: number | null;
  }) {
    await requireResourceAccess("nav.performance.kpis");
    const currentUser = await authService.requireCurrentUser();

    const kpi = await kpiRepository.create(payload);

    // Log activity
    await activityService.logKpiCreated({
      kpiId: kpi.id,
      kpiName: kpi.name,
      userId: currentUser.id,
      userName: currentUser.name,
    });

    return kpi;
  },

  async update(id: string, payload: Partial<{
    name: string;
    initials: string;
    type: string;
    maxValue: number | null;
    sortOrder: string;
    passFailCriteriaEnabled: boolean;
    passFailOperator: string | null;
    passFailValue: number | null;
  }>) {
    await requireResourceAccess("nav.performance.kpis");
    return kpiRepository.update(id, payload);
  },

  async delete(id: string) {
    await requireResourceAccess("nav.performance.kpis");
    return kpiRepository.delete(id);
  },
};
