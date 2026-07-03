import { NextRequest } from "next/server";
import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";
import { evaluateCriteria } from "@/server/services/rule-evaluator";
import type { RuleContext } from "@/server/services/rule-evaluator";

function extractKpiRuleName(criteria: unknown): string | null {
  if (!criteria || typeof criteria !== "object") return null;
  const c = criteria as Record<string, unknown>;
  if (c.ruleType === "kpiTopN" && typeof c.kpiRuleName === "string") return c.kpiRuleName;
  if (c.op === "and" || c.op === "or") {
    const rules = c.rules as unknown[];
    for (const rule of rules) {
      const name = extractKpiRuleName(rule);
      if (name) return name;
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    await authService.requireAdmin();
    const { searchParams } = new URL(request.url);
    const competitionId = searchParams.get("competitionId");
    if (!competitionId) return errorResponse(400, "Missing competitionId query parameter");

    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      select: { id: true, name: true, startsAt: true, endsAt: true },
    });
    if (!competition) return errorResponse(404, "Competition not found");

    // 1. Competition results
    const results = await prisma.competitionResult.findMany({
      where: { competitionId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { rank: "asc" },
    });
    const totalParticipants = results.length;

    // 2. Per-KPI rankings + raw values from DailyAchievement for this competition's date range
    const start = competition.startsAt ?? new Date(0);
    const end = competition.endsAt ?? new Date();
    const dailyByRule = await prisma.dailyAchievement.groupBy({
      by: ["ruleName", "agentId"],
      where: { competitionId, date: { gte: start, lte: end }, ruleName: { not: null } },
      _sum: { points: true, value: true },
    });

    const ruleGroups = new Map<string, Map<string, number>>();
    const kpiValues = new Map<string, Map<string, number>>();
    for (const d of dailyByRule) {
      if (!d.ruleName) continue;
      let agents = ruleGroups.get(d.ruleName);
      if (!agents) { agents = new Map(); ruleGroups.set(d.ruleName, agents); }
      agents.set(d.agentId, d._sum.points ?? 0);
      let valAgents = kpiValues.get(d.ruleName);
      if (!valAgents) { valAgents = new Map(); kpiValues.set(d.ruleName, valAgents); }
      valAgents.set(d.agentId, d._sum.value ?? 0);
    }
    const kpiRankings = new Map<string, Map<string, number>>();
    for (const [ruleName, agentPoints] of ruleGroups) {
      const sorted = Array.from(agentPoints.entries()).sort(([, a], [, b]) => b - a);
      const ranks = new Map<string, number>();
      sorted.forEach(([agentId], idx) => ranks.set(agentId, idx + 1));
      kpiRankings.set(ruleName, ranks);
    }

    // 3. COMPETITION-scoped badges + pre-compute KPI rule names
    const badges = await prisma.badge.findMany({
      where: { isActive: true, scope: "COMPETITION" },
      select: { id: true, key: true, name: true, description: true, icon: true, scope: true, rankTinted: true, criteria: true },
    });
    const badgeKpiRules = new Map<string, string | null>();
    for (const b of badges) {
      badgeKpiRules.set(b.id, extractKpiRuleName(b.criteria));
    }

    // 4. Evaluate each user against each badge
    const entries: any[] = [];
    for (const r of results) {
      const userKpiRanks: Record<string, number> = {};
      for (const [ruleName, ranks] of kpiRankings) {
        const rank = ranks.get(r.userId);
        if (rank !== undefined) userKpiRanks[ruleName] = rank;
      }

      const ctx: RuleContext = {
        rank: r.rank,
        totalScore: r.totalScore,
        improvement: 0,
        wasPresent: r.wasPresent,
        streak: 0,
        totalCompetitions: 1,
        totalParticipants,
        percentile: totalParticipants > 0 ? (r.rank / totalParticipants) * 100 : undefined,
        kpiRanks: userKpiRanks,
      };

      for (const badge of badges) {
        if (!evaluateCriteria(badge.criteria, ctx)) continue;

        const kpiRule = badgeKpiRules.get(badge.id);
        let kpiDetail = null;
        if (kpiRule && kpiRankings.has(kpiRule)) {
          const ranks = kpiRankings.get(kpiRule)!;
          const kpiRank = ranks.get(r.userId) ?? null;
          if (kpiRank !== null) {
            kpiDetail = {
              ruleName: kpiRule,
              value: kpiValues.get(kpiRule)?.get(r.userId) ?? 0,
              rank: kpiRank,
              totalParticipants: ranks.size,
            };
          }
        }

        entries.push({
          id: `${badge.key}-${r.userId}-${competitionId}`,
          badgeKey: badge.key,
          badgeName: badge.name,
          badgeDescription: badge.description,
          badgeIcon: badge.icon,
          badgeScope: badge.scope,
          badgeRankTinted: badge.rankTinted,
          agentName: r.user.name ?? r.user.email ?? "Unknown",
          agentId: r.userId,
          competitionName: competition.name,
          earnedAt: r.createdAt.toISOString(),
          rank: r.rank,
          totalScore: r.totalScore,
          kpiDetail,
          context: { competitionId, rank: r.rank },
        });
      }
    }

    return ok({ entries, competitionId });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }
    return errorResponse(500, "Failed to fetch earned badges.");
  }
}
