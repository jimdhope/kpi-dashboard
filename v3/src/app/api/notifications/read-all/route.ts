import { errorResponse, ok } from "@/server/http";
import { notificationService } from "@/server/services/notification-service";

export async function PATCH() {
  try {
    await notificationService.markAllRead();
    return ok({ success: true });
  } catch {
    return errorResponse(401, "Unauthorized");
  }
}
