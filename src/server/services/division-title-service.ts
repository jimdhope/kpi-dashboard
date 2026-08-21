import "server-only";

import type { League } from "@prisma/client";

import { divisionRepository } from "@/server/repositories/division-repository";
import { scoreEventRepository } from "@/server/repositories/score-event-repository";
import { activeTiers, type LeagueTier } from "@/server/services/division-config";
import {
  isWindowComplete,
  lastCompletedMonthPeriod,
  monthPeriodFor,
  type MonthPeriod,
} from "@/server/services/division-periods";
import { getDivisionMembership, resolveLeagueRoster, requireLeague } from "@/server/services/division-league-service";

export type CrownedTitle = {
  division: LeagueTier;
  userId: string;
  userName: string | null;
  points: number;
  alreadyRecorded: boolean;
};

export type CrowningResult = {
  leagueId: string;
  periodLabel: string;
  periodKey: string;
  crowned: CrownedTitle[];
};

async function crownForWindow(
  league: League,
  period: MonthPeriod,
  options: { force?: boolean; actorId?: string | null },
): Promise<CrowningResult> {
  if (!options.force && !isWindowComplete(period.window, new Date())) {
    throw new Error(`Period ${period.key} is not complete yet`);
  }

  const tiers = activeTiers(league.tierCount);
  const [roster, membership] = await Promise.all([
    resolveLeagueRoster(league),
    getDivisionMembership(league, period.window),
  ]);
  const rosterById = new Map(roster.map((member) => [member.userId, member]));
  const memberIds = Array.from(membership.keys());

  const [totals, priorTitles, existingTitles] = await Promise.all([
    scoreEventRepository.getActiveTotalsByAgents({
      agentIds: memberIds,
      scoredForDate: { gte: period.window.start, lt: period.window.endExclusive },
    }),
    divisionRepository.countMonthTitlesByUser({
      leagueId: league.id,
      decidedBefore: period.window.start,
    }),
    divisionRepository.findTitles({
      leagueId: league.id,
      periodType: "MONTH",
      take: 500,
    }),
  ]);

  const pointsByUser = new Map(totals.map((total) => [total.subjectAgentId, total.points]));
  const existingKeys = new Set(
    existingTitles
      .filter((title) => title.periodStart.getTime() === period.window.start.getTime())
      .map((title) => `${title.division}:${title.userId}`),
  );

  const crowned: CrownedTitle[] = [];
  for (const tier of tiers) {
    const candidates = Array.from(membership.entries())
      .filter(([, entry]) => entry.division === tier)
      .map(([userId]) => {
        const member = rosterById.get(userId);
        return {
          userId,
          userName: member?.userName ?? null,
          points: pointsByUser.get(userId) ?? 0,
          priorTitles: priorTitles.get(userId) ?? 0,
        };
      })
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.priorTitles !== a.priorTitles) return a.priorTitles - b.priorTitles;
        return a.userId.localeCompare(b.userId);
      });

    const winner = candidates[0];
    if (!winner || winner.points <= 0) continue;

    await divisionRepository.upsertTitle({
      leagueId: league.id,
      division: tier,
      periodType: "MONTH",
      periodStart: period.window.start,
      periodEnd: period.window.endExclusive,
      userId: winner.userId,
      userName: winner.userName,
      points: winner.points,
      decidedById: options.actorId ?? null,
    });

    crowned.push({
      division: tier,
      userId: winner.userId,
      userName: winner.userName,
      points: winner.points,
      alreadyRecorded: existingKeys.has(`${tier}:${winner.userId}`),
    });
  }

  return {
    leagueId: league.id,
    periodLabel: period.label,
    periodKey: period.key,
    crowned,
  };
}

export async function crownMonthlyChampions(options: {
  leagueId: string;
  monthKey?: string;
  actorId?: string | null;
  force?: boolean;
}): Promise<CrowningResult> {
  const { league } = await requireLeague(options.leagueId);
  const period = options.monthKey
    ? monthPeriodFor(options.monthKey)
    : lastCompletedMonthPeriod(new Date());
  return crownForWindow(league, period, options);
}

export async function crownMonthlyChampionsForAllLeagues(options: {
  actorId?: string | null;
}): Promise<CrowningResult[]> {
  const leagues = await divisionRepository.listActiveLeagues();
  const results: CrowningResult[] = [];
  for (const league of leagues) {
    try {
      results.push(await crownForWindow(league, lastCompletedMonthPeriod(new Date()), options));
    } catch (error) {
      console.error(`divisions: monthly crowning failed for league ${league.name}`, error);
    }
  }
  return results;
}
