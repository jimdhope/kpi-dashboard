import { prisma } from "@/server/db/client";

export const competitionRepository = {
  async listActive() {
    return prisma.competition.findMany({
      where: {
        startsAt: { lte: new Date() },
        endsAt: { gte: new Date() },
      },
      include: {
        _count: {
          select: { entries: true },
        },
      },
      orderBy: { startsAt: 'desc' },
    });
  },

  async findById(id: string) {
    return prisma.competition.findUnique({
      where: { id },
      include: {
        rules: true,
        teams: true,
      },
    });
  },

  async getRankings(competitionId: string) {
    const comp = await this.findById(competitionId);
    if (!comp) return [];

    // Aggregating TrackerLog data for all users enrolled in the competition
    // Note: V3 links users to competitions via entries.
    // Each entry score = SUM(trackerLog values for user between startsAt and endsAt)
    // Actually, V3 might have specific Rules for competitions.
    
    const entries = await prisma.competitionEntry.findMany({
      where: { competitionId, userId: { not: null } },
      include: {
        user: true,
      },
    });

    const rankings = await Promise.all(
      entries.map(async (entry) => {
        if (!entry.user) return null;
        const score = await prisma.trackerLog.aggregate({
          where: {
            userId: entry.userId as string,
            loggedAt: {
              gte: comp.startsAt || undefined,
              lte: comp.endsAt || undefined,
            },
          },
          _sum: { value: true },
        });

        return {
          id: entry.id,
          userId: entry.userId!,
          name: entry.user.name,
          score: score._sum.value?.toNumber() || 0,
          rank: 0,
          createdAt: entry.createdAt.toISOString(),
          updatedAt: entry.updatedAt.toISOString(),
        };
      })
    );

    const validRankings = (rankings.filter((r) => r !== null) as any[]);

    return validRankings
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .map((r, i) => ({ ...r, rank: i + 1 }));
  },
};
