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
    campaignId?: string;
    podIds?: string[];
    createdById: string;
  }) {
    // Validate campaignId exists if provided
    if (data.campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: data.campaignId },
        select: { id: true },
      });
      if (!campaign) {
        throw new Error("Campaign not found");
      }
    }

    // Create the competition first
    const competition = await prisma.competition.create({
      data: {
        name: data.name || 'Untitled Competition',
        description: data.description,
        isDraft: true,
        campaignId: data.campaignId,
        podIds: data.podIds,
        createdById: data.createdById,
      },
      include: {
        createdBy: true,
      },
    });

    // Create rules if provided
    if (data.rules && data.rules.length > 0) {
      await prisma.competitionRule.createMany({
        data: data.rules.map((rule) => ({
          competitionId: competition.id,
          title: rule.title,
          points: rule.points,
          isCheckbox: rule.isCheckbox ?? false,
          emoji: rule.emoji ?? null,
          dailyTarget: rule.dailyTarget ?? null,
        })),
      });
    }

    // Create teams if provided
    if (data.teams && data.teams.length > 0) {
      await prisma.competitionTeam.createMany({
        data: data.teams.map((team) => ({
          competitionId: competition.id,
          name: team.name,
          agentIds: team.agentIds ?? [],
          emoji: team.emoji ?? null,
        })),
      });
    }

    // Update draftData with rules and teams for redundancy
    const draftData: CompetitionDraftData = {
      ...(data.draftData || {}),
      rules: data.rules,
      teams: data.teams,
      campaignId: data.campaignId,
      podIds: data.podIds,
    };

    const updated = await prisma.competition.update({
      where: { id: competition.id },
      data: { draftData: draftData as Prisma.InputJsonValue },
      include: {
        createdBy: true,
        rules: true,
        teams: true,
      },
    });

    return updated;
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
    campaignId?: string | null;
    podIds?: string[];
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

    // Build the update data, extracting campaignId and podIds from draftData if provided
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.startsAt !== undefined) updateData.startsAt = data.startsAt;
    if (data.endsAt !== undefined) updateData.endsAt = data.endsAt;
    
    // Handle campaignId - validate if being set to a new value
    if (data.campaignId !== undefined) {
      const newCampaignId = data.campaignId || null;
      if (newCampaignId) {
        const campaign = await prisma.campaign.findUnique({
          where: { id: newCampaignId },
          select: { id: true },
        });
        if (!campaign) {
          throw new Error("Campaign not found");
        }
      }
      updateData.campaignId = newCampaignId;
    }
    if (data.podIds !== undefined) {
      updateData.podIds = data.podIds;
    }
    
    // Merge draftData with rules and teams for redundancy
    // This ensures the wizard can always load from draftData
    const existingDraftData = (existing.draftData as CompetitionDraftData) || {};
    const mergedDraftData: CompetitionDraftData = {
      ...existingDraftData,
      ...(data.draftData || {}),
    };
    
    // Always save rules and teams to draftData for redundancy
    // This ensures the wizard can load data even if the related tables are empty
    if (data.rules) {
      mergedDraftData.rules = data.rules;
    }
    if (data.teams) {
      mergedDraftData.teams = data.teams;
    }
    if (data.campaignId !== undefined) {
      mergedDraftData.campaignId = data.campaignId || undefined;
    }
    if (data.podIds !== undefined) {
      mergedDraftData.podIds = data.podIds;
    }
    
    updateData.draftData = mergedDraftData as Prisma.InputJsonValue;

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
