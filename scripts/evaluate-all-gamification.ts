import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const RANK_BONUSES: Record<number, number> = { 1: 100, 2: 50, 3: 25 };

function calculateLevel(totalPoints: number): { level: number; title: string } {
  const thresholds = [
    { minXp: 0, title: "Rookie" },
    { minXp: 500, title: "Bronze" },
    { minXp: 1_500, title: "Silver" },
    { minXp: 3_500, title: "Gold" },
    { minXp: 7_000, title: "Platinum" },
    { minXp: 12_000, title: "Diamond" },
  ];
  let level = 1;
  let title = thresholds[0].title;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (totalPoints >= thresholds[i].minXp) {
      level = i + 1;
      title = thresholds[i].title;
      break;
    }
  }
  return { level, title };
}

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/kpi_quest_v3";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const competitions = await prisma.competition.findMany({
    where: {
      isDraft: false,
      endsAt: { lte: new Date() },
    },
    orderBy: { endsAt: "asc" },
  });

  console.log(`Found ${competitions.length} completed competitions.`);

  for (const competition of competitions) {
    const existing = await prisma.competitionResult.findFirst({
      where: { competitionId: competition.id },
    });
    if (existing) {
      console.log(`  Skipping "${competition.name}" — already evaluated.`);
      continue;
    }

    console.log(`  Evaluating "${competition.name}"...`);

    const entries = await prisma.competitionEntry.findMany({
      where: { competitionId: competition.id },
      include: {
        user: true,
      },
    });

    const dailyScores = await prisma.dailyAchievement.groupBy({
      by: ["agentId"],
      where: { competitionId: competition.id },
      _sum: { points: true },
    });
    const scoreMap = new Map(dailyScores.map((d) => [d.agentId, d._sum.points ?? 0]));

    const agentScores: Array<{
      userId: string;
      agentName: string;
      totalScore: number;
      wasPresent: boolean;
    }> = [];

    for (const entry of entries) {
      if (!entry.userId || !entry.user) continue;
      const score = scoreMap.get(entry.userId) ?? 0;
      agentScores.push({
        userId: entry.userId,
        agentName: entry.user.name || entry.user.email || "Unknown",
        totalScore: score,
        wasPresent: entry.present,
      });
    }

    const sorted = agentScores.sort((a, b) => b.totalScore - a.totalScore);
    let denseRank = 0;
    let prevScore: number | null = null;
    const ranked = sorted.map((agent) => {
      if (agent.totalScore !== prevScore) {
        denseRank++;
        prevScore = agent.totalScore;
      }
      return { ...agent, rank: denseRank };
    });

    const endDate = competition.endsAt ?? new Date();

    for (const agent of ranked) {
      const rankBonus = RANK_BONUSES[agent.rank] ?? 0;
      const pointsEarned = agent.totalScore + rankBonus;

      await prisma.competitionResult.create({
        data: {
          userId: agent.userId,
          competitionId: competition.id,
          rank: agent.rank,
          totalScore: agent.totalScore,
          xpEarned: pointsEarned,
          wasPresent: agent.wasPresent,
          createdAt: endDate,
        },
      });

      const user = await prisma.user.findUnique({ where: { id: agent.userId } });
      if (!user) continue;

      const newTotalPoints = user.totalPoints + pointsEarned;
      const { level, title } = calculateLevel(newTotalPoints);

      await prisma.user.update({
        where: { id: agent.userId },
        data: { totalPoints: newTotalPoints },
      });

      // Check badges
      const existingAgentBadges = await prisma.agentBadge.findMany({
        where: { userId: agent.userId },
        include: { badge: true },
      });
      const existingBadgeKeys = new Set(existingAgentBadges.map((ab) => ab.badge.key));

      const resultCount = await prisma.competitionResult.count({
        where: { userId: agent.userId },
      });

      // Compute win streak from competition results
      const winResults = await prisma.competitionResult.findMany({
        where: { userId: agent.userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      let winStreak = 0;
      for (const r of winResults) {
        if (r.rank === 1) winStreak++;
        else break;
      }

      const mostRecentScore = await prisma.competitionResult.findFirst({
        where: { totalScore: { gt: 0 } },
        orderBy: { totalScore: "desc" },
        select: { totalScore: true },
      });
      const highestEver = mostRecentScore?.totalScore ?? 0;

      const scriptBadgeChecks = [
        { key: "first_win", condition: agent.rank === 1 && !existingBadgeKeys.has("first_win") },
        { key: "podium", condition: agent.rank <= 3 },
        { key: "veteran", condition: resultCount >= 10 },
        { key: "streak_3", condition: winStreak >= 3 },
        { key: "streak_5", condition: winStreak >= 5 },
        { key: "streak_10", condition: winStreak >= 10 },
        { key: "three_peat", condition: winStreak === 3 },
        { key: "perfect_attendance", condition: agent.wasPresent },
        { key: "score_machine", condition: agent.totalScore > highestEver },
      ];

      for (const check of scriptBadgeChecks) {
        if (!check.condition) continue;
        const badge = await prisma.badge.findUnique({ where: { key: check.key } });
        if (!badge) continue;
        if (!existingBadgeKeys.has(check.key)) {
          await prisma.agentBadge.create({
            data: {
              userId: agent.userId,
              badgeId: badge.id,
              context: { competitionId: competition.id, rank: agent.rank },
              earnedAt: endDate,
            },
          });
          console.log(`      Badge awarded: ${badge.name}`);
        }
      }
    }

    console.log(`    Processed ${ranked.length} agents.`);
  }

  console.log("Done!");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
