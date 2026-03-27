import { competitionEntryRepository } from "@/server/repositories/competition-entry-repository";
import { competitionRepository } from "@/server/repositories/competition-repository";
import { authService } from "@/server/services/auth-service";
import { activityService } from "@/server/services/activity-service";
import { competitionSseService } from "@/server/services/competition-sse-service";
import { prisma } from "@/server/db/client";

export const competitionEntryService = {
  async listByCompetition(competitionId: string) {
    return competitionEntryRepository.listByCompetition(competitionId);
  },

  async getById(id: string) {
    return competitionEntryRepository.findById(id);
  },

  async enrollUser(competitionId: string, userId: string) {
    const competition = await competitionRepository.findById(competitionId);
    if (!competition) {
      throw new Error("Competition not found");
    }

    const existing = await competitionEntryRepository.findByCompetitionAndUser(competitionId, userId);
    if (existing) {
      throw new Error("User already enrolled in this competition");
    }

    const entry = await competitionEntryRepository.create({
      competitionId,
      userId,
      present: false,
    });

    // Get user name for activity logging
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // Log activity
    await activityService.logCompetitionJoined({
      competitionId,
      competitionName: competition.name,
      userId,
      userName: user?.name || 'Unknown Agent',
    });

    competitionSseService.broadcast(competitionId, {
      type: 'entry_added',
      data: entry,
      timestamp: new Date().toISOString(),
    });

    return entry;
  },

  async updatePresence(entryId: string, present: boolean) {
    const entry = await competitionEntryRepository.update(entryId, { present });
    
    // Get competition and user details for activity logging
    const userId = entry.userId;
    const [competition, user] = await Promise.all([
      prisma.competition.findUnique({
        where: { id: entry.competitionId },
        select: { name: true },
      }),
      userId ? prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }) : Promise.resolve(null),
    ]);

    // Log competition_absent when marked as not present
    if (!present && competition && user && entry.userId) {
      await activityService.logCompetitionAbsent({
        competitionId: entry.competitionId,
        competitionName: competition.name,
        userId: entry.userId,
        userName: user.name,
      });
    }

    competitionSseService.broadcast(entry.competitionId, {
      type: 'presence_updated',
      data: entry,
      timestamp: new Date().toISOString(),
    });

    return entry;
  },

  async logScore(input: {
    entryId: string;
    ruleId?: string;
    value: number;
    isBonus?: boolean;
    bonusTeamId?: string;
  }) {
    const entry = await competitionEntryRepository.findById(input.entryId);
    if (!entry) {
      throw new Error("Entry not found");
    }

    const updated = await competitionEntryRepository.addScore(input.entryId, input.value);

    await competitionEntryRepository.createScoreLog({
      entryId: input.entryId,
      ruleId: input.ruleId,
      value: input.value,
      isBonus: input.isBonus,
      bonusTeamId: input.bonusTeamId,
    });

    // Get competition and user details for activity logging
    const userId = entry.userId;
    const [competition, user] = await Promise.all([
      prisma.competition.findUnique({
        where: { id: entry.competitionId },
        select: { name: true },
      }),
      userId ? prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      }) : Promise.resolve(null),
    ]);

    // Log activity
    if (competition && user && entry.userId) {
      await activityService.logCompetitionScoreLogged({
        competitionId: entry.competitionId,
        competitionName: competition.name,
        points: input.value,
        userId: entry.userId,
        userName: user.name,
      });
    }

    competitionSseService.broadcast(entry.competitionId, {
      type: 'score_logged',
      data: updated,
      timestamp: new Date().toISOString(),
    });

    return updated;
  },

  async logScoresForDate(competitionId: string, date: Date, scores: Array<{
    entryId: string;
    ruleId?: string;
    value: number;
    isBonus?: boolean;
    bonusTeamId?: string;
  }>) {
    const results = [];

    // Get competition details for activity logging
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { name: true },
    });

    for (const score of scores) {
      const entry = await competitionEntryRepository.findById(score.entryId);
      if (!entry || entry.competitionId !== competitionId) continue;

      const updated = await competitionEntryRepository.addScore(score.entryId, score.value);
      
      await competitionEntryRepository.createScoreLog({
        entryId: score.entryId,
        ruleId: score.ruleId,
        value: score.value,
        isBonus: score.isBonus,
        bonusTeamId: score.bonusTeamId,
      });

      // Log activity for each score
      if (competition && entry.userId) {
        const user = await prisma.user.findUnique({
          where: { id: entry.userId },
          select: { name: true },
        });

        await activityService.logCompetitionScoreLogged({
          competitionId,
          competitionName: competition.name,
          points: score.value,
          userId: entry.userId,
          userName: user?.name || 'Unknown Agent',
        });
      }

      results.push(updated);
    }

    competitionSseService.broadcast(competitionId, {
      type: 'scores_updated',
      data: { date: date.toISOString(), entryCount: results.length },
      timestamp: new Date().toISOString(),
    });

    return results;
  },

  async getScoresByDate(competitionId: string, date: Date) {
    return competitionEntryRepository.getScoreLogsByDate(competitionId, date);
  },

  async removeEntry(id: string) {
    const entry = await competitionEntryRepository.findById(id);
    if (!entry) {
      throw new Error("Entry not found");
    }

    await competitionEntryRepository.delete(id);

    competitionSseService.broadcast(entry.competitionId, {
      type: 'entry_removed',
      data: { id },
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  },
};
