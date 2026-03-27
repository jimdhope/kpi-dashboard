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
    await authService.requireCurrentUser(); // Any authenticated user can view
    const comps = await prisma.competition.findMany({
      where: includeDrafts ? {} : { isDraft: false },
      include: {
        rules: true,
        teams: true,
        entries: { include: { user: true } },
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
    
    const competition = await prisma.competition.create({
      data: {
        ...payload,
        createdById: user.id,
      },
      include: {
        rules: true,
        teams: true,
      },
    });

    // Broadcast new competition
    competitionSseService.broadcast(competition.id, {
      type: 'competition_created',
      data: competition,
      timestamp: new Date().toISOString(),
    });

    return competition;
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
};
