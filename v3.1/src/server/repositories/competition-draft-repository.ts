import { Prisma } from '@prisma/client';
import { prisma } from "@/server/db/client";

export interface CompetitionDraftData {
  name?: string;
  description?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  rules?: Array<{
    id?: string;
    title: string;
    points: number;
    isCheckbox?: boolean;
    emoji?: string | null;
    dailyTarget?: number | null;
  }>;
  teams?: Array<{
    id?: string;
    name: string;
    agentIds?: string[];
    emoji?: string | null;
  }>;
  podIds?: string[];
  campaignId?: string;
  dailyTargets?: Record<string, number>;
  currentStep?: number;
}

export const competitionDraftRepository = {
  async list() {
    return prisma.competition.findMany({
      where: { isDraft: true },
      include: {
        createdBy: true,
        rules: true,
        teams: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  },

  async findById(id: string) {
    return prisma.competition.findUnique({
      where: { id },
      include: {
        createdBy: true,
        rules: true,
        teams: true,
      },
    });
  },

  async findByUser(userId: string) {
    return prisma.competition.findMany({
      where: {
        isDraft: true,
        createdById: userId,
      },
      include: {
        rules: true,
        teams: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  },

  async create(data: {
    name?: string;
    description?: string;
    draftData?: CompetitionDraftData;
    createdById: string;
  }) {
    return prisma.competition.create({
      data: {
        name: data.name || 'Untitled Competition',
        description: data.description,
        isDraft: true,
        draftData: data.draftData as any,
        createdById: data.createdById,
      },
      include: {
        createdBy: true,
      },
    });
  },

  async update(id: string, data: {
    name?: string;
    description?: string;
    startsAt?: Date | null;
    endsAt?: Date | null;
    draftData?: CompetitionDraftData;
    rules?: Array<{
      title: string;
      points: number;
      isCheckbox?: boolean;
      emoji?: string | null;
      dailyTarget?: number | null;
    }>;
    teams?: Array<{
      name: string;
      agentIds?: string[];
      emoji?: string | null;
    }>;
  }) {
    // First get existing competition
    const existing = await prisma.competition.findUnique({
      where: { id },
      include: { rules: true, teams: true },
    });

    if (!existing) {
      throw new Error('Competition not found');
    }

    // If rules are provided, delete old rules and create new ones
    if (data.rules) {
      await prisma.competitionRule.deleteMany({
        where: { competitionId: id },
      });
      await prisma.competitionRule.createMany({
        data: data.rules.map((rule) => ({
          competitionId: id,
          title: rule.title,
          points: rule.points,
          isCheckbox: rule.isCheckbox ?? false,
          emoji: rule.emoji ?? null,
          dailyTarget: rule.dailyTarget ?? null,
        })),
      });
    }

    // If teams are provided, delete old teams and create new ones
    if (data.teams) {
      await prisma.competitionTeam.deleteMany({
        where: { competitionId: id },
      });
      await prisma.competitionTeam.createMany({
        data: data.teams.map((team) => ({
          competitionId: id,
          name: team.name,
          agentIds: team.agentIds ?? [],
          emoji: team.emoji ?? null,
        })),
      });
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.startsAt !== undefined) updateData.startsAt = data.startsAt;
    if (data.endsAt !== undefined) updateData.endsAt = data.endsAt;
    if (data.draftData !== undefined) updateData.draftData = data.draftData as Prisma.InputJsonValue;

    return prisma.competition.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: true,
        rules: true,
        teams: true,
      },
    });
  },

  async publish(id: string) {
    return prisma.competition.update({
      where: { id },
      data: {
        isDraft: false,
        draftData: Prisma.JsonNull,
      },
      include: {
        rules: true,
        teams: true,
      },
    });
  },

  async delete(id: string) {
    // First delete related data
    await prisma.competitionRule.deleteMany({
      where: { competitionId: id },
    });
    await prisma.competitionTeam.deleteMany({
      where: { competitionId: id },
    });
    await prisma.competitionEntry.deleteMany({
      where: { competitionId: id },
    });

    return prisma.competition.delete({
      where: { id },
    });
  },
};
