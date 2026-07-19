import { z } from "zod";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { prisma } from "@/server/db/client";
import { errorResponse, ok } from "@/server/http";

const schema = z.object({ enabled: z.boolean() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authService.requireCurrentUser();
    if (!(await permissionService.hasNavAccess(user.roles, "competitions", "MANAGE"))) return errorResponse(403, "Forbidden");
    const { id } = await context.params;
    const { enabled } = schema.parse(await request.json());
    const competition = await prisma.competition.update({
      where: { id },
      data: { autoTeamsUpdates: enabled, ...(enabled ? { lastAutoTeamsScoreAt: new Date() } : {}) },
      select: { id: true, autoTeamsUpdates: true, lastAutoTeamsSentAt: true },
    });
    return ok({ competition });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid automatic Teams setting.");
    return errorResponse(404, "Competition not found.");
  }
}
