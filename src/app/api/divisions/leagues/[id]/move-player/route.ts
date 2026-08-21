import { z } from "zod";
import { prisma } from "@/server/db/client";
import { errorResponse, ok } from "@/server/http";
import { requireResourceAccess } from "@/server/services/authorization";
import { divisionRepository } from "@/server/repositories/division-repository";
import { activeTiers } from "@/server/services/division-config";
import { requireLeague } from "@/server/services/division-league-service";

const moveSchema = z.object({
  userId: z.string().min(1),
  division: z.enum(["PREMIER", "CHAMPIONSHIP", "LEAGUE_ONE"]),
  effectiveFrom: z.string().datetime().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireResourceAccess("nav.competitions.manage", "MANAGE");
    const { id } = await params;
    const payload = moveSchema.parse(await request.json());

    const { league } = await requireLeague(id);
    if (!activeTiers(league.tierCount).includes(payload.division)) {
      return errorResponse(400, "Division is not active in this league.");
    }

    const effectiveFrom = payload.effectiveFrom ? new Date(payload.effectiveFrom) : new Date();
    const result = await divisionRepository.movePlayerWithinLeague({
      leagueId: id,
      userId: payload.userId,
      division: payload.division,
      effectiveFrom,
      assignedVia: "manual",
      assignedById: user.id,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "divisions.player.moved",
        entityType: "League",
        entityId: id,
        payloadJson: {
          targetUserId: payload.userId,
          division: payload.division,
          effectiveFrom: effectiveFrom.toISOString(),
        },
      },
    });

    return ok(result.assignment);
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid move payload.");
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error && error.message === "League not found") {
      return errorResponse(404, "League not found.");
    }
    console.error("POST /api/divisions/leagues/[id]/move-player error:", error);
    return errorResponse(500, "Failed to move player.");
  }
}
