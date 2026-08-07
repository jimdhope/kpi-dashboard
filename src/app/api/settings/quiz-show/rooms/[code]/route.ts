import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { quizShowService } from "@/server/services/quiz-show-service";
import { errorResponse, ok } from "@/server/http";

export async function DELETE(_request: Request, context: { params: Promise<{ code: string }> }) {
  try { const user = await authService.requireCurrentUser(); if (!(await permissionService.hasResourceAccess(user.roles, "nav.miniGames.quizManage", "MANAGE"))) throw new Error("Forbidden"); const { code } = await context.params; await quizShowService.deleteRoom(user.id, code.toUpperCase()); return ok({ success: true }); }
  catch (error) { const message = error instanceof Error ? error.message : "Unable to delete Quiz Show room."; return errorResponse(message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : message === "Room not found." ? 404 : 400, message); }
}
