import { z } from "zod";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { quizShowService } from "@/server/services/quiz-show-service";
import { errorResponse, ok } from "@/server/http";

const schema = z.object({ quizId: z.string().min(1), shuffleQuestions: z.boolean().default(false) });
export async function POST(request: Request) {
  try { const user = await authService.requireCurrentUser(); if (!(await permissionService.hasResourceAccess(user.roles, "nav.miniGames.quizManage", "MANAGE"))) throw new Error("Forbidden"); const payload = schema.parse(await request.json()); return ok({ room: await quizShowService.createRoom(user.id, payload.quizId, payload.shuffleQuestions) }, { status: 201 }); }
  catch (error) { const message = error instanceof Error ? error.message : "Unable to create room."; return errorResponse(message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400, message); }
}

export async function GET() { try { const user = await authService.requireCurrentUser(); if (!(await permissionService.hasNavAccess(user.roles, "miniGames", "VIEW"))) throw new Error("Forbidden"); return ok({ rooms: await quizShowService.getActiveRooms() }); } catch (error) { const message = error instanceof Error ? error.message : "Unable to load rooms."; return errorResponse(message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400, message); } }
