import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { authService } from "@/server/services/auth-service";
import { permissionService } from "@/server/services/permission-service";
import { errorResponse, ok } from "@/server/http";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const extensions: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "video/mp4": ".mp4", "video/webm": ".webm", "video/ogg": ".ogv" };

export async function POST(request: Request) {
  try {
    const user = await authService.requireCurrentUser();
    if (!(await permissionService.hasResourceAccess(user.roles, "nav.miniGames.quizManage", "MANAGE"))) return errorResponse(403, "Forbidden");
    const file = request.headers.get("content-type")?.includes("multipart/form-data") ? (await request.formData()).get("media") : null;
    if (!(file instanceof File) || !file.size) return errorResponse(400, "Choose an image or video.");
    if (!extensions[file.type]) return errorResponse(400, "Media must be JPG, PNG, WebP, GIF, MP4, WebM, or OGG.");
    if (file.size > MAX_FILE_SIZE) return errorResponse(400, "Media must be 10 MB or smaller.");
    const directory = process.env.QUIZ_SHOW_UPLOAD_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), "uploads", "quiz-show");
    await mkdir(/* turbopackIgnore: true */ directory, { recursive: true });
    const storedName = `${randomUUID()}${extensions[file.type]}`;
    await writeFile(/* turbopackIgnore: true */ path.join(directory, storedName), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
    return ok({ mediaUrl: `/api/mini-games/quiz-show/media/${storedName}`, mediaOriginalName: file.name.slice(0, 180), mediaContentType: file.type, mediaSize: file.size }, { status: 201 });
  } catch (error) { return errorResponse(error instanceof Error && error.message === "Unauthorized" ? 401 : 500, "Unable to upload media."); }
}
