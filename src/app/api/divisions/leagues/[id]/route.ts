import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { errorResponse, ok } from "@/server/http";
import { requireResourceAccess } from "@/server/services/authorization";
import { divisionRepository } from "@/server/repositories/division-repository";

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  tierCount: z.number().int().min(2).max(3).optional(),
  isActive: z.boolean().optional(),
  configJson: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireResourceAccess("nav.competitions.manage", "MANAGE");
    const { id } = await params;
    const payload = updateSchema.parse(await request.json());

    const league = await divisionRepository.findLeagueById(id);
    if (!league) return errorResponse(404, "League not found.");

    const payloadJson = typeof payload.configJson === "object" && payload.configJson !== null
      ? (payload.configJson as Record<string, unknown>)
      : undefined;
    const updatePayload: Parameters<typeof divisionRepository.updateLeague>[1] = {
      ...payload,
      configJson: payloadJson === undefined ? undefined : (payloadJson as Prisma.InputJsonValue),
    };
    const updated = await divisionRepository.updateLeague(id, updatePayload);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "divisions.league.updated",
        entityType: "League",
        entityId: id,
        payloadJson: payloadJson === undefined ? undefined : JSON.parse(JSON.stringify(payloadJson)),
      },
    });

    return ok(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid league payload.");
    if (error instanceof Error && error.message === "Forbidden") {
      return errorResponse(403, "Forbidden");
    }
    console.error("PATCH /api/divisions/leagues/[id] error:", error);
    return errorResponse(500, "Failed to update league.");
  }
}
