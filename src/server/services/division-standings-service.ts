import "server-only";

import type { League } from "@prisma/client";

import { prisma } from "@/server/db/client";
import { divisionRepository } from "@/server/repositories/division-repository";
import { scoreEventRepository } from "@/server/repositories/score-event-repository";
import {
  activeTiers,
  type LeagueSeasonConfig,
  type LeagueTier,
} from "@/server/services/division-config";
import {
  blockWindowFromConfig,
  currentLondonMonthKey,
  lastCompletedMonthPeriod,
  monthPeriodFor,
  type PeriodWindow,
} from "@/server/services/division-periods";
import { getDivisionMembership, resolveLeagueRoster, requireLeague } from "@/server/services/division-league-service";

export type StandingRow = {
  userId: string;
  userName: string | null;
  division: LeagueTier;
  points: number;
  played: number;
  relevantCompetitions: number;
  form: number[];
  monthTitles: number;
  rank: number;
};

export type DivisionTable = {
  division: LeagueTier;
  rows: StandingRow[];
  promotionSlots: number;
  relegationSlots: number;
};

export type LeagueTablesView = {
  league: {
    id: string;
    name: string;
    scopeType: string;
    cupName: string;
    blockStart: string;
    blockEnd: string;
  };
  view: "month" | "block";
  periodKey: string;
  periodLabel: string;
  tiers: DivisionTable[];
};

type CompetitionResultWithCompetition = {
  userId: string;
  totalScore: number;
  wasPresent: boolean;
  competition: {
    id: string;
    startsAt: Date | null;
    endsAt: Date | null;
    podIds: string[];
  };
};

function sortRows(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.monthTitles !== a.monthTitles) return b.monthTitles - a.monthTitles;
    const nameA = a.userName ?? a.userId;
    const nameB = b.userName ?? b.userId;
    if (nameA !== nameB) return nameA.localeCompare(nameB);
    return a.userId.localeCompare(b.userId);
  });
}

async function loadResultsInWindow(
  userIds: string[],
  window: PeriodWindow,
): Promise<CompetitionResultWithCompetition[]> {
  if (userIds.length === 0) return [];
  return prisma.competitionResult.findMany({
    where: {
      userId: { in: userIds },
      competition: {
        isDraft: false,
        startsAt: { lt: window.endExclusive },
        endsAt: { gte: window.start },
      },
    },
    select: {
      userId: true,
      totalScore: true,
      wasPresent: true,
      competition: {
        select: { id: true, startsAt: true, endsAt: true, podIds: true },
      },
    },
  });
}

function isResultRelevant(
  result: CompetitionResultWithCompetition,
  userPodByUser: Map<string, string | null>,
): boolean {
  const podId = userPodByUser.get(result.userId);
  if (!podId) return false;
  return result.competition.podIds.includes(podId);
}

