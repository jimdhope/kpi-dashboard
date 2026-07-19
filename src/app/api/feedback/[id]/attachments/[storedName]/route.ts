import path from "node:path";
import { readFile } from "node:fs/promises";
import { errorResponse } from "@/server/http";
import { prisma } from "@/server/db/client";
import { requireResourceAccess } from "@/server/services/authorization";

type Attachment = { originalName: string; storedName: string; contentType: string; size: number };

function isAttachment(value: unknown): value is Attachment {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.originalName === "string" && typeof item.storedName === "string"
    && typeof item.contentType === "string" && typeof item.size === "number";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; storedName: string }> }) {
  try {
    await requireResourceAccess("nav.settings.feedback", "MANAGE");
    const { id, storedName } = await params;
    if (path.basename(storedName) !== storedName) return errorResponse(400, "Invalid attachment name.");
    const feedback = await prisma.feedback.findUnique({ where: { id }, select: { attachments: true } });
    if (!feedback) return errorResponse(404, "Feedback not found.");
    const attachments = Array.isArray(feedback.attachments) ? feedback.attachments.filter(isAttachment) : [];
    const attachment = attachments.find((item) => item.storedName === storedName);
    if (!attachment) return errorResponse(404, "Attachment not found.");

    const uploadDirectory = path.resolve(/* turbopackIgnore: true */ process.env.FEEDBACK_UPLOAD_DIR
      || path.join(/* turbopackIgnore: true */ process.cwd(), "uploads"));
    const filePath = path.resolve(/* turbopackIgnore: true */ uploadDirectory, attachment.storedName);
    if (!filePath.startsWith(`${uploadDirectory}${path.sep}`)) return errorResponse(400, "Invalid attachment path.");
    const bytes = await readFile(/* turbopackIgnore: true */ filePath);
    return new Response(bytes, { headers: {
      "Content-Type": attachment.contentType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") return errorResponse(403, "Forbidden");
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return errorResponse(404, "Attachment file not found.");
    console.error("GET feedback attachment error:", error);
    return errorResponse(500, "Failed to download attachment.");
  }
}
