import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { deleteExpiredMemeMatchRooms } from "@/server/services/meme-match-cleanup-service";
import { errorResponse, ok } from "@/server/http";

export async function POST() {
  try {
    const user = await authService.requireCurrentUser();
    if (!(await permissionService.hasEffectiveAdminAccess(user.roles))) throw new Error("Forbidden");
    return ok({ deletedCount: await deleteExpiredMemeMatchRooms() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to run Meme Match cleanup";
    return errorResponse(message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400, message);
  }
}
