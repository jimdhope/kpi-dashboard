import "server-only";

import { prisma } from "@/server/db/client";

export type ScoreEventRecord = {
  id: string;
  competitionId: string;
  ruleId: string;
  ruleName: string | null;
  subjectAgentId: string;
  podId: string;
  quantity: number;
  points: number;
  scoredForDate: Date;
  source: string;
  recordedAt: Date | null;
  recordedById: string | null;
  idempotencyKey: string | null;
  externalReference: string | null;
  correctionOfId: string | null;
  voidedAt: Date | null;
  voidedById: string | null;
  voidReason: string | null;
  createdAt: Date;
};

type CreateScoreEventInput = Omit<ScoreEventRecord, "id" | "createdAt" | "voidedAt" | "voidedById" | "voidReason">;

/**
 * Persistence boundary for the additive scoring ledger. No legacy scoring
 * table is read or written here; migration and route cutover happen later.
 */
export const scoreEventRepository = {
  async create(input: CreateScoreEventInput): Promise<ScoreEventRecord> {
    return prisma.scoreEvent.create({ data: input });
  },

  async findById(id: string): Promise<ScoreEventRecord | null> {
    return prisma.scoreEvent.findUnique({ where: { id } });
  },

  async findByIdempotencyKey(idempotencyKey: string): Promise<ScoreEventRecord | null> {
    return prisma.scoreEvent.findUnique({ where: { idempotencyKey } });
  },

  async findActiveByCompetition(params: {
    competitionId: string;
    scoredForDate?: { gte?: Date; lte?: Date };
  }): Promise<ScoreEventRecord[]> {
    return prisma.scoreEvent.findMany({
      where: {
        competitionId: params.competitionId,
        voidedAt: null,
        ...(params.scoredForDate ? { scoredForDate: params.scoredForDate } : {}),
      },
      orderBy: [{ scoredForDate: "asc" }, { createdAt: "asc" }],
    });
  },

  async getActiveTotalsByCompetition(params: {
    competitionId: string;
    podIds?: string[];
    scoredForDate?: { gte?: Date; lte?: Date };
  }): Promise<Array<{ subjectAgentId: string; points: number }>> {
    const totals = await prisma.scoreEvent.groupBy({
      by: ["subjectAgentId"],
      where: {
        competitionId: params.competitionId,
        voidedAt: null,
        ...(params.podIds?.length ? { podId: { in: params.podIds } } : {}),
        ...(params.scoredForDate ? { scoredForDate: params.scoredForDate } : {}),
      },
      _sum: { points: true },
    });

    return totals.map((total) => ({
      subjectAgentId: total.subjectAgentId,
      points: total._sum.points ?? 0,
    }));
  },

  async void(params: {
    id: string;
    voidedById: string;
    voidReason: string;
    voidedAt: Date;
  }): Promise<ScoreEventRecord | null> {
    const updated = await prisma.scoreEvent.updateMany({
      where: { id: params.id, voidedAt: null },
      data: {
        voidedAt: params.voidedAt,
        voidedById: params.voidedById,
        voidReason: params.voidReason,
      },
    });

    return updated.count === 1 ? this.findById(params.id) : null;
  },
};
