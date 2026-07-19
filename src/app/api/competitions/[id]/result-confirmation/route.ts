import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { prisma } from "@/server/db/client";
import { notificationService } from "@/server/services/notification-service";

const schema = z.object({ note: z.string().trim().max(1_000).optional().nullable() });

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await authService.requireCurrentUser();
    const { id } = await context.params;
    return ok({ confirmation: await prisma.competitionResultConfirmation.findUnique({ where: { competitionId: id } }) });
  } catch { return errorResponse(401, "Unauthorized"); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authService.requireCurrentUser();
    if (!(await permissionService.hasNavAccess(user.roles, "competitions", "MANAGE"))) return errorResponse(403, "Forbidden");
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const competition = await prisma.competition.findUnique({ where: { id }, select: { id: true, name: true, endsAt: true } });
    if (!competition) return errorResponse(404, "Competition not found.");
    if (competition.endsAt && competition.endsAt > new Date()) return errorResponse(400, "A competition can only be confirmed after it ends.");
    const confirmation = await prisma.competitionResultConfirmation.upsert({ where: { competitionId: id }, create: { competitionId: id, confirmedById: user.id, note: input.note ?? null }, update: { confirmedById: user.id, note: input.note ?? null, confirmedAt: new Date() } });
    const recipients = await prisma.competitionResult.findMany({ where: { competitionId: id }, select: { userId: true } });
    await Promise.all(recipients.map((result) => notificationService.create({ recipientId: result.userId, type: "RESULT_CONFIRMED", title: "Competition result confirmed", message: `${competition.name} results have been officially confirmed.`, href: "/agent/competitions" })));
    return ok({ confirmation });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid confirmation note.");
    return errorResponse(500, "Failed to confirm result.");
  }
}
