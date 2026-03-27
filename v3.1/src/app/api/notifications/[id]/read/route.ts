import { errorResponse, ok } from "@/server/http";
import { notificationService } from "@/server/services/notification-service";

export async function PATCH(_request: Request, context: { params: { id: string } }) {
  try {
    await notificationService.markRead(context.params.id);
    return ok({ success: true });
  } catch {
    return errorResponse(401, "Unauthorized");
  }
}
