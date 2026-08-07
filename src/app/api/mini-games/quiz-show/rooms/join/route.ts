import { z } from "zod";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { quizShowService } from "@/server/services/quiz-show-service";
import { errorResponse, ok } from "@/server/http";
const schema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,8}$/) });
export async function POST(request: Request) { try { const user = await authService.requireCurrentUser(); if (!(await permissionService.hasNavAccess(user.roles, "miniGames", "VIEW"))) throw new Error("Forbidden"); const payload = schema.parse(await request.json()); return ok({ room: await quizShowService.joinRoom(user.id, payload.code) }); } catch (error) { const message = error instanceof Error ? error.message : "Unable to join room."; return errorResponse(message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : message.includes("not found") ? 404 : 400, message); } }
