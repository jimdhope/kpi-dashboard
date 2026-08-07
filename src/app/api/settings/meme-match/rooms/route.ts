import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { memeMatchService } from "@/server/services/meme-match-service";
import { errorResponse, ok } from "@/server/http";

async function requireAdmin() {
  const user = await authService.requireCurrentUser();
  if (!(await permissionService.hasEffectiveAdminAccess(user.roles))) throw new Error("Forbidden");
  return user;
}

export async function GET() {
  try {
    await requireAdmin();
    const [rooms, cleanup] = await Promise.all([memeMatchService.getAdminRooms(), memeMatchService.getCleanupHistory()]);
    return ok({ rooms, cleanup });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Meme Match rooms";
    return errorResponse(message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400, message);
  }
}
