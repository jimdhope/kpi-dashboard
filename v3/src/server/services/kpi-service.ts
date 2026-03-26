import { kpiRepository } from "@/server/repositories/kpi-repository";
import { authService } from "@/server/services/auth-service";

export const kpiService = {
  async list() {
    return kpiRepository.list();
  },

  async getById(id: string) {
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
    await authService.requireAdmin();
    return kpiRepository.create(payload);
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
    await authService.requireAdmin();
    return kpiRepository.update(id, payload);
  },

  async delete(id: string) {
    await authService.requireAdmin();
    return kpiRepository.delete(id);
  },
};
