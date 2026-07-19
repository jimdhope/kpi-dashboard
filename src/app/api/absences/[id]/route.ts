import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { prisma } from "@/server/db/client";
import { requireManagedUser } from "@/server/services/organization-scope-service";
import { requireResourceAccess } from "@/server/services/authorization";

const schema = z.object({
  startsOn: z.string().datetime(),
  endsOn: z.string().datetime().optional().nullable(),
  reason: z.string().trim().max(500).optional().nullable(),
});

async function requireAbsenceManager() {
  return requireResourceAccess("nav.settings.users", "MANAGE");
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const manager = await requireAbsenceManager();
    const { id } = await context.params;
    const existing = await prisma.absence.findUnique({ where: { id }, select: { userId: true } });
    if (!existing) return errorResponse(404, "Absence not found.");
    await requireManagedUser(manager, existing.userId);
    const input = schema.parse(await request.json());
    const startsOn = new Date(input.startsOn);
    const endsOn = input.endsOn ? new Date(input.endsOn) : null;
    if (endsOn && endsOn < startsOn) return errorResponse(400, "End date must be on or after the start date.");
    return ok({ absence: await prisma.absence.update({ where: { id }, data: { startsOn, endsOn, reason: input.reason ?? null } }) });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid absence.");
    if (error instanceof Error && error.message === "Forbidden") return errorResponse(403, "Forbidden");
    return errorResponse(404, "Absence not found.");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const manager = await requireAbsenceManager();
    const { id } = await context.params;
    const existing = await prisma.absence.findUnique({ where: { id }, select: { userId: true } });
    if (!existing) return errorResponse(404, "Absence not found.");
    await requireManagedUser(manager, existing.userId);
    await prisma.absence.delete({ where: { id } });
    return ok({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") return errorResponse(403, "Forbidden");
    return errorResponse(404, "Absence not found.");
  }
}
