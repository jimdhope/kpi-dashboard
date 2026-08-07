import { z } from "zod";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { memeMatchService } from "@/server/services/meme-match-service";
import { errorResponse, ok } from "@/server/http";

const searchSchema = z.object({
  q: z.string().trim().min(1).max(120),
});

export async function GET(request: Request) {
  try {
    const user = await authService.requireCurrentUser();
    if (!(await permissionService.hasNavAccess(user.roles, "miniGames", "VIEW"))) throw new Error("Forbidden");
    const q = request.url ? new URL(request.url).searchParams.get("q") ?? "" : "";
    const query = searchSchema.parse({ q });
    return ok(await memeMatchService.searchGifs(user.id, query.q));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to search GIFs";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return errorResponse(status, message);
  }
}
