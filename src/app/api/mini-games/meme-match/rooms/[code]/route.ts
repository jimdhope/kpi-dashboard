import { z } from "zod";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { memeMatchService } from "@/server/services/meme-match-service";
import { errorResponse, ok } from "@/server/http";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
  }),
  z.object({
    action: z.literal("advance"),
  }),
  z.object({
    action: z.literal("submit"),
    gifId: z.string().trim().min(1),
    gifUrl: z.string().url(),
    gifTitle: z.string().trim().max(200).nullish(),
    previewUrl: z.string().url().nullish(),
    caption: z.string().trim().min(1).max(240),
  }),
  z.object({
    action: z.literal("vote"),
    submissionId: z.string().trim().min(1),
  }),
]);

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const user = await authService.requireCurrentUser();
    if (!(await permissionService.hasNavAccess(user.roles, "miniGames", "VIEW"))) throw new Error("Forbidden");
    const { code } = await context.params;
    return ok(await memeMatchService.getRoomState(user.id, code.toUpperCase()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load room";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : message.includes("not found") ? 404 : 400;
    return errorResponse(status, message);
  }
}

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const user = await authService.requireCurrentUser();
    if (!(await permissionService.hasNavAccess(user.roles, "miniGames", "VIEW"))) throw new Error("Forbidden");
    const { code } = await context.params;
    const payload = actionSchema.parse(await request.json());
    const normalizedCode = code.toUpperCase();
    if (payload.action === "start") return ok(await memeMatchService.startRoom(user.id, normalizedCode));
    if (payload.action === "advance") return ok(await memeMatchService.advanceRoom(user.id, normalizedCode));
    if (payload.action === "submit") {
      return ok(await memeMatchService.submit(user.id, normalizedCode, {
        gifId: payload.gifId,
        gifUrl: payload.gifUrl,
        gifTitle: payload.gifTitle ?? null,
        previewUrl: payload.previewUrl ?? null,
        caption: payload.caption,
      }));
    }
    return ok(await memeMatchService.vote(user.id, normalizedCode, { submissionId: payload.submissionId }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update room";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : message.includes("not found") ? 404 : 400;
    return errorResponse(status, message);
  }
}
