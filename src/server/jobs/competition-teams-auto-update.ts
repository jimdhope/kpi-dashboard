import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { getBoss } from "@/server/jobs/boss";
import { QUEUES } from "@/server/jobs/queues";
import { sendDailyScoresFromWorker } from "@/server/services/send-daily-scores-service";

function latestDate(values: Array<Date | null | undefined>) {
  return values.reduce<Date | null>((latest, value) => value && (!latest || value > latest) ? value : latest, null);
}

// Timestamps of the Competition rows this worker has already processed.
// The worker's own success-writes bump Competition.updatedAt, so timestamp
// deltas can never distinguish "someone edited the competition" from
// "we just sent". Comparing exact values can: an edit produces a NEW
// updatedAt; our own writes produce one we've recorded here.
// Keyed by competition id; safe to lose on restart (worst case: one
// extra post after a redeploy).
const seenConfigUpdatedAt = new Map<string, number>();

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
      // Config-change detection by exact updatedAt value, not timestamp deltas:
      // the worker's own success-write bumps Competition.updatedAt on every
      // send, so any comparison of updatedAt against a watermark drifts and
      // eventually always looks "changed". An external edit (date fix, pod
      // change, etc.) produces an updatedAt value we have never seen.
      const currentConfigUpdatedAt = competition.updatedAt?.getTime() ?? 0;
      const seenConfigUpdatedAtValue = seenConfigUpdatedAt.get(competition.id);
      const configChanged =
        seenConfigUpdatedAtValue !== undefined &&
        seenConfigUpdatedAtValue !== currentConfigUpdatedAt;
      // First tick after restart: adopt the current value without posting
      // unless score activity itself justifies the send. This avoids a burst
      // post on every deploy.
      if (seenConfigUpdatedAtValue === undefined) {
        seenConfigUpdatedAt.set(competition.id, currentConfigUpdatedAt);
      }
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
        // Re-read the row's post-write updatedAt and record it so this worker
        // never mistakes its own success-write for an external config edit.
        const updated = await prisma.competition.update({
          where: { id: competition.id },
          data: {
            ...(changedAt ? { lastAutoTeamsScoreAt: changedAt } : {}),
            lastAutoTeamsSentAt: changedAt ?? new Date(),
          },
          select: { updatedAt: true },
        });
        seenConfigUpdatedAt.set(competition.id, updated.updatedAt.getTime());
      }
    }
  });
}
