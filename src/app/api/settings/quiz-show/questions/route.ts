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

function failure(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return errorResponse(message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400, message);
}

export async function GET() {
  try { await requireManage(); return ok({ questions: await quizShowService.listQuestions() }); } catch (error) { return failure(error, "Unable to load questions."); }
}

export async function POST(request: Request) {
  try { const user = await requireManage(); return ok({ question: await quizShowService.createQuestion(user.id, questionSchema.parse(await request.json())) }, { status: 201 }); } catch (error) { return failure(error, "Unable to create question."); }
}
