import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { quizShowService } from "@/server/services/quiz-show-service";
import { questionSchema } from "@/server/services/quiz-show-schemas";
import { errorResponse, ok } from "@/server/http";

async function requireManage() {
  const user = await authService.requireCurrentUser();
  if (!(await permissionService.hasResourceAccess(user.roles, "nav.miniGames.quizManage", "MANAGE"))) throw new Error("Forbidden");
  return user;
}
function failure(error: unknown, fallback: string) { const message = error instanceof Error ? error.message : fallback; return errorResponse(message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400, message); }

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireManage(); const { id } = await context.params; return ok({ question: await quizShowService.updateQuestion(user.id, id, questionSchema.parse(await request.json())) }); } catch (error) { return failure(error, "Unable to update question."); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireManage(); const { id } = await context.params; await quizShowService.deleteQuestion(user.id, id); return ok({ success: true }); } catch (error) { return failure(error, "Unable to delete question."); }
}
