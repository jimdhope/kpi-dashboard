import { z } from "zod";
import { errorResponse, ok } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { requireResourceAccess } from "@/server/services/authorization";
import { prisma } from "@/server/db/client";
import { notificationService } from "@/server/services/notification-service";

const schema = z.object({ message: z.string().trim().min(1).max(4_000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authService.requireCurrentUser();
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const feedback = await prisma.feedback.findUnique({ where: { id }, select: { userId: true, subject: true } });
    if (!feedback) return errorResponse(404, "Feedback not found.");

    const isSender = feedback.userId === user.id;
    if (!isSender) await requireResourceAccess("nav.settings.feedback", "MANAGE");
    const message = await prisma.feedbackMessage.create({ data: { feedbackId: id, authorId: user.id, message: payload.message } });

    if (isSender) {
      await notificationService.createForAdmins({ type: "FEEDBACK_SUBMITTED", title: "Feedback reply received", message: `${user.name} replied to: ${feedback.subject}`, href: "/settings/general/feedback" });
    } else {
      await notificationService.create({ recipientId: feedback.userId, type: "FEEDBACK_REPLIED", title: "Feedback reply", message: `A manager replied to \"${feedback.subject}\".`, href: "/feedback" });
    }
    return ok({ message });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(400, "A reply must be between 1 and 4,000 characters.");
    if (error instanceof Error && error.message === "Forbidden") return errorResponse(403, "Forbidden");
    return errorResponse(500, "Could not send reply.");
  }
}