async function buildTables(
  league: League,
  config: LeagueSeasonConfig,
  window: PeriodWindow,
  view: "month" | "block",
  periodKey: string,
  periodLabel: string,
): Promise<LeagueTablesView> {
  const tiers = activeTiers(league.tierCount);
  const [roster, membership] = await Promise.all([
    resolveLeagueRoster(league),
    getDivisionMembership(league, window),
  ]);

  const rosterById = new Map(roster.map((member) => [member.userId, member]));
  const memberIds = Array.from(membership.keys());
  const userPodByUser = new Map(
    roster.map((member) => [member.userId, member.podId] as const),
  );

  const [totals, results, titleCounts] = await Promise.all([
    scoreEventRepository.getActiveTotalsByAgents({
      agentIds: memberIds,
      scoredForDate: { gte: window.start, lt: window.endExclusive },
    }),
    loadResultsInWindow(memberIds, window),
    divisionRepository.countMonthTitlesByUser({
      leagueId: league.id,
      decidedBefore: window.start,
    }),
  ]);

  const pointsByUser = new Map(totals.map((total) => [total.subjectAgentId, total.points]));

  const relevantResults = results.filter((result) => isResultRelevant(result, userPodByUser));

  const playedCount = new Map<string, number>();
  for (const result of relevantResults) {
    if (!result.wasPresent) continue;
    playedCount.set(result.userId, (playedCount.get(result.userId) ?? 0) + 1);
  }

  const competitionsById = new Map<string, { podIds: string[]; endsAt: Date | null }>();
  for (const result of relevantResults) {
    competitionsById.set(result.competition.id, {
      podIds: result.competition.podIds,
      endsAt: result.competition.endsAt,
    });
  }
  const relevantCompetitionCountByUser = new Map<string, number>();
  for (const member of roster) {
    let count = 0;
    for (const competition of competitionsById.values()) {
      if (member.podId && competition.podIds.includes(member.podId)) count += 1;
    }
    relevantCompetitionCountByUser.set(member.userId, count);
  }

  const formByUser = new Map<string, number[]>();
  const membershipDivisionByUser = new Map(
    Array.from(membership.entries()).map(([userId, entry]) => [userId, entry.division] as const),
  );
  const competitionsOrdered = Array.from(competitionsById.entries())
    .sort((a, b) => (b[1].endsAt?.getTime() ?? 0) - (a[1].endsAt?.getTime() ?? 0))
    .slice(0, 5);
  for (const [competitionId] of competitionsOrdered) {
    const participants = relevantResults.filter((result) => result.competition.id === competitionId);
    const byDivision = new Map<LeagueTier, typeof participants>();
    for (const participant of participants) {
      const division = membershipDivisionByUser.get(participant.userId);
      if (!division) continue;
      const bucket = byDivision.get(division) ?? [];
      bucket.push(participant);
      byDivision.set(division, bucket);
    }
    for (const [, bucket] of byDivision) {
      const ordered = [...bucket].sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        const nameA = rosterById.get(a.userId)?.userName ?? a.userId;
        const nameB = rosterById.get(b.userId)?.userName ?? b.userId;
        return nameA.localeCompare(nameB);
      });
      ordered.forEach((participant, index) => {
        const positions = formByUser.get(participant.userId) ?? [];
        positions.push(index + 1);
        formByUser.set(participant.userId, positions);
      });
    }
  }

  const rowsByDivision = new Map<LeagueTier, StandingRow[]>();
  for (const tier of tiers) rowsByDivision.set(tier, []);

  for (const [userId, entry] of membership) {
    const member = rosterById.get(userId);
    if (!member) continue;
    const tierRows = rowsByDivision.get(entry.division);
    if (!tierRows) continue;
    tierRows.push({
      userId,
      userName: member.userName,
      division: entry.division,
      points: pointsByUser.get(userId) ?? 0,
      played: playedCount.get(userId) ?? 0,
      relevantCompetitions: relevantCompetitionCountByUser.get(userId) ?? 0,
      form: (formByUser.get(userId) ?? []).slice().reverse(),
      monthTitles: titleCounts.get(userId) ?? 0,
      rank: 0,
    });
  }

  const tiersOut: DivisionTable[] = tiers.map((tier, index) => {
    const sorted = sortRows(rowsByDivision.get(tier) ?? []).map((row, rowIndex) => ({
      ...row,
      rank: rowIndex + 1,
    }));
    return {
      division: tier,
      rows: sorted,
      promotionSlots: index === 0 ? 0 : config.promotionSlots,
      relegationSlots: index === tiers.length - 1 ? 0 : config.relegationSlots,
    };
  });

  return {
    league: {
      id: league.id,
      name: league.name,
      scopeType: league.scopeType,
      cupName: config.cupName,
      blockStart: config.blockStart,
      blockEnd: config.blockEnd,
    },
    view,
    periodKey,
    periodLabel,
    tiers: tiersOut,
  };
}

export async function getLeagueTables(
  leagueId: string,
  options: { view?: "month" | "block"; monthKey?: string } = {},
): Promise<LeagueTablesView> {
  const { league, config } = await requireLeague(leagueId);
  const view = options.view ?? "month";

  if (view === "block") {
    const window = blockWindowFromConfig(config);
    return buildTables(league, config, window, "block", config.blockStart, `${config.cupName} ${config.blockStart.slice(0, 4)}`);
  }

  const period = options.monthKey
    ? monthPeriodFor(options.monthKey)
    : lastCompletedMonthPeriod(new Date());
  return buildTables(league, config, period.window, "month", period.key, period.label);
}

export async function computeBlockTables(
  league: League,
  config: LeagueSeasonConfig,
): Promise<DivisionTable[]> {
  const window = blockWindowFromConfig(config);
  const view = await buildTables(league, config, window, "block", config.blockStart, config.cupName);
  return view.tiers;
}

export async function getCurrentMonthStandingsRaw(
  league: League,
  config: LeagueSeasonConfig,
): Promise<{ periodKey: string; periodLabel: string; tiers: DivisionTable[] }> {
  const period = monthPeriodFor(currentLondonMonthKey(new Date()));
  const view = await buildTables(league, config, period.window, "month", period.key, period.label);
  return { periodKey: view.periodKey, periodLabel: view.periodLabel, tiers: view.tiers };
}
