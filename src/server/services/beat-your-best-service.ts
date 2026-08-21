import "server-only";

import { cache } from "react";
import { prisma } from "@/server/db/client";
import { scoreEventRepository } from "@/server/repositories/score-event-repository";
import {
  computeBybStandings,
  selectBybPodChampions,
  type BybPlayerHistory,
  type BybPodChampion,
  type BybStandingsResult,
} from "@/server/services/beat-your-best";

export type BeatYourBestScope = "competition" | "campaign";

export type GetBeatYourBestStandingsOptions = {
  scope?: BeatYourBestScope;
  /** Empty/undefined = all pods. Ids are validated against the scoped pod set. */
  podIds?: string[];
};

export type BeatYourBestStandings = BybStandingsResult & {
  competition: { id: string; name: string };
  scope: BeatYourBestScope;
  campaign: { id: string; name: string } | null;
  /** Competitions whose score events feed the current view (for SSE subscriptions). */
  targetCompetitionIds: string[];
  pods: Array<{ id: string; name: string }>;
  podChampions: BybPodChampion[];
};

type ScopedCompetition = { id: string; startsAt: Date | null };

function earliestStart(competitions: ScopedCompetition[]): Date | null {
  return competitions.reduce<Date | null>((earliest, competition) => {
    if (!competition.startsAt) return earliest;
    if (!earliest || competition.startsAt < earliest) return competition.startsAt;
    return earliest;
  }, null);
}

