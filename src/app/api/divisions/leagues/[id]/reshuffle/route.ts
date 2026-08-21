import { z } from "zod";
import { prisma } from "@/server/db/client";
import { errorResponse, ok } from "@/server/http";
import { requireResourceAccess } from "@/server/services/authorization";
import { commitReshuffle, planReshuffle } from "@/server/services/division-reshuffle-service";

const reshuffleSchema = z.object({ commit: z.boolean().optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireResourceAccess("nav.competitions.manage", "MANAGE");
    const { id } = await params;
    const payload = reshuffleSchema.parse(await request.json().catch(() => ({})));

    if (!payload.commit) {
      return ok(await planReshuffle(id));
    }

    const { plan, alreadyApplied } = await commitReshuffle({ leagueId: id, actorId: user.id });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: alreadyApplied ? "divisions.reshuffle.replayed" : "divisions.reshuffle.applied",
        entityType: "League",
        entityId: id,
        payloadJson: {
          promotions: plan.promotions.map((move) => ({ userId: move.userId, to: move.toDivision })),
          relegations: plan.relegations.map((move) => ({ userId: move.userId, to: move.toDivision })),
        },
      },
    });
    return ok({ plan, alreadyApplied });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid reshuffle payload.");
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    console.error("POST /api/divisions/leagues/[id]/reshuffle error:", error);
    return errorResponse(500, "Failed to run reshuffle.");
  }
}
