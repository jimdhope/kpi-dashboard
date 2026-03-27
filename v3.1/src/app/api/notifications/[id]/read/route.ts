import { errorResponse, ok } from "@/server/http";
import { notificationService } from "@/server/services/notification-service";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await notificationService.markRead(id);
    return ok({ success: true });
  } catch {
    return errorResponse(401, "Unauthorized");
  }
}
