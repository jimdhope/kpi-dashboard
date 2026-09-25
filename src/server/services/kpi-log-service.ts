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

type KpiValueDefinition = {
  name: string;
  type: string;
  maxValue: { toNumber(): number } | null;
};

type KpiLogInput = {
  id?: string;
  kpiId: string;
  userId?: string;
  value: number;
  date: Date;
  loggedAt?: Date;
};

function validateKpiValue(kpi: KpiValueDefinition | null, value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new ValidationError("Value must be a finite non-negative number");
  }

  if (kpi?.type === "scoreOutOf" && kpi.maxValue) {
    const maxValue = kpi.maxValue.toNumber();
    if (value > maxValue) {
      throw new ValidationError(`${kpi.name} cannot be greater than ${maxValue}`);
    }
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

      // Get KPI details for validation and activity logging
      const kpi = await kpiRepository.getById(input.kpiId);
      if (!kpi) {
        throw new NotFoundError("KPI not found");
      }
      validateKpiValue(kpi, input.value);

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
      if (error instanceof NotFoundError) throw error;
      console.error("kpiLogService.create error:", error);
      throw new InternalError(
        error instanceof Error ? error.message : "Failed to create KPI log"
      );
    }
  },

  async createBatch(logs: KpiLogInput[]): Promise<KpiLogRecord[]> {
    try {
      const currentUser = await authService.requireCurrentUser();
      const results: KpiLogRecord[] = [];

      // Get all KPI details before writing so validation cannot leave a partial batch.
      const kpiIds = [...new Set(logs.map((log) => log.kpiId))];
      const kpis = await Promise.all(kpiIds.map((id) => kpiRepository.getById(id)));
      const kpiMap = new Map(kpis.filter(Boolean).map((kpi) => [kpi!.id, kpi!]));

      const prepared: Array<{
        input: KpiLogInput;
        userId: string;
        kpi: KpiValueDefinition;
        existing?: KpiLogRecord;
      }> = [];

      // Validate every entry and resolve its target before performing writes.
      for (const log of logs) {
        if (!log.kpiId) {
          throw new ValidationError("KPI ID is required for all logs");
        }

        let userId: string;
        let existing: KpiLogRecord | undefined;

        if (log.id) {
          existing = await kpiLogRepository.getById(log.id);
          if (!existing) {
            throw new NotFoundError(`KPI log not found: ${log.id}`);
          }
          if (existing.kpiId !== log.kpiId) {
            throw new ValidationError("A KPI log cannot be moved to a different KPI");
          }
          if (!existing.userId) {
            throw new ForbiddenError();
          }
          if (log.userId && log.userId !== existing.userId) {
            throw new ValidationError("A KPI log cannot be moved to a different user");
          }
          userId = existing.userId;
        } else {
          userId = log.userId || currentUser.id;
        }

        if (!(await kpiLogService.canManageTarget(currentUser, userId))) {
          throw new ForbiddenError();
        }

        const kpi = kpiMap.get(existing?.kpiId || log.kpiId);
        if (!kpi) {
          throw new NotFoundError(`KPI not found: ${log.kpiId}`);
        }
        validateKpiValue(kpi, log.value);

        prepared.push({ input: log, userId, kpi, existing });
      }

      for (const item of prepared) {
        const { input, existing, userId, kpi } = item;
        const saved = existing
          ? await kpiLogRepository.update(existing.id, {
              value: input.value,
              date: input.date,
              loggedAt: input.loggedAt,
            })
          : await kpiLogRepository.create({
              kpiId: input.kpiId,
              userId,
              value: input.value,
              date: input.date,
              loggedAt: input.loggedAt,
            });

        await activityService.logKpiUpdated({
          kpiId: input.kpiId,
          kpiName: kpi.name,
          newValue: input.value,
          userId,
          userName: currentUser.name,
        });

        results.push(saved);
      }

      return results;
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      if (error instanceof ForbiddenError) throw error;
      if (error instanceof ValidationError) throw error;
      if (error instanceof NotFoundError) throw error;
      console.error("kpiLogService.createBatch error:", error);
      throw new InternalError(
        error instanceof Error ? error.message : "Failed to save KPI logs"
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
