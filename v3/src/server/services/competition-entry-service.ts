import { competitionEntryRepository } from "@/server/repositories/competition-entry-repository";
import { competitionRepository } from "@/server/repositories/competition-repository";
import { authService } from "@/server/services/auth-service";
import { competitionSseService } from "@/server/services/competition-sse-service";

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

    competitionSseService.broadcast(competitionId, {
      type: 'entry_added',
      data: entry,
      timestamp: new Date().toISOString(),
    });

    return entry;
  },

  async updatePresence(entryId: string, present: boolean) {
    const entry = await competitionEntryRepository.update(entryId, { present });
    
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
