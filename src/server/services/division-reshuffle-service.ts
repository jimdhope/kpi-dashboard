import "server-only";

import type { League } from "@prisma/client";

import { divisionRepository } from "@/server/repositories/division-repository";
import {
  activeTiers,
  type LeagueSeasonConfig,
  type LeagueTier,
} from "@/server/services/division-config";
import { blockWindowFromConfig, type PeriodWindow } from "@/server/services/division-periods";
import { requireLeague } from "@/server/services/division-league-service";
import {
  computeBlockTables,
  type StandingRow,
} from "@/server/services/division-standings-service";

export type ReshuffleMove = {
  userId: string;
  userName: string | null;
  fromDivision: LeagueTier;
  toDivision: LeagueTier;
  points: number;
};

export type ReshufflePlan = {
  leagueId: string;
  cupName: string;
  window: PeriodWindow;
  blockWinners: Array<{ division: LeagueTier; userId: string; userName: string | null; points: number }>;
  promotions: ReshuffleMove[];
  relegations: ReshuffleMove[];
  protectedStays: Array<{ userId: string; userName: string | null; division: LeagueTier; played: number; relevantCompetitions: number }>;
};

function isProtected(row: StandingRow, config: LeagueSeasonConfig): boolean {
  if (row.relevantCompetitions === 0) return true;
  return row.played < config.absenceProtectionThreshold * row.relevantCompetitions;
}

async function buildPlan(league: League, config: LeagueSeasonConfig): Promise<ReshufflePlan> {
  const tiers = activeTiers(league.tierCount);
  const tables = await computeBlockTables(league, config);
  const window = blockWindowFromConfig(config);

  const blockWinners = tables
    .map((table) => table.rows[0])
    .filter((row): row is StandingRow => Boolean(row))
    .map((row) => ({
      division: row.division,
      userId: row.userId,
      userName: row.userName,
      points: row.points,
    }));

  const promotions: ReshuffleMove[] = [];
  const relegations: ReshuffleMove[] = [];
  const protectedStays: ReshufflePlan["protectedStays"] = [];

  for (let upperIndex = 0; upperIndex < tiers.length - 1; upperIndex += 1) {
    const upperTier = tiers[upperIndex] ?? "PREMIER";
    const lowerTier = tiers[upperIndex + 1] ?? "LEAGUE_ONE";
    const upperTable = tables.find((table) => table.division === upperTier);
    const lowerTable = tables.find((table) => table.division === lowerTier);
    if (!upperTable || !lowerTable) continue;

    const candidates = upperTable.rows.slice(-config.relegationSlots);
    const movers = candidates.filter((row) => !isProtected(row, config));

    for (const row of candidates) {
      if (isProtected(row, config)) {
        protectedStays.push({
          userId: row.userId,
          userName: row.userName,
          division: upperTier,
          played: row.played,
          relevantCompetitions: row.relevantCompetitions,
        });
      }
    }

    const promoted = lowerTable.rows.slice(0, movers.length);
    for (const row of movers) {
      relegations.push({
        userId: row.userId,
        userName: row.userName,
        fromDivision: upperTier,
        toDivision: lowerTier,
        points: row.points,
      });
    }
    for (const row of promoted) {
      promotions.push({
        userId: row.userId,
        userName: row.userName,
        fromDivision: lowerTier,
        toDivision: upperTier,
        points: row.points,
      });
    }
  }

  return {
    leagueId: league.id,
    cupName: config.cupName,
    window,
    blockWinners,
    promotions,
    relegations,
    protectedStays,
  };
}

export async function planReshuffle(leagueId: string): Promise<ReshufflePlan> {
  const { league, config } = await requireLeague(leagueId);
  return buildPlan(league, config);
}

export async function commitReshuffle(options: {
  leagueId: string;
  actorId?: string | null;
}): Promise<{ plan: ReshufflePlan; alreadyApplied: boolean }> {
  const { league, config } = await requireLeague(options.leagueId);
  const plan = await buildPlan(league, config);

  const existingTitles = await divisionRepository.findTitles({
    leagueId: league.id,
    periodType: "BLOCK",
    take: 100,
  });
  const alreadyApplied = existingTitles.some(
    (title) => title.periodStart.getTime() === plan.window.start.getTime(),
  );

  if (!alreadyApplied) {
    for (const winner of plan.blockWinners) {
      await divisionRepository.upsertTitle({
        leagueId: league.id,
        division: winner.division,
        periodType: "BLOCK",
        periodStart: plan.window.start,
        periodEnd: plan.window.endExclusive,
        userId: winner.userId,
        userName: winner.userName,
        points: winner.points,
        decidedById: options.actorId ?? null,
        note: `${config.cupName} block champion`,
      });
    }

    const movers = [...plan.promotions, ...plan.relegations];
    if (movers.length > 0) {
      await divisionRepository.applyAssignmentChanges({
        leagueId: league.id,
        closeUserIds: movers.map((move) => move.userId),
        closeBefore: plan.window.endExclusive,
        rows: movers.map((move) => ({
          leagueId: league.id,
          userId: move.userId,
          division: move.toDivision,
          effectiveFrom: plan.window.endExclusive,
          assignedVia: "reshuffle",
          assignedById: options.actorId ?? null,
        })),
      });
    }
  }

  return { plan, alreadyApplied };
}
