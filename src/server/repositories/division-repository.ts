import "server-only";

import type { DivisionAssignment, DivisionTitle, League } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/client";

export type CreateAssignmentRow = {
  leagueId: string;
  userId: string;
  division: DivisionAssignment["division"];
  effectiveFrom: Date;
  assignedVia: string;
  assignedById?: string | null;
};

export const divisionRepository = {
  async listActiveLeagues(): Promise<League[]> {
    return prisma.league.findMany({
      where: { isActive: true },
      orderBy: [{ scopeType: "asc" }, { name: "asc" }],
    });
  },

  async listLeagues(): Promise<League[]> {
    return prisma.league.findMany({ orderBy: [{ isActive: "desc" }, { scopeType: "asc" }, { name: "asc" }] });
  },

  async findLeagueById(id: string): Promise<League | null> {
    return prisma.league.findUnique({ where: { id } });
  },

  async createLeague(data: {
    name: string;
    scopeType: League["scopeType"];
    podId?: string | null;
    campaignId?: string | null;
    tierCount: number;
    configJson: Prisma.InputJsonValue | null;
  }): Promise<League> {
    return prisma.league.create({
      data: {
        name: data.name,
        scopeType: data.scopeType,
        podId: data.podId ?? null,
        campaignId: data.campaignId ?? null,
        tierCount: data.tierCount,
        configJson: data.configJson ?? Prisma.DbNull,
      },
    });
  },

  async updateLeague(
    id: string,
    data: Partial<Pick<League, "name" | "tierCount" | "isActive">> & {
      configJson?: Prisma.InputJsonValue | null;
    },
  ): Promise<League> {
    const { configJson, ...rest } = data;
    return prisma.league.update({
      where: { id },
      data: {
        ...rest,
        ...(configJson !== undefined
          ? { configJson: configJson === null ? Prisma.DbNull : configJson }
          : {}),
      },
    });
  },

  async getCurrentAssignments(leagueId: string): Promise<DivisionAssignment[]> {
    return prisma.divisionAssignment.findMany({
      where: { leagueId, effectiveTo: null },
    });
  },

  async getAssignmentsOverlapping(
    leagueId: string,
    window: { start: Date; endExclusive: Date },
  ): Promise<DivisionAssignment[]> {
    return prisma.divisionAssignment.findMany({
      where: {
        leagueId,
        effectiveFrom: { lt: window.endExclusive },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: window.start } }],
      },
      orderBy: [{ effectiveFrom: "asc" }],
    });
  },

  async getAssignmentHistory(leagueId?: string): Promise<DivisionAssignment[]> {
    return prisma.divisionAssignment.findMany({
      where: leagueId ? { leagueId } : undefined,
      orderBy: [{ createdAt: "desc" }],
      take: 500,
    });
  },

  async applyAssignmentChanges(params: {
    leagueId: string;
    closeUserIds: string[];
    closeBefore: Date;
    rows: CreateAssignmentRow[];
  }): Promise<DivisionAssignment[]> {
    return prisma.$transaction(async (tx) => {
      if (params.closeUserIds.length > 0) {
        await tx.divisionAssignment.updateMany({
          where: {
            leagueId: params.leagueId,
            userId: { in: params.closeUserIds },
            effectiveTo: null,
          },
          data: { effectiveTo: params.closeBefore },
        });
      }

      const created: DivisionAssignment[] = [];
      for (const row of params.rows) {
        created.push(await tx.divisionAssignment.create({ data: row }));
      }
      return created;
    });
  },

  async movePlayerWithinLeague(params: {
    leagueId: string;
    userId: string;
    division: DivisionAssignment["division"];
    effectiveFrom: Date;
    assignedVia: string;
    assignedById?: string | null;
  }): Promise<{ closedCount: number; assignment: DivisionAssignment }> {
    return prisma.$transaction(async (tx) => {
      const closed = await tx.divisionAssignment.updateMany({
        where: { leagueId: params.leagueId, userId: params.userId, effectiveTo: null },
        data: { effectiveTo: params.effectiveFrom },
      });
      const assignment = await tx.divisionAssignment.create({
        data: {
          leagueId: params.leagueId,
          userId: params.userId,
          division: params.division,
          effectiveFrom: params.effectiveFrom,
          assignedVia: params.assignedVia,
          assignedById: params.assignedById ?? null,
        },
      });
      return { closedCount: closed.count, assignment };
    });
  },

  async upsertTitle(input: {
    leagueId: string;
    division: DivisionTitle["division"];
    periodType: DivisionTitle["periodType"];
    periodStart: Date;
    periodEnd: Date;
    userId: string;
    userName: string | null;
    points: number;
    decidedById?: string | null;
    note?: string | null;
  }): Promise<DivisionTitle> {
    return prisma.divisionTitle.upsert({
      where: {
        leagueId_division_periodType_periodStart: {
          leagueId: input.leagueId,
          division: input.division,
          periodType: input.periodType,
          periodStart: input.periodStart,
        },
      },
      update: {},
      create: {
        leagueId: input.leagueId,
        division: input.division,
        periodType: input.periodType,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        userId: input.userId,
        userName: input.userName,
        points: input.points,
        decidedById: input.decidedById ?? null,
        note: input.note ?? null,
      },
    });
  },

  async findTitles(params: {
    leagueId?: string;
    periodType?: DivisionTitle["periodType"];
    userId?: string;
    take?: number;
  }): Promise<Array<DivisionTitle & { leagueName: string | null }>> {
    const leagues = await prisma.league.findMany({ select: { id: true, name: true } });
    const leagueNames = new Map(leagues.map((league) => [league.id, league.name]));
    const titles = await prisma.divisionTitle.findMany({
      where: {
        ...(params.leagueId ? { leagueId: params.leagueId } : {}),
        ...(params.periodType ? { periodType: params.periodType } : {}),
        ...(params.userId ? { userId: params.userId } : {}),
      },
      orderBy: [{ periodStart: "desc" }, { division: "asc" }],
      take: params.take ?? 200,
    });
    return titles.map((title) => ({ ...title, leagueName: leagueNames.get(title.leagueId) ?? null }));
  },

  async countMonthTitlesByUser(params: {
    leagueId: string;
    decidedBefore: Date;
  }): Promise<Map<string, number>> {
    const grouped = await prisma.divisionTitle.groupBy({
      by: ["userId"],
      where: {
        leagueId: params.leagueId,
        periodType: "MONTH",
        periodStart: { lt: params.decidedBefore },
      },
      _count: { _all: true },
    });
    return new Map(grouped.map((entry) => [entry.userId, entry._count._all]));
  },
};
