import { prisma } from "@/server/db/client";

export const competitionEntryRepository = {
  async listByCompetition(competitionId: string) {
    return prisma.competitionEntry.findMany({
      where: { competitionId },
      include: {
        user: true,
        scoreLogs: {
          include: {
            entry: true,
          },
          orderBy: { loggedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  async findById(id: string) {
    return prisma.competitionEntry.findUnique({
      where: { id },
      include: {
        user: true,
        scoreLogs: {
          orderBy: { loggedAt: 'desc' },
        },
      },
    });
  },

  async findByCompetitionAndUser(competitionId: string, userId: string) {
    return prisma.competitionEntry.findFirst({
      where: { competitionId, userId },
      include: {
        user: true,
        scoreLogs: true,
      },
    });
  },

  async create(data: {
    competitionId: string;
    userId: string;
    score?: number;
    present?: boolean;
    notes?: string;
  }) {
    return prisma.competitionEntry.create({
      data: {
        competitionId: data.competitionId,
        userId: data.userId,
        score: data.score || 0,
        present: data.present ?? false,
        notes: data.notes,
      },
      include: {
        user: true,
      },
    });
  },

  async update(id: string, data: {
    score?: number;
    present?: boolean;
    notes?: string;
  }) {
    const updateData: Record<string, unknown> = {};
    if (data.score !== undefined) updateData.score = data.score;
    if (data.present !== undefined) updateData.present = data.present;
    if (data.notes !== undefined) updateData.notes = data.notes;

    return prisma.competitionEntry.update({
      where: { id },
      data: updateData,
      include: {
        user: true,
      },
    });
  },

  async addScore(id: string, value: number) {
    return prisma.competitionEntry.update({
      where: { id },
      data: {
        score: { increment: value },
      },
      include: {
        user: true,
      },
    });
  },

  async delete(id: string) {
    return prisma.competitionEntry.delete({
      where: { id },
    });
  },

  async deleteByCompetition(competitionId: string) {
    return prisma.competitionEntry.deleteMany({
      where: { competitionId },
    });
  },

  // Score logs
  async createScoreLog(data: {
    entryId: string;
    ruleId?: string;
    value: number;
    isBonus?: boolean;
    bonusTeamId?: string;
  }) {
    return prisma.competitionScoreLog.create({
      data: {
        entryId: data.entryId,
        ruleId: data.ruleId,
        value: data.value,
        isBonus: data.isBonus ?? false,
        bonusTeamId: data.bonusTeamId,
      },
    });
  },

  async getScoreLogsByEntry(entryId: string) {
    return prisma.competitionScoreLog.findMany({
      where: { entryId },
      orderBy: { loggedAt: 'desc' },
    });
  },

  async getScoreLogsByDate(competitionId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const entries = await prisma.competitionEntry.findMany({
      where: { competitionId },
      include: {
        user: true,
        scoreLogs: {
          where: {
            loggedAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        },
      },
    });

    return entries;
  },
};
