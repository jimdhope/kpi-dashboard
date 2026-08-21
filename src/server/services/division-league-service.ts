import "server-only";

import type { League } from "@prisma/client";

import { prisma } from "@/server/db/client";
import { divisionRepository } from "@/server/repositories/division-repository";
import { bottomTier, parseLeagueConfig, type LeagueSeasonConfig, type LeagueTier } from "@/server/services/division-config";
import type { PeriodWindow } from "@/server/services/division-periods";

export type RosterMember = {
  userId: string;
  userName: string | null;
  podId: string | null;
};

export type DivisionMembershipEntry = {
  division: LeagueTier;
  isVirtual: boolean;
};

export type ResolvedLeague = {
  league: League;
  config: LeagueSeasonConfig;
};

export async function resolveLeagueConfig(league: League): Promise<LeagueSeasonConfig> {
  return parseLeagueConfig(league.configJson);
}

export async function requireLeague(leagueId: string): Promise<ResolvedLeague> {
  const league = await divisionRepository.findLeagueById(leagueId);
  if (!league) throw new Error("League not found");
  return { league, config: await resolveLeagueConfig(league) };
}

export async function resolveLeagueRoster(league: League): Promise<RosterMember[]> {
  if (league.scopeType === "POD") {
    if (!league.podId) return [];
    const users = await prisma.user.findMany({
      where: { podId: league.podId },
      select: { id: true, name: true, podId: true },
      orderBy: [{ name: "asc" }],
    });
    return users.map((user) => ({ userId: user.id, userName: user.name, podId: user.podId }));
  }

  if (!league.campaignId) return [];
  const pods = await prisma.pod.findMany({
    where: { campaignId: league.campaignId },
    select: { id: true },
  });
  if (pods.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { podId: { in: pods.map((pod) => pod.id) } },
    select: { id: true, name: true, podId: true },
    orderBy: [{ name: "asc" }],
  });
  return users.map((user) => ({ userId: user.id, userName: user.name, podId: user.podId }));
}

export async function listLeaguesForUser(
  userId: string,
): Promise<League[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { podId: true, pod: { select: { campaignId: true } } },
  });
  if (!user) return [];

  const scopeConditions: Array<
    { scopeType: "POD"; podId: string } | { scopeType: "CAMPAIGN"; campaignId: string }
  > = [];
  if (user.podId) scopeConditions.push({ scopeType: "POD", podId: user.podId });
  if (user.pod?.campaignId) {
    scopeConditions.push({ scopeType: "CAMPAIGN", campaignId: user.pod.campaignId });
  }
  if (scopeConditions.length === 0) return [];

  return prisma.league.findMany({
    where: { isActive: true, OR: scopeConditions },
    orderBy: [{ scopeType: "asc" }, { name: "asc" }],
  });
}

export async function getDivisionMembership(
  league: League,
  window?: PeriodWindow,
): Promise<Map<string, DivisionMembershipEntry>> {
  const [roster, assignments] = await Promise.all([
    resolveLeagueRoster(league),
    window
      ? divisionRepository.getAssignmentsOverlapping(league.id, window)
      : divisionRepository.getCurrentAssignments(league.id),
  ]);

  const fallbackTier = bottomTier(league.tierCount);
  const membership = new Map<string, DivisionMembershipEntry>();
  const latestAssignmentByUser = new Map<string, string>();

  for (const assignment of assignments) {
    const previous = latestAssignmentByUser.get(assignment.userId);
    if (
      previous !== undefined &&
      previous.localeCompare(assignment.id) >= 0
    ) {
      continue;
    }
    latestAssignmentByUser.set(assignment.userId, assignment.id);
    membership.set(assignment.userId, {
      division: assignment.division as LeagueTier,
      isVirtual: false,
    });
  }

  for (const member of roster) {
    if (!membership.has(member.userId)) {
      membership.set(member.userId, { division: fallbackTier, isVirtual: true });
    }
  }

  const rosterIds = new Set(roster.map((member) => member.userId));
  for (const userId of membership.keys()) {
    if (!rosterIds.has(userId)) membership.delete(userId);
  }

  return membership;
}
