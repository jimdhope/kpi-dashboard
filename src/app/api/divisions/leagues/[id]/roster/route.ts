import { errorResponse, ok } from "@/server/http";
import { requireResourceAccess } from "@/server/services/authorization";
import { requireLeague, getDivisionMembership, resolveLeagueRoster } from "@/server/services/division-league-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireResourceAccess("nav.competitions.manage", "MANAGE");
    const { id } = await params;
    const { league } = await requireLeague(id);
    const [roster, membership] = await Promise.all([
      resolveLeagueRoster(league),
      getDivisionMembership(league),
    ]);
    const nameById = new Map(roster.map((member) => [member.userId, member.userName]));
    return ok({
      members: Array.from(membership.entries())
        .map(([userId, entry]) => ({
          userId,
          userName: nameById.get(userId) ?? null,
          division: entry.division,
          isVirtual: entry.isVirtual,
        }))
        .sort((a, b) => (a.userName ?? "").localeCompare(b.userName ?? "")),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error && error.message === "League not found") {
      return errorResponse(404, "League not found.");
    }
    console.error("GET /api/divisions/leagues/[id]/roster error:", error);
    return errorResponse(500, "Failed to load league roster.");
  }
}
