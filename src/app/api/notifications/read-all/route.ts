import { ok, errorResponse } from "@/server/http";
import { authService } from "@/server/services/auth-service";
import { notificationService } from "@/server/services/notification-service";

export async function POST() {
  try {
    const user = await authService.requireCurrentUser();
    await notificationService.markAllAsRead(user.id);
    return ok({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return errorResponse(401, "Unauthorized");
    }
    return errorResponse(500, "Failed to mark all as read.");
  }
}
