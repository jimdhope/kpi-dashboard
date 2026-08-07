import { z } from "zod";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { quizShowService } from "@/server/services/quiz-show-service";
import { errorResponse, ok } from "@/server/http";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), timerSeconds: z.number().int().min(10).max(120).optional() }),
  z.object({ action: z.literal("reveal") }),
  z.object({ action: z.literal("answer"), selectedOptionIds: z.array(z.string().min(1)).min(1).max(6) }),
]);
function failure(error: unknown, fallback: string) { const message = error instanceof Error ? error.message : fallback; return errorResponse(message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : message.includes("not found") ? 404 : 400, message); }
export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) { try { const user = await authService.requireCurrentUser(); if (!(await permissionService.hasNavAccess(user.roles, "miniGames", "VIEW"))) throw new Error("Forbidden"); const { code } = await context.params; return ok(await quizShowService.getRoomState(user.id, code.toUpperCase())); } catch (error) { return failure(error, "Unable to load room."); } }
export async function POST(request: Request, context: { params: Promise<{ code: string }> }) { try { const user = await authService.requireCurrentUser(); if (!(await permissionService.hasNavAccess(user.roles, "miniGames", "VIEW"))) throw new Error("Forbidden"); const { code } = await context.params; const payload = actionSchema.parse(await request.json()); if (payload.action === "start") return ok(await quizShowService.startQuestion(user.id, code, payload.timerSeconds)); if (payload.action === "reveal") return ok(await quizShowService.revealQuestion(user.id, code)); return ok(await quizShowService.answer(user.id, code, payload.selectedOptionIds)); } catch (error) { return failure(error, "Unable to update room."); } }
