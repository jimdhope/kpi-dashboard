import { z } from "zod";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { memeMatchService } from "@/server/services/meme-match-service";
import { errorResponse, ok } from "@/server/http";

const createRoomSchema = z.object({}).strict();

export async function POST(request: Request) {
  try {
    const user = await authService.requireCurrentUser();
    if (!(await permissionService.hasNavAccess(user.roles, "miniGames", "VIEW"))) throw new Error("Forbidden");
    const body = await request.json().catch(() => ({}));
    createRoomSchema.parse(body);
    return ok({ room: await memeMatchService.createRoom(user.id) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create room";
    return errorResponse(message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400, message);
  }
}
