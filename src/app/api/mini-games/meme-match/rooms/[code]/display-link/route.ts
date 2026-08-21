import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { memeMatchService } from "@/server/services/meme-match-service";
import { errorResponse, ok } from "@/server/http";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const user = await authService.requireCurrentUser();
    if (!(await permissionService.hasNavAccess(user.roles, "miniGames", "VIEW"))) throw new Error("Forbidden");
    const { code } = await context.params;
    const normalizedCode = code.toUpperCase();
    const token = await memeMatchService.getDisplayLinkToken(user.id, normalizedCode);
    const baseUrl = process.env.PUBLIC_URL || process.env.APP_URL || new URL(request.url).origin;
    return ok({ url: `${baseUrl}/mini-games/meme-match/display?code=${encodeURIComponent(normalizedCode)}&token=${encodeURIComponent(token)}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create display link.";
    return errorResponse(message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : message.includes("not found") ? 404 : 400, message);
  }
}