export const beatYourBestService = {
  getStandings: cache(
    async (
      competitionId: string,
      options: GetBeatYourBestStandingsOptions = {},
    ): Promise<BeatYourBestStandings> => {
      const competition = await prisma.competition.findUnique({
        where: { id: competitionId },
        select: { id: true, name: true, isDraft: true, startsAt: true, campaignId: true, podIds: true },
      });
      if (!competition || competition.isDraft) {
        throw new Error("Competition not found");
      }

      const wantsCampaign = options.scope === "campaign" && Boolean(competition.campaignId);
      const scope: BeatYourBestScope = wantsCampaign ? "campaign" : "competition";

      const campaign = wantsCampaign
        ? await prisma.campaign.findUnique({
            where: { id: competition.campaignId! },
            select: { id: true, name: true },
          })
        : null;

      const targetCompetitions = wantsCampaign
        ? await prisma.competition.findMany({
            where: { isDraft: false, campaignId: competition.campaignId },
            select: { id: true, startsAt: true },
            orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
          })
        : [competition];
      const targetIds = targetCompetitions.map((target) => target.id);
      const targetIdSet = new Set(targetIds);

      const scopedPodIds = wantsCampaign
        ? [
            ...new Set(
              (
                await prisma.competition.findMany({
                  where: { id: { in: targetIds } },
                  select: { podIds: true },
                })
              ).flatMap((target) => target.podIds),
            ),
          ]
        : competition.podIds;

      const pods = await prisma.pod.findMany({
        where: { id: { in: scopedPodIds } },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      });
      const podNamesById = new Map(pods.map((pod) => [pod.id, pod.name]));

      const requestedPodIds = [...new Set(options.podIds ?? [])].filter((podId) =>
        podNamesById.has(podId),
      );
      const podFilter = requestedPodIds.length ? requestedPodIds : undefined;

      // Current period: active points inside the scope, optionally pod-filtered.
      const currentTotalsByUser = new Map<string, number>();
      if (scope === "competition") {
        const totals = await scoreEventRepository.getActiveTotalsByCompetition({
          competitionId,
          podIds: podFilter,
        });
        for (const total of totals) currentTotalsByUser.set(total.subjectAgentId, total.points);
      } else {
        const totals = await scoreEventRepository.getActiveTotalsAcrossCompetitions({
          competitionIds: targetIds,
          podIds: podFilter,
        });
        for (const total of totals) {
          currentTotalsByUser.set(
            total.subjectAgentId,
            (currentTotalsByUser.get(total.subjectAgentId) ?? 0) + total.points,
          );
        }
      }

      const [users, entries] = await Promise.all([
        prisma.user.findMany({ select: { id: true, name: true, podId: true } }),
        prisma.competitionEntry.findMany({
          where: { competitionId: { in: targetIds }, userId: { not: null } },
          select: { userId: true },
        }),
      ]);
      const namesById = new Map(users.map((user) => [user.id, user.name]));
      const primaryPodByUser = new Map<string, string | null>(users.map((user) => [user.id, user.podId]));

      const matchesPodFilter = (userId: string) => {
        if (!podFilter) return true;
        const userPodId = primaryPodByUser.get(userId);
        return Boolean(userPodId && podFilter.includes(userPodId));
      };

      const entrantIds = new Set<string>([
        ...currentTotalsByUser.keys(),
        ...entries.map((entry) => entry.userId!).filter(matchesPodFilter),
      ]);

      // Scoring weeks feeding the rolling best:
      // - competition scope: every earlier non-draft competition outside the current one;
      // - campaign scope: the campaign's own competitions (each one is a week), so the
      //   ratio reads "campaign-to-date points vs your best single campaign week".
      let historySourceIds: string[];
      if (scope === "competition") {
        const historyBoundary = earliestStart(targetCompetitions) ?? competition.startsAt;
        const priorCompetitions = await prisma.competition.findMany({
          where: {
            isDraft: false,
            id: { notIn: targetIds },
            ...(historyBoundary ? { startsAt: { lt: historyBoundary } } : {}),
          },
          select: { id: true },
          orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
        });
        historySourceIds = priorCompetitions.map((prior) => prior.id);
      } else {
        historySourceIds = targetIds;
      }
      const totalsIndex = new Map(historySourceIds.map((id, index) => [id, index]));

      const [historyTotals, priorEntries] = await Promise.all([
        scoreEventRepository.getActiveTotalsAcrossCompetitions({ competitionIds: historySourceIds }),
        historySourceIds.length
          ? prisma.competitionEntry.findMany({
              where: { competitionId: { in: historySourceIds }, userId: { not: null } },
              select: { userId: true, competitionId: true },
            })
          : Promise.resolve([]),
      ]);

      const historyByUser = new Map<string, BybPlayerHistory>();
      const ensureHistory = (userId: string): BybPlayerHistory => {
        let history = historyByUser.get(userId);
        if (!history) {
          history = {
            totals: new Array<number>(historySourceIds.length).fill(0),
            participated: new Array<boolean>(historySourceIds.length).fill(false),
          };
          historyByUser.set(userId, history);
        }
        return history;
      };

      for (const total of historyTotals) {
        const index = totalsIndex.get(total.competitionId);
        if (index === undefined) continue;
        ensureHistory(total.subjectAgentId).totals[index] = total.points;
        ensureHistory(total.subjectAgentId).participated[index] = true;
      }
      for (const entry of priorEntries) {
        if (!entry.userId) continue;
        const index = totalsIndex.get(entry.competitionId);
        if (index === undefined) continue;
        ensureHistory(entry.userId).participated[index] = true;
      }

      const currentWeek = [...entrantIds]
        .map((userId) => ({
          userId,
          name: namesById.get(userId) ?? userId,
          rawPoints: currentTotalsByUser.get(userId) ?? 0,
        }))
        .sort((a, b) => b.rawPoints - a.rawPoints || a.name.localeCompare(b.name));

      const result = computeBybStandings({ currentWeek, historyByUser });

      // Champions need an unfiltered, per-pod view and more than one pod.
      let podChampions: BybPodChampion[] = [];
      if (!podFilter && pods.length > 1) {
        const podTotals =
          scope === "competition"
            ? await scoreEventRepository.getActiveTotalsByCompetitionAndPod({ competitionId })
            : await scoreEventRepository.getActiveTotalsAcrossCompetitionsAndPod({
                competitionIds: targetIds,
              });
        podChampions = selectBybPodChampions({
          standings: result.standings,
          podTotals: podTotals.map((total) => ({
            podId: total.podId,
            userId: total.subjectAgentId,
            points: total.points,
          })),
          podNamesById,
        });
      }

      return {
        competition: { id: competition.id, name: competition.name },
        scope,
        campaign: campaign ?? null,
        targetCompetitionIds: targetIds,
        pods,
        podChampions,
        ...result,
      };
    },
  ),
};
