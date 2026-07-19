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
    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    const lastDay = new Date(year, month, 0);

    // 1. Monthly leaderboard (CompetitionResult-based)
    const results = await prisma.competitionResult.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: { user: { select: { name: true, email: true } } },
    });

    const pointsByUser = new Map<string, { name: string; points: number }>();
    for (const r of results) {
      const existing = pointsByUser.get(r.userId) ?? {
        name: r.user.name ?? r.user.email ?? "Unknown",
        points: 0,
      };
      existing.points += r.totalScore;
      pointsByUser.set(r.userId, existing);
    }
    const leaderboard = Array.from(pointsByUser.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.points - a.points)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
    const totalParticipants = leaderboard.length;

    // 2. Per-KPI rankings + raw values from the auditable score ledger.
    const dailyByRule = await prisma.scoreEvent.groupBy({
      by: ["ruleName", "subjectAgentId"],
      where: { scoredForDate: { gte: start, lte: end }, ruleName: { not: null }, voidedAt: null },
      _sum: { points: true, quantity: true },
    });

    const ruleGroups = new Map<string, Map<string, number>>();
    const kpiValues = new Map<string, Map<string, number>>();
    for (const d of dailyByRule) {
      if (!d.ruleName) continue;
      let agents = ruleGroups.get(d.ruleName);
      if (!agents) { agents = new Map(); ruleGroups.set(d.ruleName, agents); }
      agents.set(d.subjectAgentId, d._sum.points ?? 0);
      let valAgents = kpiValues.get(d.ruleName);
      if (!valAgents) { valAgents = new Map(); kpiValues.set(d.ruleName, valAgents); }
      valAgents.set(d.subjectAgentId, d._sum.quantity ?? 0);
    }
    const kpiRankings = new Map<string, Map<string, number>>();
    for (const [ruleName, agentPoints] of ruleGroups) {
      const sorted = Array.from(agentPoints.entries()).sort(([, a], [, b]) => b - a);
      const ranks = new Map<string, number>();
      sorted.forEach(([agentId], idx) => ranks.set(agentId, idx + 1));
      kpiRankings.set(ruleName, ranks);
    }

    // 3. MONTHLY-scoped badges + pre-compute KPI rule names
    const badges = await prisma.badge.findMany({
      where: { isActive: true, scope: "MONTHLY" },
      select: { id: true, key: true, name: true, description: true, icon: true, scope: true, rankTinted: true, criteria: true },
    });
    const badgeKpiRules = new Map<string, string | null>();
    for (const b of badges) {
      badgeKpiRules.set(b.id, extractKpiRuleName(b.criteria));
    }

    // 4. Evaluate each user against each badge
    const entries: any[] = [];
    for (const entry of leaderboard) {
      const userKpiRanks: Record<string, number> = {};
      for (const [ruleName, ranks] of kpiRankings) {
        const r = ranks.get(entry.userId);
        if (r !== undefined) userKpiRanks[ruleName] = r;
      }

      const ctx: RuleContext = {
        rank: entry.rank,
        totalScore: entry.points,
        improvement: 0,
        wasPresent: true,
        streak: 0,
        totalCompetitions: 1,
        totalParticipants,
        percentile: totalParticipants > 0 ? (entry.rank / totalParticipants) * 100 : undefined,
        kpiRanks: userKpiRanks,
      };

      for (const badge of badges) {
        if (!evaluateCriteria(badge.criteria, ctx)) continue;

        const kpiRule = badgeKpiRules.get(badge.id);
        let kpiDetail = null;
        if (kpiRule && kpiRankings.has(kpiRule)) {
          const ranks = kpiRankings.get(kpiRule)!;
          const kpiRank = ranks.get(entry.userId) ?? null;
          if (kpiRank !== null) {
            kpiDetail = {
              ruleName: kpiRule,
              value: kpiValues.get(kpiRule)?.get(entry.userId) ?? 0,
              rank: kpiRank,
              totalParticipants: ranks.size,
            };
          }
        }

        entries.push({
          id: `${badge.key}-${entry.userId}-${month}-${year}`,
          badgeKey: badge.key,
          badgeName: badge.name,
          badgeDescription: badge.description,
          badgeIcon: badge.icon,
          badgeScope: badge.scope,
          badgeRankTinted: badge.rankTinted,
          agentName: entry.name,
          agentId: entry.userId,
          competitionName: null,
          earnedAt: lastDay.toISOString(),
          rank: entry.rank,
          totalScore: entry.points,
          kpiDetail,
          context: { month, year, rank: entry.rank },
        });
      }
    }

    return ok({ entries, month, year });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }
    return errorResponse(500, "Failed to fetch earned badges.");
  }
}
