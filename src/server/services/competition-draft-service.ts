import { competitionDraftRepository, CompetitionDraftData } from "@/server/repositories/competition-draft-repository";
import { authService } from "@/server/services/auth-service";

export const competitionDraftService = {
  async list() {
    return competitionDraftRepository.list();
  },

  async listByUser() {
    const user = await authService.requireCurrentUser();
    return competitionDraftRepository.findByUser(user.id);
  },

  async getById(id: string) {
    return competitionDraftRepository.findById(id);
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
  }) {
    const user = await authService.requireCurrentUser();
    
    return competitionDraftRepository.create({
      name: data.name || 'Untitled Competition',
      description: data.description,
      draftData: data.draftData,
      rules: data.rules,
      teams: data.teams,
      campaignId: data.campaignId,
      podIds: data.podIds,
      createdById: user.id,
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
    campaignId?: string | null;
    podIds?: string[];
  }) {
    return competitionDraftRepository.update(id, data);
  },

  async saveStep(id: string, step: number, stepData: any) {
    const draft = await competitionDraftRepository.findById(id);
    if (!draft) {
      throw new Error("Draft not found");
    }

    const currentDraftData = (draft.draftData as CompetitionDraftData) || {};
    const updatedDraftData: CompetitionDraftData = {
      ...currentDraftData,
      currentStep: step,
      ...stepData,
    };

    return competitionDraftRepository.update(id, {
      draftData: updatedDraftData,
    });
  },

  async publish(id: string) {
    const draft = await competitionDraftRepository.findById(id);
    if (!draft) {
      throw new Error("Draft not found");
    }

    const draftData = (draft.draftData as CompetitionDraftData) || {};

    // Create the competition with all the data
    const { prisma } = await import("@/server/db/client");
    
    const competition = await prisma.competition.create({
      data: {
        name: draftData.name || draft.name,
        description: draftData.description || draft.description,
        startsAt: draftData.startsAt ? new Date(draftData.startsAt) : null,
        endsAt: draftData.endsAt ? new Date(draftData.endsAt) : null,
        podIds: draftData.podIds ?? [],
        isDraft: false,
        createdById: draft.createdById,
        rules: draftData.rules ? {
          create: draftData.rules.map(r => ({
            title: r.title,
            points: r.points,
            isCheckbox: r.isCheckbox ?? false,
            emoji: r.emoji ?? null,
            dailyTarget: r.dailyTarget ?? null,
          })),
        } : undefined,
        teams: draftData.teams ? {
          create: draftData.teams.map(t => ({
            name: t.name,
            agentIds: t.agentIds ?? [],
            emoji: t.emoji ?? null,
          })),
        } : undefined,
      },
      include: {
        rules: true,
        teams: true,
      },
    });

    // Auto-enroll all users from participating pods
    const podIds = draftData.podIds ?? [];
    if (podIds.length > 0) {
      const podUsers = await prisma.user.findMany({
        where: { podId: { in: podIds } },
        select: { id: true },
      });
      if (podUsers.length > 0) {
        await prisma.competitionEntry.createMany({
          data: podUsers.map((u) => ({
            competitionId: competition.id,
            userId: u.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Delete the draft
    await competitionDraftRepository.delete(id);

    return competition;
  },

  async delete(id: string) {
    return competitionDraftRepository.delete(id);
  },
};
