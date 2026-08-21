import "server-only";

import { prisma } from "@/server/db/client";
import { divisionRepository } from "@/server/repositories/division-repository";
import { scoreEventRepository } from "@/server/repositories/score-event-repository";
import {
  activeTiers,
  tierSizesFor,
  type LeagueTier,
} from "@/server/services/division-config";
import { startOfLondonDay } from "@/server/services/division-periods";
import { requireLeague, resolveLeagueRoster } from "@/server/services/division-league-service";

export type SeedPreviewPlayer = {
  userId: string;
  userName: string | null;
  averagePoints: number | null;
  competitionsPlayed: number;
};

export type SeedPreview = {
  leagueId: string;
  cupName: string;
  lookbackCompetitions: number;
  tiers: Array<{ division: LeagueTier; players: SeedPreviewPlayer[] }>;
};

type TrailingFormEntry = {
  userId: string;
  userName: string | null;
  totalPoints: number;
  competitionsPlayed: number;
};

async function loadLookbackCompetitions(
  league: { scopeType: string; podId: string | null; campaignId: string | null },
  beforeExclusive: Date,
  limit: number,
): Promise<Array<{ id: string; startsAt: Date | null; endsAt: Date | null }>> {
  let relevantPodIds: string[] | null = null;
  if (league.scopeType === "POD") {
    relevantPodIds = league.podId ? [league.podId] : [];
  } else if (league.campaignId) {
    const pods = await prisma.pod.findMany({
      where: { campaignId: league.campaignId },
      select: { id: true },
    });
    relevantPodIds = pods.map((pod) => pod.id);
  }
  if (relevantPodIds !== null && relevantPodIds.length === 0) return [];

  const competitions = await prisma.competition.findMany({
    where: {
      isDraft: false,
      endsAt: { lt: beforeExclusive },
      ...(relevantPodIds ? { podIds: { hasSome: relevantPodIds } } : {}),
    },
    select: { id: true, startsAt: true, endsAt: true },
    orderBy: [{ endsAt: "desc" }],
    take: limit,
  });
  return competitions.sort((a, b) => (a.endsAt?.getTime() ?? 0) - (b.endsAt?.getTime() ?? 0));
}

async function loadTrailingForm(
  league: Parameters<typeof loadLookbackCompetitions>[0],
  config: { blockStart: string; seedingLookbackCompetitions: number },
  rosterUserIds: string[],
): Promise<Map<string, TrailingFormEntry>> {
  const formByUser = new Map<string, TrailingFormEntry>();
  for (const userId of rosterUserIds) {
    formByUser.set(userId, { userId, userName: null, totalPoints: 0, competitionsPlayed: 0 });
  }
  if (rosterUserIds.length === 0) return formByUser;

  const blockStartInstant = startOfLondonDay(config.blockStart);
  const competitions = await loadLookbackCompetitions(
    league,
    blockStartInstant,
    config.seedingLookbackCompetitions,
  );
  if (competitions.length === 0) return formByUser;

  const results = await prisma.competitionResult.findMany({
    where: { userId: { in: rosterUserIds }, competitionId: { in: competitions.map((c) => c.id) } },
    select: { userId: true, totalScore: true, competitionId: true },
  });

  const names = await prisma.user.findMany({
    where: { id: { in: rosterUserIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(names.map((user) => [user.id, user.name]));

  const pointsByUserCompetition = new Map<string, number>();
  for (const result of results) {
    pointsByUserCompetition.set(`${result.userId}:${result.competitionId}`, result.totalScore);
  }

  const eventTotals = await scoreEventRepository.getActiveTotalsAcrossCompetitions({
    competitionIds: competitions.map((entry) => entry.id),
  });
  const rosterIdSet = new Set(rosterUserIds);
  for (const total of eventTotals) {
    if (!rosterIdSet.has(total.subjectAgentId)) continue;
    const key = `${total.subjectAgentId}:${total.competitionId}`;
    if (pointsByUserCompetition.has(key)) continue;
    pointsByUserCompetition.set(key, total.points);
  }

  for (const [key, points] of pointsByUserCompetition) {
    const userId = key.split(":")[0] ?? "";
    const entry = formByUser.get(userId);
    if (!entry) continue;
    entry.totalPoints += points;
    entry.competitionsPlayed += 1;
    entry.userName = nameById.get(userId) ?? null;
  }
  for (const userId of rosterUserIds) {
    const entry = formByUser.get(userId);
    if (!entry) continue;
    entry.userName = nameById.get(userId) ?? null;
  }

  return formByUser;
}

export async function previewSeasonSeed(leagueId: string): Promise<SeedPreview> {
  const { league, config } = await requireLeague(leagueId);
  const roster = await resolveLeagueRoster(league);
  if (roster.length === 0) throw new Error("League roster is empty");

  const form = await loadTrailingForm(league, config, roster.map((member) => member.userId));

  const ranked = [...form.values()].sort((a, b) => {
    const avgA = a.competitionsPlayed > 0 ? a.totalPoints / a.competitionsPlayed : Number.NEGATIVE_INFINITY;
    const avgB = b.competitionsPlayed > 0 ? b.totalPoints / b.competitionsPlayed : Number.NEGATIVE_INFINITY;
    if (avgA !== avgB) return avgB - avgA;
    const nameA = a.userName ?? a.userId;
    const nameB = b.userName ?? b.userId;
    if (nameA !== nameB) return nameA.localeCompare(nameB);
    return a.userId.localeCompare(b.userId);
  });

  const sizes = tierSizesFor(roster.length, league.tierCount);
  const tiers = activeTiers(league.tierCount);

  const previewTiers: SeedPreview["tiers"] = [];
  let cursor = 0;
  tiers.forEach((division, index) => {
    const size = sizes[index] ?? 0;
    const players = ranked.slice(cursor, cursor + size).map((entry) => ({
      userId: entry.userId,
      userName: entry.userName,
      averagePoints:
        entry.competitionsPlayed > 0
          ? Math.round((entry.totalPoints / entry.competitionsPlayed) * 10) / 10
          : null,
      competitionsPlayed: entry.competitionsPlayed,
    }));
    cursor += size;
    previewTiers.push({ division, players });
  });

  return {
    leagueId: league.id,
    cupName: config.cupName,
    lookbackCompetitions: config.seedingLookbackCompetitions,
    tiers: previewTiers,
  };
}

export async function commitSeasonSeed(leagueId: string, actorId: string): Promise<SeedPreview> {
  const preview = await previewSeasonSeed(leagueId);
  const { league, config } = await requireLeague(leagueId);
  const effectiveFrom = startOfLondonDay(config.blockStart);

  const rows = preview.tiers.flatMap((tier) =>
    tier.players.map((player) => ({
      leagueId: league.id,
      userId: player.userId,
      division: tier.division,
      effectiveFrom,
      assignedVia: "seed",
      assignedById: actorId,
    })),
  );

  const currentAssignments = await divisionRepository.getCurrentAssignments(league.id);
  await divisionRepository.applyAssignmentChanges({
    leagueId: league.id,
    closeUserIds: currentAssignments.map((assignment) => assignment.userId),
    closeBefore: effectiveFrom,
    rows,
  });

  return preview;
}
