import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { requireResourceAccess } from "@/server/services/authorization";
import { prisma } from "@/server/db/client";
import { notificationService } from "@/server/services/notification-service";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 3;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"]);
const extensionForType: Record<string, string> = { "application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "text/plain": ".txt" };
const fieldSchema = z.object({ subject: z.string().trim().min(1).max(120), message: z.string().trim().min(1).max(4_000) });

export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get("all") === "true") {
      await requireResourceAccess("nav.settings.feedback", "MANAGE");
      const feedback = await prisma.feedback.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100, include: { messages: { orderBy: { createdAt: "asc" } } } });
      const users = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
      const userMap = new Map(users.map((user) => [user.id, user]));
      return ok({ feedback: feedback.map((item) => ({ ...item, user: userMap.get(item.userId) ?? null })) });
    }
    const user = await authService.requireCurrentUser();
    const feedback = await prisma.feedback.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30, include: { messages: { orderBy: { createdAt: "asc" } } } });
    return ok({ feedback: feedback.map((item) => ({ ...item, messages: item.messages.map((message) => ({ ...message, isOwn: message.authorId === user.id })) })) });
  } catch { return errorResponse(401, "Unauthorized"); }
}

export async function POST(request: Request) {
  try {
    const user = await authService.requireCurrentUser();
    const formData = await request.formData();
    const payload = fieldSchema.parse({ subject: formData.get("subject"), message: formData.get("message") });
    const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    if (files.length > MAX_FILES) return errorResponse(400, `Attach up to ${MAX_FILES} files.`);
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) return errorResponse(400, "Each attachment must be 10 MB or smaller.");
      if (!ALLOWED_TYPES.has(file.type)) return errorResponse(400, "Attachments must be PDF, JPG, PNG, WebP, or text files.");
    }

    const uploadDirectory = process.env.FEEDBACK_UPLOAD_DIR
      || path.join(/* turbopackIgnore: true */ process.cwd(), "uploads");
    await mkdir(/* turbopackIgnore: true */ uploadDirectory, { recursive: true });
    const attachments = await Promise.all(files.map(async (file) => {
      const storedName = `${randomUUID()}${extensionForType[file.type]}`;
      const storedPath = path.join(/* turbopackIgnore: true */ uploadDirectory, storedName);
      await writeFile(/* turbopackIgnore: true */ storedPath, Buffer.from(await file.arrayBuffer()), { flag: "wx" });
      return { originalName: file.name.slice(0, 180), storedName, contentType: file.type, size: file.size };
    }));
    const feedback = await prisma.feedback.create({ data: { userId: user.id, subject: payload.subject, message: payload.message, attachments } });
    try {
      await notificationService.createForAdmins({
        type: "FEEDBACK_SUBMITTED",
        title: "New feedback submitted",
        message: `${user.name} submitted: ${payload.subject}`,
        href: "/settings/general/feedback",
      });
    } catch (notificationError) {
      // Feedback has already been safely stored; notification delivery must not
      // make the submission fail.
      console.error("Feedback notification failed:", notificationError);
    }
    return ok({ feedback }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Subject and message are required.");
    console.error("POST /api/feedback error:", error);
    return errorResponse(500, "Failed to submit feedback.");
  }
}
