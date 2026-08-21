import { z } from "zod";
import { prisma } from "@/server/db/client";
import { errorResponse, ok } from "@/server/http";
import { requireResourceAccess } from "@/server/services/authorization";
import { crownMonthlyChampions } from "@/server/services/division-title-service";

const recrownSchema = z.object({
  monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  force: z.boolean().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireResourceAccess("nav.competitions.manage", "MANAGE");
    const { id } = await params;
    const payload = recrownSchema.parse(await request.json().catch(() => ({})));

    const result = await crownMonthlyChampions({
      leagueId: id,
      monthKey: payload.monthKey,
      actorId: user.id,
      force: payload.force,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "divisions.month.crowned",
        entityType: "League",
        entityId: id,
        payloadJson: { periodKey: result.periodKey, crowned: result.crowned },
      },
    });

    return ok(result);
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid recrown payload.");
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    if (error instanceof Error && error.message.startsWith("Period")) {
      return errorResponse(409, error.message);
    }
    console.error("POST /api/divisions/leagues/[id]/recrown error:", error);
    return errorResponse(500, "Failed to crown monthly champions.");
  }
}
