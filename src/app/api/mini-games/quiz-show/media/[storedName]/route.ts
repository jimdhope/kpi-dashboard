import path from "node:path";
import { readFile } from "node:fs/promises";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { errorResponse } from "@/server/http";

const allowedTypes: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4", ".webm": "video/webm", ".ogv": "video/ogg" };
export async function GET(_request: Request, context: { params: Promise<{ storedName: string }> }) {
  try {
    const user = await authService.requireCurrentUser();
    if (!(await permissionService.hasNavAccess(user.roles, "miniGames", "VIEW"))) return errorResponse(403, "Forbidden");
    const { storedName } = await context.params;
    if (path.basename(storedName) !== storedName) return errorResponse(400, "Invalid media path.");
    const extension = path.extname(storedName).toLowerCase();
    const contentType = allowedTypes[extension];
    if (!contentType) return errorResponse(404, "Media not found.");
    const directory = path.resolve(/* turbopackIgnore: true */ process.env.QUIZ_SHOW_UPLOAD_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), "uploads", "quiz-show"));
    const filePath = path.resolve(directory, storedName);
    if (!filePath.startsWith(`${directory}${path.sep}`)) return errorResponse(400, "Invalid media path.");
    const bytes = await readFile(/* turbopackIgnore: true */ filePath);
    return new Response(bytes, { headers: { "Content-Type": contentType, "Content-Length": String(bytes.length), "Content-Disposition": "inline", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { if (error instanceof Error && error.message === "Unauthorized") return errorResponse(401, "Unauthorized"); if (error instanceof Error && "code" in error && error.code === "ENOENT") return errorResponse(404, "Media not found."); return errorResponse(500, "Unable to load media."); }
}
