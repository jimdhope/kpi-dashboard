import { kpiLogRepository, KpiLogRecord } from "@/server/repositories/kpi-log-repository";
import { authService } from "@/server/services/auth-service";
import { activityService } from "@/server/services/activity-service";
import { kpiRepository } from "@/server/repositories/kpi-repository";
import { permissionService } from "@/server/services/permission-service";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class InternalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InternalError";
  }
}

export const kpiLogService = {
  async canManageTarget(currentUser: Awaited<ReturnType<typeof authService.requireCurrentUser>>, targetUserId: string) {
    if (targetUserId === currentUser.id) return true;
    return permissionService.hasResourceAccess(currentUser.roles, "nav.performance.log", "MANAGE");
  },
  async list(filters?: {
    podId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<KpiLogRecord[]> {
    try {
      const currentUser = await authService.requireCurrentUser();
      const userPodIds = currentUser.podIds ?? [];

      const isAdmin = await permissionService.hasEffectiveAdminAccess(currentUser.roles);
      if (filters?.userId) {
        if (!(await kpiLogService.canManageTarget(currentUser, filters.userId))) {
          throw new ForbiddenError();
        }
        return await kpiLogRepository.listByUserId(filters.userId, filters);
      }
      if (!isAdmin) {
        return await kpiLogRepository.listByPodIds(userPodIds, {
          startDate: filters?.startDate,
          endDate: filters?.endDate,
        });
      }

      return await kpiLogRepository.list(filters);
    } catch (error) {
      if (error instanceof ForbiddenError) throw error;
      console.error("kpiLogService.list error:", error);
      throw new InternalError(
        error instanceof Error ? error.message : "Failed to fetch KPI logs"
      );
    }
  },

  async create(input: {
    kpiId: string;
    userId?: string;
    value: number;
    date: Date;       // When the KPI was achieved (required)
    loggedAt?: Date;  // When it was logged (defaults to now)
  }): Promise<KpiLogRecord> {
    try {
      // Require authentication for creating logs
      const currentUser = await authService.requireCurrentUser();

      const userId = input.userId || currentUser.id;

      if (!(await kpiLogService.canManageTarget(currentUser, userId))) {
        throw new ForbiddenError();
      }

      if (!input.kpiId) {
        throw new ValidationError("KPI ID is required");
      }

      if (typeof input.value !== "number" || isNaN(input.value)) {
        throw new ValidationError("Value must be a valid number");
      }

      // Get KPI details for activity logging
      const kpi = await kpiRepository.getById(input.kpiId);

      const log = await kpiLogRepository.create({
        kpiId: input.kpiId,
        userId,
        value: input.value,
        date: input.date,
        loggedAt: input.loggedAt,
      });

      // Log activity
      await activityService.logKpiUpdated({
        kpiId: input.kpiId,
        kpiName: kpi?.name || 'Unknown KPI',
        newValue: input.value,
        userId,
        userName: currentUser.name,
      });

      return log;
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      if (error instanceof ForbiddenError) throw error;
      if (error instanceof ValidationError) throw error;
      console.error("kpiLogService.create error:", error);
      throw new InternalError(
        error instanceof Error ? error.message : "Failed to create KPI log"
      );
    }
  },

  async createBatch(
    logs: Array<{
      kpiId: string;
      userId?: string;
      value: number;
      date: Date;
      loggedAt?: Date;
    }>
  ): Promise<KpiLogRecord[]> {
    try {
      const currentUser = await authService.requireCurrentUser();
      const results: KpiLogRecord[] = [];

      // Get all KPI details for activity logging
      const kpiIds = [...new Set(logs.map(l => l.kpiId))];
      const kpis = await Promise.all(kpiIds.map(id => kpiRepository.getById(id)));
      const kpiMap = new Map(kpis.filter(Boolean).map(k => [k!.id, k!]));

      for (const log of logs) {
        const userId = log.userId || currentUser.id;

        if (!(await kpiLogService.canManageTarget(currentUser, userId))) {
          throw new ForbiddenError();
        }

        if (!log.kpiId) {
          throw new ValidationError("KPI ID is required for all logs");
        }

        if (typeof log.value !== "number" || isNaN(log.value)) {
          throw new ValidationError("All values must be valid numbers");
        }

        const created = await kpiLogRepository.create({
          kpiId: log.kpiId,
          userId,
          value: log.value,
          date: log.date,
          loggedAt: log.loggedAt,
        });

        // Log activity for each log
        const kpi = kpiMap.get(log.kpiId);
        await activityService.logKpiUpdated({
          kpiId: log.kpiId,
          kpiName: kpi?.name || 'Unknown KPI',
          newValue: log.value,
          userId,
          userName: currentUser.name,
        });

        results.push(created);
      }

      return results;
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      if (error instanceof ForbiddenError) throw error;
      if (error instanceof ValidationError) throw error;
      console.error("kpiLogService.createBatch error:", error);
      throw new InternalError(
        error instanceof Error ? error.message : "Failed to create KPI logs"
      );
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const currentUser = await authService.requireCurrentUser();
      const ownerId = await kpiLogRepository.findOwnerId(id);
      if (ownerId === undefined) throw new NotFoundError("KPI log not found");
      if (!ownerId || !(await kpiLogService.canManageTarget(currentUser, ownerId))) {
        throw new ForbiddenError();
      }
      await kpiLogRepository.delete(id);
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      if (error instanceof ForbiddenError) throw error;
      if (error instanceof NotFoundError) throw error;
      console.error("kpiLogService.delete error:", error);
      throw new InternalError(
        error instanceof Error ? error.message : "Failed to delete KPI log"
      );
    }
  },
};
