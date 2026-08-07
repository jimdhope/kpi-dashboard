import { z } from "zod";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { memeMatchService } from "@/server/services/meme-match-service";
import { errorResponse, ok } from "@/server/http";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("force-advance") }),
  z.object({ action: z.literal("reopen"), phase: z.enum(["submitting", "voting", "reveal"]) }),
  z.object({ action: z.literal("remove-submission"), submissionId: z.string().trim().min(1) }),
  z.object({ action: z.literal("remove-vote"), voteId: z.string().trim().min(1) }),
]);

async function requireAdmin() {
  const user = await authService.requireCurrentUser();
  if (!(await permissionService.hasEffectiveAdminAccess(user.roles))) throw new Error("Forbidden");
  return user;
}

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    await requireAdmin();
    const { code } = await context.params;
    const room = await memeMatchService.getAdminRoom(code.toUpperCase());
    if (!room) return errorResponse(404, "Room not found.");
    return ok({ room });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Meme Match room";
    return errorResponse(message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400, message);
  }
}

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const user = await requireAdmin();
    const { code } = await context.params;
    const input = actionSchema.parse(await request.json());
    const room = await memeMatchService.moderateRoom(user.id, code.toUpperCase(), input);
    return ok({ room });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to moderate Meme Match room";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : message === "Room not found." ? 404 : 400;
    return errorResponse(status, message);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const user = await requireAdmin();
    const { code } = await context.params;
    await memeMatchService.deleteRoom(user.id, code.toUpperCase());
    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete Meme Match room";
    return errorResponse(message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : message === "Room not found." ? 404 : 400, message);
  }
}
