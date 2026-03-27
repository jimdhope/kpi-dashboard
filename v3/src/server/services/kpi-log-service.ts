import { kpiLogRepository, KpiLogRecord } from "@/server/repositories/kpi-log-repository";
import { authService } from "@/server/services/auth-service";

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
  async list(filters?: {
    podId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<KpiLogRecord[]> {
    try {
      // Authentication is optional for reading logs
      return await kpiLogRepository.list(filters);
    } catch (error) {
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

      if (!input.kpiId) {
        throw new ValidationError("KPI ID is required");
      }

      if (typeof input.value !== "number" || isNaN(input.value)) {
        throw new ValidationError("Value must be a valid number");
      }

      const log = await kpiLogRepository.create({
        kpiId: input.kpiId,
        userId,
        value: input.value,
        date: input.date,
        loggedAt: input.loggedAt,
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

      for (const log of logs) {
        const userId = log.userId || currentUser.id;

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
      await authService.requireCurrentUser();
      await kpiLogRepository.delete(id);
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      console.error("kpiLogService.delete error:", error);
      throw new InternalError(
        error instanceof Error ? error.message : "Failed to delete KPI log"
      );
    }
  },
};
