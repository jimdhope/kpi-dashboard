import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const RANK_BONUSES: Record<number, number> = { 1: 100, 2: 50, 3: 25 };

function calculateLevel(totalXp: number): { level: number; title: string } {
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
    if (totalXp >= thresholds[i].minXp) {
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

    for (const agent of ranked) {
      const rankBonus = RANK_BONUSES[agent.rank] ?? 0;
      const xpEarned = agent.totalScore + rankBonus;

      let profile = await prisma.agentProfile.findUnique({ where: { userId: agent.userId } });
      if (!profile) {
        profile = await prisma.agentProfile.create({ data: { userId: agent.userId } });
      }

      await prisma.competitionResult.create({
        data: {
          agentProfileId: profile.id,
          competitionId: competition.id,
          rank: agent.rank,
          totalScore: agent.totalScore,
          xpEarned,
          wasPresent: agent.wasPresent,
        },
      });

      if (agent.totalScore > 0) {
        await prisma.xpTransaction.create({
          data: { userId: agent.userId, amount: agent.totalScore, source: "competition_score", sourceId: competition.id },
        });
      }

      if (rankBonus > 0) {
        await prisma.xpTransaction.create({
          data: { userId: agent.userId, amount: rankBonus, source: "rank_bonus", sourceId: competition.id },
        });
      }

      const newTotalXp = profile.totalXp + xpEarned;
      const { level, title } = calculateLevel(newTotalXp);

      await prisma.agentProfile.update({
        where: { id: profile.id },
        data: { totalXp: newTotalXp },
      });

      if (agent.rank === 1) {
        const existingStreak = await prisma.streak.findUnique({
          where: { agentProfileId_type: { agentProfileId: profile.id, type: "win" } },
        });
        const newCount = (existingStreak?.currentCount ?? 0) + 1;
        await prisma.streak.upsert({
          where: { agentProfileId_type: { agentProfileId: profile.id, type: "win" } },
          create: { agentProfileId: profile.id, type: "win", currentCount: 1, longestCount: 1 },
          update: { currentCount: newCount, longestCount: Math.max(newCount, existingStreak?.longestCount ?? 0) },
        });
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
