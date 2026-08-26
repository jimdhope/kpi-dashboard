import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { getBoss } from "@/server/jobs/boss";
import { QUEUES } from "@/server/jobs/queues";
import { sendDailyScoresFromWorker } from "@/server/services/send-daily-scores-service";

function latestDate(values: Array<Date | null | undefined>) {
  return values.reduce<Date | null>((latest, value) => value && (!latest || value > latest) ? value : latest, null);
}

export async function registerCompetitionTeamsAutoUpdateWorker() {
  const boss = await getBoss();
  await boss.work(QUEUES.competitionTeamsAutoUpdate, async () => {
    const now = new Date();
    const competitions = await prisma.competition.findMany({
      where: { autoTeamsUpdates: true, isDraft: false, startsAt: { lte: now }, endsAt: { gte: now } },
      select: { id: true, podIds: true, lastAutoTeamsScoreAt: true, lastAutoTeamsSentAt: true, updatedAt: true },
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
      // Date corrections (e.g. extending endsAt after a mis-save) must also
      // trigger a post even when no fresh score events exist, otherwise an
      // expired-then-fixed competition never resumes auto posting.
      //
      // Compare updatedAt against lastAutoTeamsSENTat, NOT lastAutoTeamsScoreAt:
      // the worker's own success-write bumps updatedAt on every send, so using
      // the score watermark here would make every tick look "changed" forever.
      // The worker's own success-write bumps updatedAt, so a fixed epsilon is
      // required: treat updatedAt as "changed" only when it exceeds the sent
      // watermark by more than 2 seconds (Prisma writes land within ms).
      const configChanged = Boolean(
        competition.updatedAt &&
        (!competition.lastAutoTeamsSentAt ||
          competition.updatedAt.getTime() - competition.lastAutoTeamsSentAt.getTime() > 2000),
      );
      const changedAt = configChanged
        ? latestDate([scoreChangedAt, competition.updatedAt])
        : scoreChangedAt;
      if (
        !changedAt ||
        (competition.lastAutoTeamsScoreAt && changedAt <= competition.lastAutoTeamsScoreAt)
      ) {
        console.info("[teams-auto-update] skip", {
          competitionId: competition.id,
          reason: "already-sent",
        });
        continue;
      }
      if (!competition.podIds.length) {
        console.info("[teams-auto-update] skip", {
          competitionId: competition.id,
          reason: "no-pods",
        });
        continue;
      }

      const date = now.toISOString().slice(0, 10);
      const request = new NextRequest(`http://internal/competitions/${competition.id}/send-daily-scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, podIds: competition.podIds, tableFormat: "separate" }),
      });
      const response = await sendDailyScoresFromWorker(request, competition.id);
      const result = await response.json() as { totalSent?: number; totalFailed?: number };
      if (response.ok && (result.totalSent ?? 0) > 0 && (result.totalFailed ?? 0) === 0) {
        await prisma.competition.update({
          where: { id: competition.id },
          data: {
            ...(changedAt ? { lastAutoTeamsScoreAt: changedAt } : {}),
            // Stamp the send with the change time itself so updatedAt (bumped by
            // this very write) always compares >= sent watermark and can never
            // re-trigger the gate on subsequent ticks.
            lastAutoTeamsSentAt: changedAt ?? new Date(),
          },
        });
      }
    }
  });
}
