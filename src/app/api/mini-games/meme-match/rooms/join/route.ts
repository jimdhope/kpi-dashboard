import { z } from "zod";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { memeMatchService } from "@/server/services/meme-match-service";
import { errorResponse, ok } from "@/server/http";

const joinSchema = z.object({
  code: z.string().trim().min(4).max(12),
});

export async function POST(request: Request) {
  try {
    const user = await authService.requireCurrentUser();
    if (!(await permissionService.hasNavAccess(user.roles, "miniGames", "VIEW"))) throw new Error("Forbidden");
    const payload = joinSchema.parse(await request.json());
    return ok({ room: await memeMatchService.joinRoom(user.id, payload.code.toUpperCase()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to join room";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : message.includes("not found") ? 404 : 400;
    return errorResponse(status, message);
  }
}
