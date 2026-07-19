import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { getBoss } from "@/server/jobs/boss";
import { QUEUES } from "@/server/jobs/queues";
import { sendDailyScoresFromWorker } from "@/app/api/competitions/[id]/send-daily-scores/route";

function latestDate(values: Array<Date | null | undefined>) {
  return values.reduce<Date | null>((latest, value) => value && (!latest || value > latest) ? value : latest, null);
}

export async function registerCompetitionTeamsAutoUpdateWorker() {
  const boss = await getBoss();
  await boss.work(QUEUES.competitionTeamsAutoUpdate, async () => {
    const now = new Date();
    const competitions = await prisma.competition.findMany({
      where: { autoTeamsUpdates: true, isDraft: false, startsAt: { lte: now }, endsAt: { gte: now } },
      select: { id: true, podIds: true, lastAutoTeamsScoreAt: true },
    });

    for (const competition of competitions) {
      const [newestEvent, newestVoid, newestBonus, newestBonusEdit] = await Promise.all([
        prisma.scoreEvent.findFirst({ where: { competitionId: competition.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
        prisma.scoreEvent.findFirst({ where: { competitionId: competition.id, voidedAt: { not: null } }, orderBy: { voidedAt: "desc" }, select: { voidedAt: true } }),
        prisma.teamBonusLog.findFirst({ where: { competitionId: competition.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
        prisma.teamBonusLog.findFirst({
          where: { competitionId: competition.id, loggedAt: { not: null } },
          orderBy: { loggedAt: "desc" },
          select: { loggedAt: true },
        }),
      ]);
      const scoreChangedAt = latestDate([
        newestEvent?.createdAt,
        newestVoid?.voidedAt,
        newestBonus?.createdAt,
        newestBonusEdit?.loggedAt,
      ]);
      if (!scoreChangedAt || (competition.lastAutoTeamsScoreAt && scoreChangedAt <= competition.lastAutoTeamsScoreAt)) continue;
      if (!competition.podIds.length) continue;

      const date = now.toISOString().slice(0, 10);
      const request = new NextRequest(`http://internal/competitions/${competition.id}/send-daily-scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, podIds: competition.podIds, tableFormat: "separate" }),
      });
      const response = await sendDailyScoresFromWorker(request, competition.id);
      const result = await response.json() as { totalSent?: number; totalFailed?: number };
      if (response.ok && (result.totalSent ?? 0) > 0 && (result.totalFailed ?? 0) === 0) {
        await prisma.competition.update({ where: { id: competition.id }, data: { lastAutoTeamsScoreAt: scoreChangedAt, lastAutoTeamsSentAt: new Date() } });
      }
    }
  });
}
