import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { requireResourceAccess } from "@/server/services/authorization";
import { prisma } from "@/server/db/client";
import { notificationService } from "@/server/services/notification-service";

const schema = z.object({
  status: z.enum(["NEW", "IN_PROGRESS", "RESOLVED"]).optional(),
  staffReply: z.string().trim().min(1).max(4_000).optional(),
}).refine((payload) => payload.status !== undefined || payload.staffReply !== undefined, { message: "Provide a status or reply." });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const manager = await requireResourceAccess("nav.settings.feedback", "MANAGE");
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const existing = await prisma.feedback.findUnique({ where: { id }, select: { userId: true, subject: true } });
    if (!existing) return errorResponse(404, "Feedback not found.");
    const feedback = await prisma.feedback.update({
      where: { id },
      data: {
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.staffReply !== undefined ? { staffReply: payload.staffReply, repliedAt: new Date(), repliedById: manager.id } : {}),
      },
    });
    if (payload.staffReply !== undefined) {
      await notificationService.create({
        recipientId: existing.userId,
        type: "FEEDBACK_REPLIED",
        title: "Feedback reply",
        message: `A manager replied to \"${existing.subject}\".`,
        href: "/feedback",
      });
    }
    return ok({ feedback });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "Invalid feedback status.");
    if (error instanceof Error && error.message === "Forbidden") return errorResponse(403, "Forbidden");
    return errorResponse(500, "Could not update feedback.");
  }
}
