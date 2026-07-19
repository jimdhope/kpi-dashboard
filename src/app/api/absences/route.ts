import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { prisma } from "@/server/db/client";
import { getManagedPodIds, requireManagedUser } from "@/server/services/organization-scope-service";
import { requireResourceAccess } from "@/server/services/authorization";

const schema = z.object({ userId: z.string().min(1), startsOn: z.string().datetime(), endsOn: z.string().datetime().optional().nullable(), reason: z.string().trim().max(500).optional().nullable() });

async function requireAbsenceManager() {
  return requireResourceAccess("nav.settings.users", "MANAGE");
}

export async function GET(request: Request) {
  try {
    const manager = await requireAbsenceManager();
    const url = new URL(request.url); const start = url.searchParams.get("start"); const end = url.searchParams.get("end");
    const managedPodIds = await getManagedPodIds(manager, "people");
    const scopedUserIds = managedPodIds === null ? null : (await prisma.podMembership.findMany({ where: { podId: { in: managedPodIds } }, select: { userId: true }, distinct: ["userId"] })).map((membership) => membership.userId);
    const absences = await prisma.absence.findMany({ where: { ...(scopedUserIds ? { userId: { in: scopedUserIds } } : {}), ...(start && end ? { startsOn: { lte: new Date(end) }, OR: [{ endsOn: null }, { endsOn: { gte: new Date(start) } }] } : {}) }, orderBy: { startsOn: "asc" } });
    const users = await prisma.user.findMany({ where: { id: { in: [...new Set(absences.map((a) => a.userId))] } }, select: { id: true, name: true } });
    const names = new Map(users.map((user) => [user.id, user.name]));
    return ok({ absences: absences.map((absence) => ({ ...absence, userName: names.get(absence.userId) || "Unknown" })) });
  } catch { return errorResponse(403, "Forbidden"); }
}

export async function POST(request: Request) {
  try {
    const manager = await requireAbsenceManager(); const input = schema.parse(await request.json()); await requireManagedUser(manager, input.userId); const startsOn = new Date(input.startsOn); const endsOn = input.endsOn ? new Date(input.endsOn) : null;
    if (endsOn && endsOn < startsOn) return errorResponse(400, "End date must be on or after the start date.");
    return ok({ absence: await prisma.absence.create({ data: { ...input, startsOn, endsOn, createdById: manager.id } }) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid absence.");
    if (error instanceof Error && (error.message === "Forbidden" || error.message === "Unauthorized")) return errorResponse(403, "Forbidden");
    console.error("POST /api/absences error:", error);
    return errorResponse(500, "Failed to save absence.");
  }
}
