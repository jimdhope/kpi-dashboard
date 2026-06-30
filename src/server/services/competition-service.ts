import { competitionRepository } from "@/server/repositories/competition-repository";
import { competitionEntryRepository } from "@/server/repositories/competition-entry-repository";
import { authService } from "@/server/services/auth-service";
import { requireCompetitionEditor } from "@/server/services/authorization";
import { activityService } from "@/server/services/activity-service";
import { prisma } from "@/server/db/client";
import { competitionSseService } from "@/server/services/competition-sse-service";

export interface DashboardLeaderboard {
  competitionId: string;
  name: string;
  rankings: Array<{
    id: string;
    competitionId: string;
    userId: string;
    userName: string;
    score: number;
    rank: number;
    isCurrent: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}

export const competitionService = {
  async getLeaderboard(competitionId: string): Promise<DashboardLeaderboard> {
    const comp = await competitionRepository.findById(competitionId);
    if (!comp) throw new Error("Competition not found");

    const currentUser = await authService.getCurrentSession();
    const rankings = await competitionRepository.getRankings(competitionId);

    return {
      competitionId,
      name: comp.name,
      rankings: rankings.slice(0, 10).map((r) => ({
        id: r.id,
        competitionId: competitionId,
        userId: r.userId as string,
        userName: r.name,
        score: r.score,
        rank: r.rank,
        isCurrent: r.userId === currentUser.user?.id,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    };
  },

  async joinCompetition(competitionId: string, teamId?: string) {
    const user = await authService.requireCurrentUser();
    
    // Get competition details
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: { teams: true },
    });
    
    if (!competition) throw new Error("Competition not found");
    
    // Get team name if teamId provided
    const team = teamId ? competition.teams.find(t => t.id === teamId) : null;
    
    // Log activity
    await activityService.logCompetitionJoined({
      competitionId,
      competitionName: competition.name,
      teamName: team?.name,
      userId: user.id,
      userName: user.name,
    });
    
    // Return success (entry logic would go here)
    return { success: true, competitionId };
  },

  async listCompetitions(includeDrafts = false) {
    try {
      await authService.requireCurrentUser(); // Any authenticated user can view
    } catch (error) {
      console.error('listCompetitions: User authentication failed:', error);
      throw error;
    }
    
    const comps = await prisma.competition.findMany({
      where: includeDrafts ? {} : { isDraft: false },
      include: {
        rules: true,
        teams: true,
        entries: { include: { user: true } },
        campaign: true,
        _count: { select: { entries: true } },
        createdBy: true,
      },
      orderBy: [
        { startsAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return comps.map(c => ({
      ...c,
      rules: c.rules,
      teams: c.teams,
      draftData: c.draftData,
      entries: c.entries.map(e => ({
        id: e.id,
        competitionId: e.competitionId,
        userId: e.userId,
        userName: e.user?.name || "Unknown",
        score: e.score,
        present: e.present,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
      startsAt: c.startsAt?.toISOString() || null,
      endsAt: c.endsAt?.toISOString() || null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  },

  async createCompetition(payload: any) {
    await requireCompetitionEditor();
    const user = await authService.requireCurrentUser();
    
    // Extract nested arrays for separate handling
    const { rules, teams, ...rest } = payload;
    
    // Create the competition first
    const competition = await prisma.competition.create({
      data: {
        ...rest,
        createdById: user.id,
      },
    });
    
    // Create rules if provided
    if (rules && rules.length > 0) {
      await prisma.competitionRule.createMany({
        data: rules.map((r: any) => ({
          competitionId: competition.id,
          title: r.title,
          points: r.points,
          isCheckbox: r.isCheckbox ?? false,
          emoji: r.emoji ?? null,
          dailyTarget: r.dailyTarget ?? null,
        })),
      });
    }
    
    // Create teams if provided
    if (teams && teams.length > 0) {
      await prisma.competitionTeam.createMany({
        data: teams.map((t: any) => ({
          competitionId: competition.id,
          name: t.name,
          agentIds: t.agentIds ?? [],
          emoji: t.emoji ?? null,
        })),
      });
    }

    // Auto-enroll all users from participating pods
    if (competition.podIds && competition.podIds.length > 0) {
      const podUsers = await prisma.user.findMany({
        where: { podId: { in: competition.podIds } },
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
    
    // Fetch the complete competition with rules and teams
    const completeCompetition = await prisma.competition.findUnique({
      where: { id: competition.id },
      include: { rules: true, teams: true },
    });

    if (!completeCompetition) {
      throw new Error("Failed to create competition");
    }

    // Log activity for competition creation
    await activityService.logCompetitionStarted({
      competitionId: completeCompetition.id,
      competitionName: completeCompetition.name,
      userId: user.id,
      userName: user.name,
    });

    // Broadcast new competition
    competitionSseService.broadcast(completeCompetition.id, {
      type: 'competition_created',
      data: completeCompetition,
      timestamp: new Date().toISOString(),
    });

    return completeCompetition;
  },

  async updateCompetition(id: string, payload: any) {
    await requireCompetitionEditor();
    
    // Extract nested arrays for separate handling
    const { rules, teams, ...rest } = payload;
    
    // Update basic competition data
    await prisma.competition.update({
      where: { id },
      data: rest,
    });
    
    // Handle rules update - delete and recreate
    if (rules !== undefined) {
      await prisma.competitionRule.deleteMany({ where: { competitionId: id } });
      if (rules.length > 0) {
        await prisma.competitionRule.createMany({
          data: rules.map((r: any) => ({
            competitionId: id,
            title: r.title,
            points: r.points,
            isCheckbox: r.isCheckbox ?? false,
            emoji: r.emoji ?? null,
            dailyTarget: r.dailyTarget ?? null,
          })),
        });
      }
    }
    
    // Handle teams update - delete and recreate
    if (teams !== undefined) {
      await prisma.competitionTeam.deleteMany({ where: { competitionId: id } });
      if (teams.length > 0) {
        await prisma.competitionTeam.createMany({
          data: teams.map((t: any) => ({
            competitionId: id,
            name: t.name,
            agentIds: t.agentIds ?? [],
            emoji: t.emoji ?? null,
          })),
        });
      }
    }
    
    // Fetch and return updated competition
    const competition = await prisma.competition.findUnique({
      where: { id },
      include: {
        rules: true,
        teams: true,
        campaign: true,
      },
    });

    // Broadcast update
    competitionSseService.broadcast(id, {
      type: 'competition_updated',
      data: competition,
      timestamp: new Date().toISOString(),
    });

    return competition;
  },

  async deleteCompetition(id: string) {
    await authService.requireAdmin(); // Only admin can delete
    
    // Delete related data first
    await prisma.competitionScoreLog.deleteMany({
      where: { entry: { competitionId: id } },
    });
    await prisma.competitionEntry.deleteMany({
      where: { competitionId: id },
    });
    await prisma.competitionRule.deleteMany({
      where: { competitionId: id },
    });
    await prisma.competitionTeam.deleteMany({
      where: { competitionId: id },
    });

    const competition = await prisma.competition.delete({
      where: { id },
    });

    // Broadcast deletion
    competitionSseService.broadcast(id, {
      type: 'competition_deleted',
      data: { id },
      timestamp: new Date().toISOString(),
    });

    return competition;
  },

  async getSummaries() {
    const comps = await prisma.competition.findMany({
      orderBy: [
        { startsAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    
    return Promise.all(comps.map(async (c) => {
      const stats = await this.getLeaderboard(c.id);
      return {
        competitionId: c.id,
        competitionName: c.name,
        totalEntries: stats.rankings.length,
        topScore: stats.rankings[0]?.score || 0,
        leaderboard: stats.rankings,
      };
    }));
  },

  async logScore(input: { competitionId: string; userId?: string | null; score: number }) {
    const user = await authService.requireCurrentUser();
    const targetUserId = input.userId || user.id;

    const entry = await prisma.competitionEntry.findFirst({
      where: { userId: targetUserId, competitionId: input.competitionId },
      include: { competition: true },
    });

    if (!entry) throw new Error("Participant not enrolled in this competition.");

    // Update the entry
    const updatedEntry = await prisma.competitionEntry.update({
      where: { id: entry.id },
      data: { score: { increment: input.score } },
    });

    // Log activity
    await activityService.logCompetitionScoreLogged({
      competitionId: input.competitionId,
      competitionName: entry.competition.name,
      points: input.score,
      userId: targetUserId,
      userName: user.name,
    });

    return updatedEntry;
  },

  async getTeamStandings(competitionId: string): Promise<{
    teams: Array<{ id: string; name: string; emoji?: string; score: number; rank: number }>
  }> {
    const comp = await competitionRepository.findById(competitionId);
    if (!comp) return { teams: [] };

    const rankings = await competitionRepository.getRankings(competitionId);
    
    // Group scores by team
    const teamScores: Record<string, { name: string; emoji?: string; score: number }> = {};
    
    for (const team of comp.teams) {
      teamScores[team.id] = {
        name: team.name,
        emoji: team.emoji || undefined,
        score: 0,
      };
    }

    // Sum scores for each team
    for (const entry of rankings) {
      // Find which team this user belongs to
      // Note: team.agentIds now store database IDs (migrated from Firebase UIDs)
      for (const team of comp.teams) {
        if (team.agentIds.includes(entry.userId)) {
          teamScores[team.id].score += entry.score;
          break;
        }
      }
    }

    // Convert to array and sort
    const teams = Object.entries(teamScores)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.score - a.score)
      .map((t, i) => ({ ...t, rank: i + 1 }));

    return { teams };
  },

  async getPodStandings(competitionId: string): Promise<{
    pods: Array<{ id: string; name: string; score: number; rank: number }>
  }> {
    const comp = await competitionRepository.findById(competitionId);
    if (!comp) return { pods: [] };

    const rankings = await competitionRepository.getRankings(competitionId);
    
    // Get pod info from entries
    const podScores: Record<string, { name: string; score: number }> = {};
    
    // For each entry, find the user's pod
    for (const entry of rankings) {
      // This would need to look up the user's pod - for now aggregate all scores
      // In a full implementation, you'd look up the pod from the entry or user
    }

    // For now, return empty - this would need proper pod linking
    // The actual pod standings would require linking entries to pods
    return { pods: [] };
  },
};
